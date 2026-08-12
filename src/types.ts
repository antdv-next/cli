import type { OutputFormat } from '@/args.ts'

export interface ResolvedConfig {
    cwd: string
    format: OutputFormat
}

export interface PackageInfo {
    version?: string
    path?: string
}
