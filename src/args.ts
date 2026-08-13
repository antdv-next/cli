import type { ArgsDef, ParsedArgs } from 'citty'

export const OUTPUT_FORMATS = ['text', 'markdown', 'json'] as const
export type OutputFormat = typeof OUTPUT_FORMATS[number]

export const defaultArgs = {
    cwd: {
        type: 'string',
        description: 'Current working directory',
        alias: 'c',
        default: process.cwd(),
    },
    format: {
        type: 'enum',
        description: 'Output format',
        alias: 'f',
        default: 'text' as const,
        options: [...OUTPUT_FORMATS],
    },
} satisfies ArgsDef

export type CommandArgs = ParsedArgs<typeof defaultArgs>
