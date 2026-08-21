import type { DoctorCheck } from '#/doctor.ts'
import { resolvePackage } from '@/utils/pkg.ts'

export const checkVueCompat: DoctorCheck = async (ctx) => {
  const name = 'vue-compat'

  const pkg = await resolvePackage('vue', ctx)

  if (!pkg) {
    return {
      name,
      status: 'fail',
      severity: 'error',
      message: 'vue is not installed',
      suggestion: `Run: pnpm add vue@^latest (or npm i / yarn add vue@latest)`,
    }
  }

  return {
    name,
    status: 'pass',
    message: `vue@${pkg.version} is installed`,
    details: {
      packageJsonPath: pkg.path,
      version: pkg.version,
    },
  }
}
