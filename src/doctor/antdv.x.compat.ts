import type { DoctorCheck } from '#/doctor.ts'
import { antdvInstallState } from '@/doctor/antdv.installed.ts'
import { resolvePackage } from '@/utils/pkg.ts'

export const checkAntdvXCompat: DoctorCheck = async (ctx) => {
  const name = 'antdv-x-compat'

  const antdv = antdvInstallState

  const x = await resolvePackage('@antdv-next/x', ctx)
  if (!x) {
    return {
      name,
      status: 'fail',
      severity: 'warning',
      message: '@antdv-next/x is not installed (@antdv-next/x are commonly required)',
      suggestion: 'Run: pnpm add @antdv-next/x',
    }
  }

  return {
    name,
    status: 'pass',
    message: `@antdv-next/x@${x?.version} compatibility checks passed`,
    details: {
      x: x.version,
      antdv: antdv.version,
    },
  }
}
