import type { UpgradeCommand } from '#/upgrade.ts'
import type { PackageManager } from '@/args/upgrade.ts'
import { ANTDV_REPO_CLI } from '@/constants/repo.ts'

export const CLI_PACKAGE = `@${ANTDV_REPO_CLI}`
export const UPGRADE_TIMEOUT_MS = 120_000
export const VERIFY_TIMEOUT_MS = 10_000

const latestCliPackage = `${CLI_PACKAGE}@latest`

export const UPGRADE_COMMANDS: Record<PackageManager, UpgradeCommand> = {
  npm: {
    command: 'npm',
    args: ['install', '--global', latestCliPackage],
  },
  pnpm: {
    command: 'pnpm',
    args: ['add', '--global', latestCliPackage],
  },
  yarn: {
    command: 'yarn',
    args: ['global', 'add', latestCliPackage],
  },
  bun: {
    command: 'bun',
    args: ['add', '--global', latestCliPackage],
  },
}
