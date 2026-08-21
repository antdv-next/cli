import type { DoctorReport } from '#/doctor.ts'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { checks } from '@/doctor'
import { output } from '@/utils/output'

export function formatReportText(report: DoctorReport): string {
  const lines: string[] = []
  lines.push(`antdv Doctor`)
  lines.push('')

  for (const c of report.checks) {
    const icon = c.status === 'pass' ? '✓' : c.status === 'skip' ? '○' : '✗'
    const sev = c.severity ? ` [${c.severity}]` : ''
    lines.push(`${icon} [${c.name}]${sev} ${c.message}`)
    if (c.suggestion)
      lines.push(`    → ${c.suggestion}`)
  }

  lines.push('')
  lines.push(
    `Summary: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.skip} skip`
    + ` (${report.summary.errors} errors, ${report.summary.warnings} warnings)`,
  )
  return lines.join('\n')
}

export function formatReportMarkdown(report: DoctorReport): string {
  const lines = [
    `## antdv doctor v${report.version}`,
    '',
    `Working directory: \`${report.cwd}\``,
    '',
    '| Check | Status | Severity | Message |',
    '|---|---|---|---|',
  ]

  for (const check of report.checks) {
    const message = check.message.replaceAll('|', '\\|')
    lines.push(`| ${check.name} | ${check.status} | ${check.severity ?? ''} | ${message} |`)
    if (check.suggestion) {
      lines.push(`|  |  |  | Suggestion: ${check.suggestion.replaceAll('|', '\\|')} |`)
    }
  }

  lines.push(
    '',
    `**Summary:** ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.skip} skip`,
    `(${report.summary.errors} errors, ${report.summary.warnings} warnings)`,
  )

  return lines.join('\n')
}

export default defineCommand({
  meta: {
    name: 'doctor',
    description: 'Diagnose project-level antd configuration issues',
  },
  args: defaultArgs,
  async run({ args }) {
    const results = []
    for (const handlerCheck of checks) {
      try {
        const result = await handlerCheck(args)
        results.push(result)
      }
      catch (err) {
        results.push({
          name: handlerCheck.checkName,
          status: 'fail',
          severity: 'error',
          message: `Check threw: ${err instanceof Error ? err.message : String(err)}`,
          suggestion: 'This is an internal doctor error — please report it',
        })
      }
    }

    const summary = {
      total: results.length,
      pass: results.filter(r => r.status === 'pass').length,
      fail: results.filter(r => r.status === 'fail').length,
      skip: results.filter(r => r.status === 'skip').length,
      errors: results.filter(r => r.status === 'fail' && r.severity === 'error').length,
      warnings: results.filter(r => r.status === 'fail' && r.severity === 'warning').length,
    }

    const data = {
      version: __CLI_VERSION__,
      cwd: args.cwd,
      checks: results,
      summary,
    } as DoctorReport

    output({
      json: results,
      text: formatReportText(data),
      markdown: formatReportMarkdown(data),
    }, args.format)
  },
})
