import type { Output } from 'tinyexec'
import { runCommand } from 'citty'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import upgradeCommand from '../src/commands/upgrade.ts'
import {
  detectPackageManager,
  formatUpgradeMarkdown,
  getUpgradeCommand,
  parseVersionOutput,
} from '../src/utils/upgrade.ts'

const mocks = vi.hoisted(() => ({
  getLatestVersion: vi.fn(),
  x: vi.fn(),
}))

vi.mock('../src/utils/check.ts', () => ({
  getLatestVersion: mocks.getLatestVersion,
}))

vi.mock('tinyexec', () => ({
  x: mocks.x,
}))

function commandOutput(stdout = ''): Output {
  return {
    exitCode: 0,
    stderr: '',
    stdout,
  }
}

beforeEach(() => {
  mocks.getLatestVersion.mockReset()
  mocks.x.mockReset()
})

afterEach(() => {
  process.exitCode = undefined
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('upgrade command helpers', () => {
  it('detects the package manager from the user agent before the executable path', () => {
    expect(detectPackageManager({
      npm_config_user_agent: 'pnpm/11.9.0 npm/? node/v26.0.0',
      npm_execpath: '/usr/local/lib/node_modules/npm/bin/npm-cli.js',
    })).toBe('pnpm')
  })

  it('detects the package manager from a Windows executable path', () => {
    expect(detectPackageManager({
      npm_execpath: 'C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\yarn\\bin\\yarn.js',
    })).toBe('yarn')
  })

  it('falls back to npm when no package manager can be detected', () => {
    expect(detectPackageManager({})).toBe('npm')
  })

  it('returns the global install command for every supported package manager', () => {
    expect(getUpgradeCommand('npm')).toEqual({
      command: 'npm',
      args: ['install', '--global', '@antdv-next/cli@latest'],
    })
    expect(getUpgradeCommand('pnpm')).toEqual({
      command: 'pnpm',
      args: ['add', '--global', '@antdv-next/cli@latest'],
    })
    expect(getUpgradeCommand('yarn')).toEqual({
      command: 'yarn',
      args: ['global', 'add', '@antdv-next/cli@latest'],
    })
    expect(getUpgradeCommand('bun')).toEqual({
      command: 'bun',
      args: ['add', '--global', '@antdv-next/cli@latest'],
    })
  })

  it('extracts a semantic version from CLI output', () => {
    expect(parseVersionOutput('v1.2.3-beta.2\n')).toBe('1.2.3-beta.2')
    expect(parseVersionOutput('@antdv-next/cli 2.0.0')).toBe('2.0.0')
    expect(parseVersionOutput('unknown')).toBeNull()
  })

  it('formats an upgrade result as markdown', () => {
    expect(formatUpgradeMarkdown({
      previousVersion: '1.0.0',
      newVersion: '1.1.0',
      packageManager: 'pnpm',
      status: 'upgraded',
      verified: true,
    })).toContain('| Package Manager | pnpm |')
  })
})

describe('upgrade command', () => {
  it('does not install anything when the CLI version is up to date', async () => {
    mocks.getLatestVersion.mockResolvedValue('0.0.0-beta.5')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(upgradeCommand, { rawArgs: [] })

    expect(mocks.x).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('Already up to date: v0.0.0-beta.5')
    expect(process.exitCode).toBeUndefined()
  })

  it('uses the requested package manager and verifies the CLI with --version', async () => {
    mocks.getLatestVersion.mockResolvedValue('0.0.0-beta.6')
    mocks.x
      .mockResolvedValueOnce(commandOutput())
      .mockResolvedValueOnce(commandOutput('0.0.0-beta.6\n'))
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(upgradeCommand, {
      rawArgs: ['--package-manager', 'pnpm'],
    })

    expect(mocks.x).toHaveBeenNthCalledWith(1, 'pnpm', [
      'add',
      '--global',
      '@antdv-next/cli@latest',
    ], expect.objectContaining({
      nodePath: false,
      throwOnError: true,
      timeout: 120_000,
      nodeOptions: expect.objectContaining({ stdio: 'inherit' }),
    }))
    expect(mocks.x).toHaveBeenNthCalledWith(2, 'antdv', ['--version'], expect.objectContaining({
      nodePath: false,
      timeout: 10_000,
      nodeOptions: expect.objectContaining({ stdio: 'pipe' }),
    }))
    expect(consoleSpy).toHaveBeenCalledWith('Successfully upgraded to v0.0.0-beta.6')
  })

  it('uses the detected package manager when none is explicitly requested', async () => {
    vi.stubEnv('npm_config_user_agent', 'bun/1.2.0 node/v26.0.0')
    mocks.getLatestVersion.mockResolvedValue('0.0.0-beta.6')
    mocks.x
      .mockResolvedValueOnce(commandOutput())
      .mockResolvedValueOnce(commandOutput('0.0.0-beta.6'))
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(upgradeCommand, { rawArgs: [] })

    expect(mocks.x).toHaveBeenNthCalledWith(1, 'bun', [
      'add',
      '--global',
      '@antdv-next/cli@latest',
    ], expect.any(Object))
  })

  it('keeps JSON output clean when CLI version verification fails', async () => {
    mocks.getLatestVersion.mockResolvedValue('0.0.0-beta.6')
    mocks.x
      .mockResolvedValueOnce(commandOutput())
      .mockRejectedValueOnce(new Error('antdv not found'))
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(upgradeCommand, {
      rawArgs: ['--format', 'json', '--package-manager', 'npm'],
    })

    expect(mocks.x).toHaveBeenNthCalledWith(1, 'npm', expect.any(Array), expect.objectContaining({
      nodeOptions: expect.objectContaining({ stdio: 'pipe' }),
    }))
    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(consoleSpy.mock.calls[0]![0]))).toMatchObject({
      newVersion: '0.0.0-beta.6',
      status: 'upgraded',
      verified: false,
    })
  })

  it('sets an error exit code when fetching the latest version fails', async () => {
    mocks.getLatestVersion.mockRejectedValue(new Error('offline'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await runCommand(upgradeCommand, { rawArgs: [] })

    expect(mocks.x).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
    expect(errorSpy).toHaveBeenCalledWith('Error: Failed to fetch the latest CLI version from the npm registry')
  })

  it('sets an error exit code and prints a manual command when installation fails', async () => {
    mocks.getLatestVersion.mockResolvedValue('0.0.0-beta.6')
    mocks.x.mockRejectedValueOnce(new Error('permission denied'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(upgradeCommand, {
      rawArgs: ['--package-manager', 'yarn'],
    })

    expect(process.exitCode).toBe(2)
    expect(errorSpy).toHaveBeenCalledWith('Suggestion: Run manually: yarn global add @antdv-next/cli@latest')
  })

  it('treats an unchanged verified CLI version as an upgrade failure', async () => {
    mocks.getLatestVersion.mockResolvedValue('0.0.0-beta.6')
    mocks.x
      .mockResolvedValueOnce(commandOutput())
      .mockResolvedValueOnce(commandOutput('0.0.0-beta.5'))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await runCommand(upgradeCommand, { rawArgs: [] })

    expect(process.exitCode).toBe(2)
  })
})
