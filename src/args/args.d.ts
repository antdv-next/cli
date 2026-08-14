import type { ParsedArgs } from 'citty'
import type { bugArgs } from '@/args/bug.ts'
import type { defaultArgs } from '@/args/default.ts'

export type OptionsArgs = ParsedArgs<typeof defaultArgs> & ParsedArgs<typeof bugArgs>
