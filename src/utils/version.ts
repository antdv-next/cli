import type { ResolvedConfig, ResolvedVersion } from '@/types.ts'
import { readdir } from 'node:fs/promises'
import { getPackageInfo } from 'local-pkg'
import semver from 'semver'
import { getDataPath } from '@/utils/loader.ts'

const VERSION_FILE_RE = /^v(.+)\.json$/

function parseVersion(version: string): ResolvedVersion {
    const parsedVersion = semver.coerce(version.trim())

    if (!parsedVersion) {
        return {
            version: '',
            majorVersion: `v0`,
        }
    }

    return {
        version: parsedVersion.version,
        majorVersion: `v${parsedVersion.major}`,
    }
}

async function resolveInstalledVersion(cwd: string): Promise<ResolvedVersion> {
    const packageInfo = await getPackageInfo('antdv-next', {
        paths: [cwd],
    })

    return parseVersion(packageInfo?.version ?? '')
}

export async function resolveFallBack(dataPath = getDataPath()): Promise<ResolvedVersion> {
    const entries = await readdir(dataPath, { withFileTypes: true })
    const versions = entries
        .filter(entry => entry.isFile())
        .map(entry => entry.name.match(VERSION_FILE_RE)?.[1])
        .filter((version): version is string => Boolean(version && semver.valid(version)))
        .sort(semver.rcompare)

    const resolvedVersion = versions[0] && parseVersion(versions[0])

    if (!resolvedVersion) {
        throw new Error(`No valid antdv-next version files found in ${dataPath}`)
    }

    return resolvedVersion
}

export async function resolveVersion(config: ResolvedConfig): Promise<ResolvedVersion> {
    const { version, cwd } = config

    if (version) {
        const resolvedVersion = parseVersion(version)

        if (!resolvedVersion) {
            throw new TypeError(`Invalid antdv-next version: ${version}`)
        }

        return resolvedVersion
    }

    const pkgVersion = await resolveInstalledVersion(cwd)
    if (pkgVersion.version) {
        return pkgVersion
    }

    return await resolveFallBack()
}
