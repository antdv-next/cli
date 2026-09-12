import type { ArgsDef } from 'citty'

export const packageManagerOptions = ['npm', 'pnpm', 'yarn', 'bun'] as const
export type PackageManager = typeof packageManagerOptions[number]

export const upgradeArgs = {
  'package-manager': {
    type: 'enum',
    description: 'Package manager to use: npm, pnpm, yarn, or bun',
    options: [...packageManagerOptions],
  },
} satisfies ArgsDef
