import type { ArgsDef } from 'citty'

export const initArgs = {
  name: {
    type: 'positional',
    description: 'Project Name',
    default: 'antdv-next-project',
  },
  nuxt: {
    type: 'boolean',
    description: 'Whether to initialize the Nuxt project template',
    default: false,
  },
  git: {
    type: 'boolean',
    description: 'Whether or not to initialize the Git repository',
    default: true,
  },
} satisfies ArgsDef
