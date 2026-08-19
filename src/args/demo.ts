import type { ArgsDef } from 'citty'
import { componentArgs } from '@/args/component.ts'

export const demoArgs = {
  ...componentArgs,
  name: {
    type: 'positional',
    description: 'Fetches a specific demo or example for the selected antdv-next component.',
    default: '',
  },
} satisfies ArgsDef
