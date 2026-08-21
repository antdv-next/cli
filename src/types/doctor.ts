import type { OptionsArgs } from '@/args/args'

export type CheckStatus = 'pass' | 'fail' | 'skip'
export type Severity = 'error' | 'warning' | 'info'

export interface DoctorCheckResult {
  name: string
  status: CheckStatus
  severity?: Severity
  message: string
  suggestion?: string
  details?: Record<string, unknown>
}

export interface DoctorCheck {
  (context: OptionsArgs): Promise<DoctorCheckResult> | DoctorCheckResult
}

export interface DoctorReport {
  version: string
  cwd: string
  checks: DoctorCheckResult[]
  summary: {
    total: number
    pass: number
    fail: number
    skip: number
    errors: number
    warnings: number
  }
}
