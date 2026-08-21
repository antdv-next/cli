import type { DoctorCheck } from '#/doctor.ts'
import { antdvInstallState } from '@/doctor/antdv.installed.ts'
import { resolvePackage } from '@/utils/pkg.ts'

export const checkIconsCompat: DoctorCheck = async (ctx) => {
  const name = 'icons-compat'
  const antdv = antdvInstallState

  if (!antdv.isInstalled) {
    return {
      name,
      status: 'skip',
      message: 'antdv-next not installed — skip icons-compat',
    }
  }

  const icons = await resolvePackage('@antdv-next/icons', ctx)

  if (!icons) {
    return {
      name,
      status: 'fail',
      severity: 'warning',
      message: '@antdv-next/icons is not installed (icons are commonly required)',
      suggestion: 'Run: pnpm add @antdv-next/icons',
    }
  }

  return {
    name,
    status: 'pass',
    message: `@antdv-next/icons@${icons.version} looks compatible`,
    details: {
      icons: icons.version,
    },
  }
}
