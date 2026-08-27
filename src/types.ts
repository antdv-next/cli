import type { OutputFormat } from '@/args/default.ts'
import type { clientOption, modeOption } from '@/args/setup.ts'

export interface ResolvedConfig {
  cwd: string
  format: OutputFormat
  version: string
  component: string

  title?: string
  reproduction?: string
  steps?: string
  expected?: string
  actual?: string
  extra?: string
  submit?: boolean

  mode?: modeOption
  client?: clientOption
  writeInstructions?: boolean
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

export interface ResolvedVersion {
  version: string
  majorVersion: `v${number}`
}

export interface CliError {
  message: string
  suggestion?: string
}
