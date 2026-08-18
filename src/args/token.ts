import type { ArgsDef } from 'citty'

export const tokenArgs = {
    component: {
        type: 'positional',
        description: 'Query Design Tokens (global or component-level)',
        default: '',
    },
} satisfies ArgsDef
