import type { PackageJson } from 'pkg-types'
import boxen from 'boxen'
import pc from 'picocolors'
import semver from 'semver'
import { ANTDV_REPO_CLI } from '@/constants/repo.ts'

const LATEST_VERSION_URLS = [
    `https://registry.npmjs.org/@${ANTDV_REPO_CLI}/latest`,
    `https://registry.npmmirror.com/@${ANTDV_REPO_CLI}/latest`,
    `https://unpkg.com/@${ANTDV_REPO_CLI}@latest/package.json`,
] as const

const REQUEST_TIMEOUT_MS = 5_000
const VERSION_NOT_FOUND = '0.0.0'

interface LatestVersionResult {
    index: number
    version: string
}

async function fetchLatestVersion(url: string, controller: AbortController): Promise<string> {
    const timeout = setTimeout(() => {
        controller.abort(new Error(`Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`))
    }, REQUEST_TIMEOUT_MS)

    try {
        const response = await fetch(url, { signal: controller.signal })

        if (response.status === 404) {
            return VERSION_NOT_FOUND
        }

        if (!response.ok) {
            throw new Error(`Request to ${url} failed with status ${response.status}`)
        }

        const result = await response.json() as PackageJson

        if (typeof result.version !== 'string' || result.version.trim() === '') {
            throw new Error(`Request to ${url} returned an invalid version`)
        }

        return result.version.trim()
    }
    finally {
        clearTimeout(timeout)
    }
}

export async function getLatestVersion(): Promise<string> {
    const controllers = LATEST_VERSION_URLS.map(() => new AbortController())
    let winnerIndex: number | undefined

    try {
        const winner = await Promise.any(
            LATEST_VERSION_URLS.map(async (url, index): Promise<LatestVersionResult> => ({
                index,
                version: await fetchLatestVersion(url, controllers[index]!),
            })),
        )

        winnerIndex = winner.index
        return winner.version
    }
    finally {
        controllers.forEach((controller, index) => {
            if (index !== winnerIndex) {
                controller.abort()
            }
        })
    }
}

export async function reportUpdateCheck(): Promise<void> {
    const latestVersion = await getLatestVersion()
    if (semver.gt(latestVersion, __CLI_VERSION__)) {
        const line = `Update available: v${pc.cyan(__CLI_VERSION__)} → v${pc.red(latestVersion)}`
        const cmd = 'Run: antdv upgrade'
        const install = `Or: npm i @${ANTDV_REPO_CLI} -g`
        const content = [line, cmd, install].join('\n')
        console.log(boxen(content, {
            title: 'Warning',
            borderColor: 'yellow',
            borderStyle: 'round',
            padding: {
                top: 1,
                left: 1,
                right: 1,
                bottom: 1,
            },
            margin: 0,
        }))
    }
}
