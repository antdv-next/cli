import type { ArgsDef } from 'citty'

export const changelogArgs = {
  from: {
    type: 'positional',
    description: 'Source antdv-next version (e.g. 1.0.5)',
    required: true,
  },
  to: {
    type: 'positional',
    description: 'Target antdv-next version (e.g. 1.5.2)',
    required: true,
  },
  component: {
    type: 'positional',
    description: 'Optional component to compare (e.g. Select)',
    required: false,
  },
} satisfies ArgsDef
