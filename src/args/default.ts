import type { ArgsDef } from 'citty'

export const OUTPUT_FORMATS = ['text', 'markdown', 'json'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

export const defaultArgs = {
  cwd: {
    type: 'string',
    description: 'Current working directory',
    alias: 'c',
    default: process.cwd(),
  },
  ver: {
    type: 'string',
    description: 'Target antdv-next version (e.g. 1.0.0)',
    default: '',
  },
  format: {
    type: 'enum',
    description: 'Output format',
    alias: 'f',
    default: 'text' as const,
    options: [...OUTPUT_FORMATS],
  },
} satisfies ArgsDef
