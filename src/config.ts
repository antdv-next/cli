import type { CommandArgs } from '@/args.ts'
import type { ResolvedConfig } from '@/types.ts'

export const resolveConfig = (options: CommandArgs): ResolvedConfig => {
    return {
        cwd: options.cwd,
        format: options.format,
    }
}
