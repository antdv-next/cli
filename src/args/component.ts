import type { ArgsDef } from 'citty'

export const componentArgs = {
  component: {
    type: 'positional',
    description: 'Specifies the target Ant Design Vue Next component name (e.g., `Button`). Determines which UI component template to generate.',
    default: '',
  },
} satisfies ArgsDef
