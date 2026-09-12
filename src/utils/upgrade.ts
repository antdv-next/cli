import type { UpgradeCommand, UpgradeResult } from '#/upgrade.ts'
import type { OutputFormat } from '@/args/default.ts'
import type { PackageManager } from '@/args/upgrade.ts'
import process from 'node:process'
import semver from 'semver'
import { x } from 'tinyexec'
import { packageManagerOptions } from '@/args/upgrade.ts'
import {
  UPGRADE_COMMANDS,
  UPGRADE_TIMEOUT_MS,
  VERIFY_TIMEOUT_MS,
} from '@/constants/upgrade.ts'
import { output } from '@/utils/output.ts'

function packageManagerFromUserAgent(userAgent: string | undefined): PackageManager | undefined {
  if (!userAgent)
    return undefined

  const name = userAgent.trim().split(/[\s/]/, 1)[0]?.toLowerCase()
  return packageManagerOptions.find(manager => manager === name)
}

function packageManagerFromExecPath(execPath: string | undefined): PackageManager | undefined {
  if (!execPath)
    return undefined

  const normalizedPath = execPath.toLowerCase().replaceAll('\\', '/')
  const executableName = normalizedPath.split('/').at(-1) ?? ''
  const executablePackageManager = packageManagerOptions.find(manager => (
    executableName === manager
    || executableName.startsWith(`${manager}.`)
    || executableName.startsWith(`${manager}-`)
  ))

  if (executablePackageManager)
    return executablePackageManager

  return packageManagerOptions.find((manager) => {
    const pattern = new RegExp(`(?:^|[/._-])${manager}(?:[/._-]|$)`)
    return pattern.test(normalizedPath)
  })
}

export function detectPackageManager(env: NodeJS.ProcessEnv = process.env): PackageManager {
  return packageManagerFromUserAgent(env.npm_config_user_agent)
    ?? packageManagerFromExecPath(env.npm_execpath)
    ?? 'npm'
}

export function getUpgradeCommand(packageManager: PackageManager): UpgradeCommand {
  return UPGRADE_COMMANDS[packageManager]
}

export function parseVersionOutput(value: string): string | null {
  const candidates = value.match(/v?\d+\.\d+\.\d+(?:-[\dA-Za-z.-]+)?(?:\+[\dA-Za-z.-]+)?/g) ?? []

  for (const candidate of candidates) {
    const cleaned = semver.clean(candidate)
    if (cleaned && semver.valid(cleaned))
      return cleaned
  }

  return null
}

export function formatUpgradeMarkdown(result: UpgradeResult): string {
  const lines = [
    '## Upgrade',
    '',
    '| Field | Value |',
    '|---|---|',
  ]

  if (result.status === 'up-to-date') {
    lines.push(`| Current Version | ${result.currentVersion} |`)
    lines.push('| Status | Already up to date |')
  }
  else {
    lines.push(`| Previous Version | ${result.previousVersion} |`)
    lines.push(`| New Version | ${result.newVersion} |`)
    lines.push(`| Package Manager | ${result.packageManager} |`)
    lines.push(`| Verified | ${result.verified ? 'Yes' : 'No'} |`)
  }

  return lines.join('\n')
}

export function outputUpgradeResult(result: UpgradeResult, format: OutputFormat): void {
  const text = result.status === 'up-to-date'
    ? `Already up to date: v${result.currentVersion}`
    : result.verified
      ? `Successfully upgraded to v${result.newVersion}`
      : `Upgrade command completed, but the installed version could not be verified. Expected v${result.newVersion}`

  output({
    json: result,
    markdown: formatUpgradeMarkdown(result),
    text,
  }, format)
}

export async function runUpgradeCommand(
  upgradeCommand: UpgradeCommand,
  format: OutputFormat,
): Promise<void> {
  await x(upgradeCommand.command, upgradeCommand.args, {
    nodePath: false,
    throwOnError: true,
    timeout: UPGRADE_TIMEOUT_MS,
    nodeOptions: {
      stdio: format === 'json' ? 'pipe' : 'inherit',
      ...(process.platform === 'win32' ? { shell: true } : {}),
    },
  })
}

export async function verifyInstalledCliVersion(): Promise<string | null> {
  try {
    const result = await x('antdv', ['--version'], {
      nodePath: false,
      throwOnError: true,
      timeout: VERIFY_TIMEOUT_MS,
      nodeOptions: {
        stdio: 'pipe',
        ...(process.platform === 'win32' ? { shell: true } : {}),
      },
    })

    return parseVersionOutput(result.stdout)
  }
  catch {
    return null
  }
}
