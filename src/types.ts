import type { OutputFormat } from '@/args.ts'

export declare const __CLI_VERSION__: string

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
