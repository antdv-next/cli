import type { ResolvedConfig } from '../src/types'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPackageInfo } from 'local-pkg'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveFallBack, resolveVersion } from '../src/utils/version'

vi.mock('local-pkg', () => ({
  getPackageInfo: vi.fn(),
}))

const dataPath = join(import.meta.dirname, '.version-test-data')
const mockedGetPackageInfo = vi.mocked(getPackageInfo)

function createConfig(version = '', cwd = '/project'): ResolvedConfig {
  return {
    cwd,
    format: 'text',
    version,
  }
}

beforeEach(async () => {
  mockedGetPackageInfo.mockReset()
  await mkdir(dataPath, { recursive: true })
  await Promise.all([
    writeFile(join(dataPath, 'v1.2.3.json'), '{}'),
    writeFile(join(dataPath, 'v1.5.1.json'), '{}'),
    writeFile(join(dataPath, 'v1.5.2.json'), '{}'),
    writeFile(join(dataPath, 'v1.json'), '{}'),
  ])
})

afterEach(async () => {
  await rm(dataPath, { force: true, recursive: true })
})

describe('resolveVersion', () => {
  it('resolves and normalizes an explicitly provided version', async () => {
    await expect(resolveVersion(createConfig(' v1.2.3 '), dataPath)).resolves.toEqual({
      version: '1.2.3',
      majorVersion: 'v1',
    })
    expect(mockedGetPackageInfo).not.toHaveBeenCalled()
  })

  it('resolves a missing patch to the greatest version in the same minor', async () => {
    await expect(resolveVersion(createConfig('v1.5.4'), dataPath)).resolves.toEqual({
      version: '1.5.2',
      majorVersion: 'v1',
    })
    expect(mockedGetPackageInfo).not.toHaveBeenCalled()
  })

  it('resolves a missing minor to the latest version in the same major', async () => {
    await expect(resolveVersion(createConfig('v1.6.0'), dataPath)).resolves.toEqual({
      version: '1.5.2',
      majorVersion: 'v1',
    })
    expect(mockedGetPackageInfo).not.toHaveBeenCalled()
  })

  it('returns an empty sentinel when an explicit version cannot be coerced', async () => {
    await expect(resolveVersion(createConfig('latest'), dataPath)).resolves.toEqual({
      version: '',
      majorVersion: 'v0',
    })
    expect(mockedGetPackageInfo).not.toHaveBeenCalled()
  })

  it('resolves antdv-next from the provided project path', async () => {
    mockedGetPackageInfo.mockResolvedValue({
      name: 'antdv-next',
      version: '2.4.1',
      rootPath: '/project/node_modules/antdv-next',
      packageJsonPath: '/project/node_modules/antdv-next/package.json',
      packageJson: {},
    })

    await expect(resolveVersion(createConfig(), dataPath)).resolves.toEqual({
      version: '2.4.1',
      majorVersion: 'v2',
    })
    expect(mockedGetPackageInfo).toHaveBeenCalledWith('antdv-next', {
      paths: ['/project'],
    })
  })
})

describe('resolveFallBack', () => {
  it('returns the greatest semantic version represented by a data file', async () => {
    await Promise.all([
      writeFile(join(dataPath, 'v1.9.9.json'), '{}'),
      writeFile(join(dataPath, 'v2.0.0-beta.1.json'), '{}'),
      writeFile(join(dataPath, 'v2.0.0.json'), '{}'),
      writeFile(join(dataPath, 'v2.json'), '{}'),
      writeFile(join(dataPath, 'version.json'), '{}'),
    ])

    await expect(resolveFallBack(dataPath)).resolves.toEqual({
      version: '2.0.0',
      majorVersion: 'v2',
    })
  })

  it('throws when the data directory has no valid version files', async () => {
    await rm(dataPath, { recursive: true })
    await mkdir(dataPath)
    await writeFile(join(dataPath, 'version.json'), '{}')

    await expect(resolveFallBack(dataPath)).rejects.toThrow(
      `No valid antdv-next version files found in ${dataPath}`,
    )
  })
})
