import type { ChangelogFile, ComponentRecord } from '#/components.ts'
import type { ResolvedVersion } from '@/types.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { __dirname } from '@/constants/dirname.ts'
import capitalize from '@/utils/capitalize.ts'

export function getDataPath(): string {
  return join(__dirname, '..', 'data')
}

export async function loadVersionMetaData(version: ResolvedVersion, dataPath = getDataPath()): Promise<ChangelogFile> {
  const versionsPath = join(dataPath, 'versions.json')
  const versionsIndex = JSON.parse(await readFile(versionsPath, 'utf-8')) as Record<string, Record<string, string>>
  const majorVersions = versionsIndex[version.majorVersion]

  if (!majorVersions || !Object.values(majorVersions).includes(version.version)) {
    throw new Error(`v${version.version} not found`)
  }
  return JSON.parse(await readFile(join(dataPath, `v${version.version}.json`), 'utf-8')) as ChangelogFile
}

export function loadComponent(name: string, components: ChangelogFile): ComponentRecord {
  const component = components.components.filter(c => c.name === capitalize(name))?.at(0)

  if (!component) {
    throw new Error(`Component ${name} not found`)
  }

  return component
}
