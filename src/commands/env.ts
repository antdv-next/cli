import type { PackageInfo, ResolvedConfig } from '@/types.ts'
import { defineCommand } from 'citty'
import { getPackageInfo, loadPackageJSON } from 'local-pkg'
import { x } from 'tinyexec'
import { defaultArgs } from '@/args.ts'
import { resolveConfig } from '@/config.ts'
import { output } from '@/utils/output.ts'

export type EnvinfoValue = PackageInfo | string | null
export type EnvinfoData = Record<string, Record<string, EnvinfoValue>>

export interface EnvResult {
    envinfo: EnvinfoData
    dependencies: Record<string, string | null>
    ecosystem: Record<string, string>
    buildTools: Record<string, string>
}

const CORE_DEPENDENCIES = [
    'antdv-next',
    '@antdv-next/cssinjs',
    '@antdv-next/icons',
    'dayjs',
] as const

const BUILD_TOOLS = [
    'vue',
    'nuxt',
    'vite',
    'esbuild',
    'rollup',
    'tsdown',
    'typescript',
    'tailwindcss',
] as const

const ENVINFO_ORDER = [
    'System',
    'Binaries',
    'Managers',
    'Utilities',
    'Servers',
    'IDEs',
    'Languages',
    'Databases',
    'Browsers',
] as const

function getDisplayValue(value: EnvinfoValue): string | null {
    if (value === null) {
        return null
    }

    if (typeof value === 'string') {
        return value
    }

    return value.version ?? null
}

export async function collectEnvinfo(config: ResolvedConfig): Promise<EnvinfoData> {
    try {
        const envinfo = await import('envinfo')
        const raw = await envinfo.default.run(
            {
                System: ['OS', 'CPU', 'Memory', 'Shell'],
                Binaries: ['Node', 'Yarn', 'npm', 'pnpm', 'bun', 'Deno'],
                Managers: ['Cargo', 'Homebrew', 'pip3', 'RubyGems'],
                Utilities: ['Make', 'GCC', 'Git', 'Clang', 'FFmpeg', 'Curl', 'OpenSSL'],
                Servers: ['Apache'],
                IDEs: ['VSCode', 'Claude Code', 'Vim', 'Xcode'],
                Languages: ['Bash', 'Perl', 'Python3', 'Ruby', 'Rust'],
                Databases: ['SQLite'],
                Browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
            },
            {
                json: true,
            },
        )
        const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>
        const result: EnvinfoData = {}

        for (const [category, items] of Object.entries(parsed)) {
            const categoryResult: Record<string, EnvinfoValue> = {}
            result[category] = categoryResult

            for (const [name, info] of Object.entries(items)) {
                if (typeof info === 'string') {
                    categoryResult[name] = info
                }
                else if (info && typeof info === 'object') {
                    categoryResult[name] = info as PackageInfo
                }
                else {
                    categoryResult[name] = null
                }
            }
        }

        result.Binaries ??= {}

        try {
            const registry = await x('npm', ['config', 'get', 'registry'], {
                timeout: 5000,
                nodeOptions: {
                    cwd: config.cwd,
                    stdio: 'pipe',
                },
            })
            result.Binaries.Registry = registry.stdout.trim()
        }
        catch {
            result.Binaries.Registry = null
        }

        return result
    }
    catch {
        return {}
    }
}

export async function getInstalledPackageVersion(cwd: string, packageName: string): Promise<string | null> {
    try {
        const packageInfo = await getPackageInfo(packageName, {
            paths: [cwd],
        })
        return typeof packageInfo?.version === 'string' && packageInfo.version.length > 0
            ? packageInfo.version
            : null
    }
    catch {
        return null
    }
}

export async function collectDependencies(cwd: string): Promise<Record<string, string | null>> {
    const entries = await Promise.all(CORE_DEPENDENCIES.map(async packageName => [
        packageName,
        await getInstalledPackageVersion(cwd, packageName),
    ] as const))

    return Object.fromEntries(entries)
}

export async function scanEcosystem(cwd: string): Promise<Record<string, string>> {
    const packageNames = new Set<string>()
    const coreDependencies = new Set<string>(CORE_DEPENDENCIES)

    try {
        const packageJson = await loadPackageJSON(cwd)
        const dependencyGroups = [
            packageJson?.dependencies,
            packageJson?.devDependencies,
            packageJson?.optionalDependencies,
            packageJson?.peerDependencies,
        ]

        for (const dependencies of dependencyGroups) {
            for (const packageName of Object.keys(dependencies ?? {})) {
                const isEcosystemPackage = packageName.startsWith('@antdv-next/')
                    || packageName.startsWith('@v-c/')

                if (isEcosystemPackage && !coreDependencies.has(packageName)) {
                    packageNames.add(packageName)
                }
            }
        }
    }
    catch {
        return {}
    }

    const result: Record<string, string> = {}
    for (const packageName of [...packageNames].sort()) {
        const version = await getInstalledPackageVersion(cwd, packageName)
        if (version !== null) {
            result[packageName] = version
        }
    }

    return result
}

export async function collectBuildTools(cwd: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {}

    for (const packageName of BUILD_TOOLS) {
        const version = await getInstalledPackageVersion(cwd, packageName)
        if (version !== null) {
            result[packageName] = version
        }
    }

    return result
}

export function formatText(data: EnvResult): string {
    const lines: string[] = ['Environment', '']

    const section = (title: string, entries: Record<string, EnvinfoValue>, showNull: boolean): void => {
        const filtered = showNull
            ? Object.entries(entries)
            : Object.entries(entries).filter(([, value]) => getDisplayValue(value) !== null)

        if (filtered.length === 0) {
            return
        }

        lines.push(`  ${title}:`)
        const maxKeyLength = Math.max(...filtered.map(([key]) => key.length))
        for (const [key, value] of filtered) {
            const paddedKey = key.padEnd(maxKeyLength + 1)
            lines.push(`    ${paddedKey} ${getDisplayValue(value) ?? 'Not found'}`)
        }
        lines.push('')
    }

    for (const category of ENVINFO_ORDER) {
        if (data.envinfo[category]) {
            section(category, data.envinfo[category], false)
        }
    }

    section('Dependencies', data.dependencies, true)
    section('Ecosystem', data.ecosystem, false)
    section('Build Tools', data.buildTools, false)

    return lines.join('\n')
}

export function formatMarkdown(data: EnvResult): string {
    const lines: string[] = ['## Environment', '']

    const table = (
        title: string,
        firstColumn: string,
        secondColumn: string,
        entries: Record<string, EnvinfoValue>,
        showNull: boolean,
    ): void => {
        const filtered = showNull
            ? Object.entries(entries)
            : Object.entries(entries).filter(([, value]) => getDisplayValue(value) !== null)

        if (filtered.length === 0) {
            return
        }

        lines.push(`### ${title}`, '')
        lines.push(`| ${firstColumn} | ${secondColumn} |`)
        lines.push('|------|---------|')
        for (const [key, value] of filtered) {
            lines.push(`| ${key} | ${getDisplayValue(value) ?? 'Not found'} |`)
        }
        lines.push('')
    }

    for (const category of ENVINFO_ORDER) {
        if (data.envinfo[category]) {
            table(category, 'Item', 'Version', data.envinfo[category], false)
        }
    }

    table('Dependencies', 'Package', 'Version', data.dependencies, true)
    table('Ecosystem', 'Package', 'Version', data.ecosystem, false)
    table('Build Tools', 'Package', 'Version', data.buildTools, false)

    return lines.join('\n')
}

export default defineCommand({
    meta: {
        name: 'env',
        description: 'Collect antdv-related environment information for bug reporting',
    },
    args: defaultArgs,
    async run({ args }) {
        const config = resolveConfig(args)

        const [envinfo, dependencies, ecosystem, buildTools] = await Promise.all([
            collectEnvinfo(config),
            collectDependencies(config.cwd),
            scanEcosystem(config.cwd),
            collectBuildTools(config.cwd),
        ])

        const data: EnvResult = {
            envinfo,
            dependencies,
            ecosystem,
            buildTools,
        }

        output(
            {
                json: data,
                markdown: formatMarkdown(data),
                text: formatText(data),
            },
            config.format,
        )
    },
})
