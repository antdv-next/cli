import type { DoctorReport } from '../src/types/doctor'
import { runCommand } from 'citty'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import doctorCommand, {
  formatReportMarkdown,
  formatReportText,
} from '../src/commands/doctor'

const mocks = vi.hoisted(() => {
  const createCheck = (checkName: string) => Object.assign(vi.fn(), { checkName })

  return {
    output: vi.fn(),
    passCheck: createCheck('pass-check'),
    warningCheck: createCheck('warning-check'),
    skipCheck: createCheck('skip-check'),
    errorCheck: createCheck('error-check'),
    nonErrorCheck: createCheck('non-error-check'),
  }
})

vi.mock('@/doctor', () => ({
  checks: [
    mocks.passCheck,
    mocks.warningCheck,
    mocks.skipCheck,
    mocks.errorCheck,
    mocks.nonErrorCheck,
  ],
}))

vi.mock('@/utils/output', () => ({
  output: mocks.output,
}))

const report: DoctorReport = {
  version: '1.2.3',
  cwd: '/tmp/example-project',
  checks: [
    {
      name: 'vue-compat',
      status: 'pass',
      message: 'vue is ready | compatible',
    },
    {
      name: 'icons-compat',
      status: 'fail',
      severity: 'warning',
      message: 'icons package is missing',
      suggestion: 'Install icons | configure aliases',
    },
    {
      name: 'nuxt-module',
      status: 'skip',
      message: 'Not a Nuxt project',
    },
    {
      name: 'antdv-installed',
      status: 'fail',
      severity: 'error',
      message: 'antdv-next is missing',
    },
  ],
  summary: {
    total: 4,
    pass: 1,
    fail: 2,
    skip: 1,
    errors: 1,
    warnings: 1,
  },
}

beforeEach(() => {
  vi.resetAllMocks()

  mocks.passCheck.mockResolvedValue({
    name: 'pass-check',
    status: 'pass',
    message: 'Everything is ready',
  })
  mocks.warningCheck.mockResolvedValue({
    name: 'warning-check',
    status: 'fail',
    severity: 'warning',
    message: 'Optional package is missing',
    suggestion: 'Install the optional package',
  })
  mocks.skipCheck.mockResolvedValue({
    name: 'skip-check',
    status: 'skip',
    message: 'This check does not apply',
  })
  mocks.errorCheck.mockRejectedValue(new Error('dependency lookup failed'))
  mocks.nonErrorCheck.mockRejectedValue('non-error failure')
})

describe('doctor report formatters', () => {
  it('formats a readable text report with status icons and suggestions', () => {
    expect(formatReportText(report)).toBe(`antdv Doctor

✓ [vue-compat] vue is ready | compatible
✗ [icons-compat] [warning] icons package is missing
    → Install icons | configure aliases
○ [nuxt-module] Not a Nuxt project
✗ [antdv-installed] [error] antdv-next is missing

Summary: 1 pass, 2 fail, 1 skip (1 errors, 1 warnings)`)
  })

  it('formats markdown tables and escapes pipes in user-facing values', () => {
    expect(formatReportMarkdown(report)).toBe(`## antdv doctor v1.2.3

Working directory: \`/tmp/example-project\`

| Check | Status | Severity | Message |
|---|---|---|---|
| vue-compat | pass |  | vue is ready \\| compatible |
| icons-compat | fail | warning | icons package is missing |
|  |  |  | Suggestion: Install icons \\| configure aliases |
| nuxt-module | skip |  | Not a Nuxt project |
| antdv-installed | fail | error | antdv-next is missing |

**Summary:** 1 pass, 2 fail, 1 skip
(1 errors, 1 warnings)`)
  })
})

describe('doctor command', () => {
  it('runs every check, converts thrown values into failures, and outputs the summary', async () => {
    await runCommand(doctorCommand, {
      rawArgs: [
        '--cwd',
        '/tmp/example-project',
        '--format',
        'markdown',
      ],
    })

    for (const check of [
      mocks.passCheck,
      mocks.warningCheck,
      mocks.skipCheck,
      mocks.errorCheck,
      mocks.nonErrorCheck,
    ]) {
      expect(check).toHaveBeenCalledOnce()
      expect(check).toHaveBeenCalledWith(expect.objectContaining({
        cwd: '/tmp/example-project',
        format: 'markdown',
        ver: '',
      }))
    }

    expect(mocks.output).toHaveBeenCalledOnce()
    expect(mocks.output).toHaveBeenCalledWith({
      json: [
        {
          name: 'pass-check',
          status: 'pass',
          message: 'Everything is ready',
        },
        {
          name: 'warning-check',
          status: 'fail',
          severity: 'warning',
          message: 'Optional package is missing',
          suggestion: 'Install the optional package',
        },
        {
          name: 'skip-check',
          status: 'skip',
          message: 'This check does not apply',
        },
        {
          name: 'error-check',
          status: 'fail',
          severity: 'error',
          message: 'Check threw: dependency lookup failed',
          suggestion: 'This is an internal doctor error — please report it',
        },
        {
          name: 'non-error-check',
          status: 'fail',
          severity: 'error',
          message: 'Check threw: non-error failure',
          suggestion: 'This is an internal doctor error — please report it',
        },
      ],
      text: expect.stringContaining(
        'Summary: 1 pass, 3 fail, 1 skip (2 errors, 1 warnings)',
      ),
      markdown: expect.stringMatching(
        /\*\*Summary:\*\* 1 pass, 3 fail, 1 skip\n\(2 errors, 1 warnings\)$/,
      ),
    }, 'markdown')
  })

  it('uses text output by default', async () => {
    await runCommand(doctorCommand, {
      rawArgs: ['--cwd', '/tmp/example-project'],
    })

    expect(mocks.output).toHaveBeenCalledOnce()
    expect(mocks.output.mock.calls[0]?.[1]).toBe('text')
  })
})
