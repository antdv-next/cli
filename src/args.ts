import type { ParsedArgs } from 'citty'

export const defaultArgs = {
    cwd: {
        type: 'string',
        description: 'Current working directory',
        alias: 'c',
        default: process.cwd(),
    },
    format: {
        type: 'string',
        description: 'Output format: json, text, or markdown',
        alias: 'f',
        default: 'text',
    },
} as const

type DeepWriteable<T> = {
    -readonly [P in keyof T]: T[P] extends object ? DeepWriteable<T[P]> : T[P];
}

export type CommandArgs = ParsedArgs<DeepWriteable<typeof defaultArgs>>
