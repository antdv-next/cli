import type { DoctorCheck } from '#/doctor.ts'
import { checkAntdvInstalled } from '@/doctor/antdv.installed.ts'
import { checkAntdvXCompat } from '@/doctor/antdv.x.compat.ts'
import { checkAutoImportResolver } from '@/doctor/auto.import.resolver.ts'
import { checkIconsCompat } from '@/doctor/icons.compat.ts'
import { checkNuxtModule } from '@/doctor/nuxt.module.ts'
import { checkVueCompat } from '@/doctor/vue.compat.ts'

export const checks = [
  Object.assign(checkAntdvInstalled, { checkName: 'antdv-installed' }),
  Object.assign(checkVueCompat, { checkName: 'vue-compat' }),
  Object.assign(checkNuxtModule, { checkName: 'nuxt-module' }),
  Object.assign(checkIconsCompat, { checkName: 'icons-compat' }),
  Object.assign(checkAntdvXCompat, { checkName: 'antdv-x-compat' }),
  Object.assign(checkAutoImportResolver, { checkName: 'auto-import-resolver' }),
] satisfies ({ checkName: string } & DoctorCheck)[]
