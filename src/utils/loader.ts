import type { ChangelogFile } from '#/components.ts'
import type { ResolvedVersion } from '@/types.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { __dirname } from '@/constants/dirname.ts'

export function getDataPath(): string {
  return join(__dirname, '..', 'data')
}

export async function loadVersionMetaData(version: ResolvedVersion): Promise<ChangelogFile> {
  const versionsPath = join(getDataPath(), 'versions.json')
  const versionsIndex = JSON.parse(await readFile(versionsPath, 'utf-8'))
  if (!Object.values(versionsIndex[version.majorVersion]).includes(version.version)) {
    throw new Error(`v${version.version} not found`)
  }
  return JSON.parse(await readFile(join(getDataPath(), `v${version.version}.json`), 'utf-8')) as ChangelogFile
}
