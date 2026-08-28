import type { ChangelogFile } from '../src/types/components.ts'
import { runCommand } from 'citty'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import changelogCommand from '../src/commands/changelog.ts'
import { loadVersionMetaData } from '../src/utils/loader.ts'
import { resolveVersion } from '../src/utils/version.ts'

vi.mock('../src/utils/loader.ts', () => ({
  loadVersionMetaData: vi.fn(),
}))

vi.mock('../src/utils/version.ts', () => ({
  resolveVersion: vi.fn(),
}))

const mockedLoadVersionMetaData = vi.mocked(loadVersionMetaData)
const mockedResolveVersion = vi.mocked(resolveVersion)

function emptySnapshot(version: string): ChangelogFile {
  return {
    version,
    majorVersion: 'v1',
    globalTokens: [],
    components: [],
    changelog: [],
  }
}

beforeEach(() => {
  mockedLoadVersionMetaData.mockReset()
  mockedResolveVersion.mockReset()
  mockedResolveVersion.mockImplementation(async config => ({
    version: config.version,
    majorVersion: 'v1',
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('changelog command', () => {
  it('resolves both versions and loads their snapshots', async () => {
    mockedLoadVersionMetaData.mockImplementation(async version => emptySnapshot(version.version))
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(changelogCommand, {
      rawArgs: ['1.0.5', '1.5.2', '--format', 'json'],
    })

    expect(mockedResolveVersion).toHaveBeenCalledTimes(2)
    expect(mockedResolveVersion).toHaveBeenNthCalledWith(1, expect.objectContaining({ version: '1.0.5' }))
    expect(mockedResolveVersion).toHaveBeenNthCalledWith(2, expect.objectContaining({ version: '1.5.2' }))
    expect(mockedLoadVersionMetaData).toHaveBeenNthCalledWith(1, {
      version: '1.0.5',
      majorVersion: 'v1',
    })
    expect(mockedLoadVersionMetaData).toHaveBeenNthCalledWith(2, {
      version: '1.5.2',
      majorVersion: 'v1',
    })

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({
      from: '1.0.5',
      to: '1.5.2',
      diffs: [],
    }, null, 2))
  })

  it('stops with an error when either snapshot cannot be loaded', async () => {
    mockedLoadVersionMetaData.mockImplementation(async (version) => {
      if (version.version === '1.5.2') {
        throw new Error('v1.5.2 not found')
      }
      return emptySnapshot(version.version)
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await runCommand(changelogCommand, {
      rawArgs: ['1.0.5', '1.5.2', '--format', 'json'],
    })

    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify({
      message: 'v1.5.2 not found',
    }, null, 2))
  })
})
