import type { DoctorCheck } from '#/doctor.ts'
import { ANTDV_NEXT } from '@/constants/repo.ts'
import { resolvePackage } from '@/utils/pkg.ts'

export const antdvInstallState = {
  isInstalled: false,
  version: '',
}

export const checkAntdvInstalled: DoctorCheck = async (ctx) => {
  const name = 'antdv-installed'

  const pkg = await resolvePackage(ANTDV_NEXT, ctx)

  if (!pkg) {
    return {
      name,
      status: 'fail',
      severity: 'error',
      message: `${ANTDV_NEXT} is not installed in this project`,
      suggestion: `Run: pnpm add ${ANTDV_NEXT} (or npm i / yarn add ${ANTDV_NEXT})`,
    }
  }

  antdvInstallState.isInstalled = true
  antdvInstallState.version = pkg.version

  return {
    name,
    status: 'pass',
    message: `${ANTDV_NEXT}@${pkg.version} is installed`,
    details: {
      packageJsonPath: pkg.path,
      version: pkg.version,
    },
  }
}
