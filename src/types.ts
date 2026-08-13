import type { OutputFormat } from '@/args/default.ts'

export interface ResolvedConfig {
    cwd: string
    format: OutputFormat
}

export interface PackageInfo {
    version?: string
    path?: string
}

export interface ResolvedContent {
    json: object
    text: string
    markdown: string
}

export interface ResolvedAntdvVersionEnv {
    vue: string
    vite: string
    antdv: string
    cli: string
    typescript: string
    system: string
    package: {
        node: string
        npm: string
        pnpm: string
        deno: string
        bun: string
    }
}

export interface AntdvIssueFields {
    reproduction: string
    steps: string
    expected: string
    actual: string
    extra: string
    env: ResolvedAntdvVersionEnv
}
