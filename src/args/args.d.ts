import type { ParsedArgs } from 'citty'
import type { bugArgs } from '@/args/bug.ts'
import type { componentArgs } from '@/args/component.ts'
import type { defaultArgs } from '@/args/default.ts'
import type { demoArgs } from '@/args/demo.ts'
import type { initArgs } from '@/args/init.ts'

export type OptionsArgs = ParsedArgs<typeof defaultArgs>
  & Partial<
    ParsedArgs<typeof bugArgs>
    & ParsedArgs<typeof componentArgs>
    & ParsedArgs<typeof demoArgs>
    & ParsedArgs<typeof initArgs>
  >
