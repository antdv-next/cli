import type { DoctorCheck } from '#/doctor.ts'
import { glob } from 'glob'
import semver from 'semver'
import { antdvInstallState } from '@/doctor/antdv.installed.ts'
import { resolvePackage, stripVersionPrefix } from '@/utils/pkg.ts'

export const checkNuxtModule: DoctorCheck = async (ctx) => {
  const name = 'nuxt-module'

  const nuxt = await resolvePackage('nuxt', ctx)
  const nuxtConfigs = await glob('**/nuxt.config.ts', {
    cwd: ctx.cwd,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
    ],
  })

  if (!nuxt && !nuxtConfigs.length) {
    return {
      name,
      status: 'skip',
      message: 'Not a Nuxt project — skip nuxt-module',
    }
  }
  //
  const antdv = antdvInstallState
  const module = await resolvePackage('@antdv-next/nuxt', ctx)
  const vue = await resolvePackage('vue', ctx)

  const issues: string[] = []
  const suggestions: string[] = []

  if (nuxt && !semver.gte(stripVersionPrefix(nuxt.version), '4.0.0')) {
    console.log('Nuxt version', nuxt.version)
    issues.push(`Nuxt ${nuxt.version} < 4.0.0 (required by @antdv-next/nuxt)`)
    suggestions.push('Upgrade Nuxt to >= 4.0.0')
  }

  if (vue && !semver.gte(stripVersionPrefix(vue.version), '3.5.0')) {
    issues.push(`Vue ${vue.version} < 3.5.0 (required in Nuxt + antdv-next)`)
    suggestions.push('Upgrade vue to >= 3.5.0')
  }

  if (!module) {
    issues.push('@antdv-next/nuxt is not installed')
    suggestions.push('pnpm add -D @antdv-next/nuxt')
  }

  if (issues.length) {
    return {
      name,
      status: 'fail',
      severity: issues.some(i => i.includes('not installed') || i.includes('<')) ? 'error' : 'warning',
      message: issues.join('; '),
      suggestion: suggestions.join(' | '),
      details: {
        nuxt: nuxt && nuxt.version,
        vue: vue && vue.version,
        antdv: antdv.version,
        module: module && module.version,
      },
    }
  }

  return {
    name,
    status: 'pass',
    message: `@antdv-next/nuxt@ configured correctly`,
    details: {
      nuxt: nuxt && nuxt.version,
    },
  }
}
