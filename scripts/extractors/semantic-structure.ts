import type { ComponentSemanticStructureRecord } from '../../src/types/components.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function readSemanticStructure(
  componentDirectory: string,
): Promise<ComponentSemanticStructureRecord[]> {
  const localesFile = path.join(componentDirectory, 'locales.ts')
  let modificationTime: number

  try {
    modificationTime = (await fs.stat(localesFile)).mtimeMs
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }

    throw error
  }

  const localesModule = await import(
    `${pathToFileURL(localesFile).href}?mtime=${modificationTime}`,
  ) as { locales: Record<'cn' | 'en', Record<string, string>> }
  const { en, cn } = localesModule.locales

  return [...new Set([...Object.keys(en), ...Object.keys(cn)])].map(key => ({
    key,
    description: en[key] ?? '',
    descriptionZh: cn[key] ?? '',
  }))
}
