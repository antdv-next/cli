import type { DoctorCheck } from '#/doctor.ts'
import { antdvInstallState } from '@/doctor/antdv.installed.ts'
import { resolvePackage } from '@/utils/pkg.ts'

export const checkAutoImportResolver: DoctorCheck = async (ctx) => {
  const name = 'auto-import-resolver'
  const antdv = antdvInstallState
  if (!antdv.isInstalled) {
    return {
      name,
      status: 'skip',
      message: 'antdv-next not installed — skip auto-import-resolver',
    }
  }

  const unplugin = await resolvePackage('unplugin-vue-components', ctx)

  if (!unplugin) {
    return {
      name,
      status: 'fail',
      severity: 'error',
      message: `unplugin-vue-components is not installed`,
      suggestion: `Run: pnpm add -D unplugin-vue-components`,
    }
  }

  const resolverName = '@antdv-next/auto-import-resolver'
  const resolverXName = '@antdv-next/auto-import-resolver-x'
  const [resolver, resolverX] = await Promise.all([
    resolvePackage(resolverName, ctx),
    resolvePackage(resolverXName, ctx),
  ])

  if (!resolver || !resolverX) {
    const missingResolvers = [
      !resolver && resolverName,
      !resolverX && resolverXName,
    ].filter((packageName): packageName is string => Boolean(packageName))

    return {
      name,
      status: 'fail',
      severity: 'error',
      message: `Missing auto-import resolver: ${missingResolvers.join(', ')}`,
      suggestion: `Run: pnpm add -D ${missingResolvers.join(' ')}`,
      details: {
        resolver: resolver && resolver.version,
        resolverX: resolverX && resolverX.version,
      },
    }
  }

  return {
    name,
    status: 'pass',
    message: 'unplugin-vue-components and both antdv-next auto-import resolvers are installed',
    details: {
      unplugin: unplugin.version,
      resolver: resolver.version,
      resolverX: resolverX.version,
    },
  }
}
