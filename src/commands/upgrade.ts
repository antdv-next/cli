import type { AlreadyUpToDateResult, UpgradeSuccessResult } from '#/upgrade.ts'
import process from 'node:process'
import { defineCommand } from 'citty'
import semver from 'semver'
import { defaultArgs } from '@/args/default.ts'
import { upgradeArgs } from '@/args/upgrade.ts'
import { CLI_PACKAGE } from '@/constants/upgrade.ts'
import { getLatestVersion } from '@/utils/check.ts'
import { logError } from '@/utils/error.ts'
import {
  detectPackageManager,
  getUpgradeCommand,
  outputUpgradeResult,
  runUpgradeCommand,
  verifyInstalledCliVersion,
} from '@/utils/upgrade.ts'

export default defineCommand({
  meta: {
    name: 'upgrade',
    description: 'Upgrade the CLI to the latest version',
  },
  args: {
    ...defaultArgs,
    ...upgradeArgs,
  },
  async run({ args }) {
    const currentVersion = __CLI_VERSION__

    let latestVersion: string
    try {
      latestVersion = await getLatestVersion()
    }
    catch {
      logError({
        message: 'Failed to fetch the latest CLI version from the npm registry',
        suggestion: 'Check your network connection and try again.',
      }, args.format)
      process.exitCode = 1
      return
    }

    if (!semver.valid(latestVersion)) {
      logError({
        message: `Unable to determine the latest CLI version: ${latestVersion}`,
        suggestion: 'Check your network connection and try again.',
      }, args.format)
      process.exitCode = 1
      return
    }

    if (semver.valid(currentVersion) && semver.gte(currentVersion, latestVersion)) {
      const result: AlreadyUpToDateResult = {
        currentVersion,
        status: 'up-to-date',
      }
      outputUpgradeResult(result, args.format)
      return
    }

    const packageManager = args['package-manager'] ?? detectPackageManager()
    const upgradeCommand = getUpgradeCommand(packageManager)
    const printableCommand = `${upgradeCommand.command} ${upgradeCommand.args.join(' ')}`

    if (args.format !== 'json') {
      console.log(`Upgrading ${CLI_PACKAGE}: v${currentVersion} → v${latestVersion}`)
      console.log(`Running: ${printableCommand}`)
    }

    try {
      await runUpgradeCommand(upgradeCommand, args.format)
    }
    catch {
      logError({
        message: `Upgrade command failed: ${printableCommand}`,
        suggestion: `Run manually: ${printableCommand}`,
      }, args.format)
      process.exitCode = 2
      return
    }

    // `--version` reports this CLI version; `--ver` selects antdv-next data.
    const installedVersion = await verifyInstalledCliVersion()
    if (installedVersion && !semver.gt(installedVersion, currentVersion)) {
      logError({
        message: `Upgrade command completed but the version is still v${installedVersion}`,
        suggestion: `Check your global install permissions or run manually: ${printableCommand}`,
      }, args.format)
      process.exitCode = 2
      return
    }

    const result: UpgradeSuccessResult = {
      previousVersion: currentVersion,
      newVersion: installedVersion ?? latestVersion,
      packageManager,
      status: 'upgraded',
      verified: installedVersion !== null,
    }
    outputUpgradeResult(result, args.format)
  },
})
