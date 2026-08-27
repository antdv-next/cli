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
  it('starts loading both snapshots before either one resolves', async () => {
    const pending = new Map<string, (snapshot: ChangelogFile) => void>()
    mockedLoadVersionMetaData.mockImplementation((version) => {
      return new Promise(resolve => pending.set(version.version, resolve))
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const execution = runCommand(changelogCommand, {
      rawArgs: ['1.0.5', '1.5.2', '--format', 'json'],
    })

    await vi.waitFor(() => expect(mockedLoadVersionMetaData).toHaveBeenCalledTimes(2))
    expect([...pending.keys()]).toEqual(['1.0.5', '1.5.2'])

    pending.get('1.0.5')!(emptySnapshot('1.0.5'))
    pending.get('1.5.2')!(emptySnapshot('1.5.2'))
    await execution

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
