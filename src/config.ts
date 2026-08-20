import type { OptionsArgs } from '@/args/args'
import type { ResolvedConfig } from '@/types.ts'

export const resolveConfig = (options: OptionsArgs): ResolvedConfig => {
  return {
    cwd: options.cwd,
    format: options.format,
    version: options.ver,
    component: options.component ?? '',
  }
}
