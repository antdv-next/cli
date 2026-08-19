import type { ComponentPropRecord } from '../../src/types/components.ts'
import fs from 'node:fs/promises'

interface ComponentTokenMeta {
  token: string
  type: string
  desc: string
  descEn: string
}

export interface TokenMetaFile {
  global: Record<string, unknown>
  components: Record<string, unknown>
}

export interface TokenDefaultIndex {
  global: Map<string, string>
  components: Map<string, Map<string, string>>
}

export interface TokenFiles {
  tokenMeta: string
  token: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseTokenMetaFile(value: unknown, filename: string): TokenMetaFile {
  if (!isRecord(value) || !isRecord(value.components)) {
    throw new TypeError(`Invalid token metadata in ${filename}`)
  }

  return {
    global: isRecord(value.global) ? value.global : {},
    components: value.components,
  }
}

function parseComponentTokenMeta(value: unknown): ComponentTokenMeta | undefined {
  if (!isRecord(value) || typeof value.token !== 'string') {
    return undefined
  }

  return {
    token: value.token,
    type: typeof value.type === 'string' ? value.type : '',
    desc: typeof value.desc === 'string' ? value.desc : '',
    descEn: typeof value.descEn === 'string' ? value.descEn : '',
  }
}

function stringifyTokenDefault(value: unknown): string {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

function getTokenDefaultCandidate(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  if ('default' in value) {
    return value.default
  }
  if ('defaultValue' in value) {
    return value.defaultValue
  }
  if ('value' in value) {
    return value.value
  }

  return undefined
}

function setTokenDefault(
  index: TokenDefaultIndex,
  token: string,
  value: unknown,
  componentName?: string,
): void {
  const defaultValue = stringifyTokenDefault(value)

  if (componentName) {
    const componentDefaults = index.components.get(componentName) ?? new Map<string, string>()

    if (!componentDefaults.has(token)) {
      componentDefaults.set(token, defaultValue)
    }

    index.components.set(componentName, componentDefaults)
    return
  }

  if (!index.global.has(token)) {
    index.global.set(token, defaultValue)
  }
}

function createTokenDefaultIndex(
  tokenData: unknown,
  componentNames: Set<string>,
): TokenDefaultIndex {
  const index: TokenDefaultIndex = {
    global: new Map(),
    components: new Map(),
  }

  function visit(value: unknown, componentName?: string): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, componentName)
      }
      return
    }

    if (!isRecord(value)) {
      return
    }

    const token = typeof value.token === 'string'
      ? value.token
      : typeof value.name === 'string' ? value.name : undefined
    const tokenDefault = getTokenDefaultCandidate(value)

    if (token && tokenDefault !== undefined) {
      setTokenDefault(index, token, tokenDefault, componentName)
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      if (key === 'components' && isRecord(nestedValue)) {
        for (const [nestedComponentName, componentValue] of Object.entries(nestedValue)) {
          visit(componentValue, nestedComponentName)
        }
        continue
      }

      const nestedComponentName = componentNames.has(key) ? key : componentName
      const nestedDefault = getTokenDefaultCandidate(nestedValue)

      if (nestedDefault !== undefined) {
        setTokenDefault(index, key, nestedDefault, nestedComponentName)
      }

      visit(nestedValue, nestedComponentName)
    }
  }

  visit(tokenData)
  return index
}

async function readJsonFile(filename: string): Promise<unknown> {
  const source = await fs.readFile(filename, 'utf8')

  try {
    return JSON.parse(source)
  }
  catch {
    throw new Error(`Invalid JSON in ${filename}`)
  }
}

export async function readTokenData(tokenFiles: TokenFiles): Promise<{
  tokenMeta: TokenMetaFile
  tokenDefaults: TokenDefaultIndex
}> {
  const [rawTokenMeta, tokenData] = await Promise.all([
    readJsonFile(tokenFiles.tokenMeta),
    readJsonFile(tokenFiles.token),
  ])
  const tokenMeta = parseTokenMetaFile(rawTokenMeta, tokenFiles.tokenMeta)

  return {
    tokenMeta,
    tokenDefaults: createTokenDefaultIndex(
      tokenData,
      new Set(Object.keys(tokenMeta.components)),
    ),
  }
}

export function getComponentTokens(
  componentName: string,
  tokenMeta: TokenMetaFile,
  tokenDefaults: TokenDefaultIndex,
): ComponentPropRecord[] {
  const rawTokens = tokenMeta.components[componentName]

  if (!Array.isArray(rawTokens)) {
    return []
  }

  return rawTokens
    .map(parseComponentTokenMeta)
    .filter(token => token !== undefined)
    .map(token => ({
      name: token.token,
      type: token.type,
      default: tokenDefaults.components.get(componentName)?.get(token.token)
        ?? tokenDefaults.global.get(token.token)
        ?? '',
      description: token.descEn,
      descriptionZh: token.desc,
    }))
}

export function getGlobalTokens(
  tokenMeta: TokenMetaFile,
  tokenDefaults: TokenDefaultIndex,
): ComponentPropRecord[] {
  return Object.entries(tokenMeta.global)
    .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
    .map(([name, metadata]) => ({
      name,
      type: typeof metadata.type === 'string' ? metadata.type : '',
      default: tokenDefaults.global.get(name) ?? '',
      description: typeof metadata.descEn === 'string' ? metadata.descEn : '',
      descriptionZh: typeof metadata.desc === 'string' ? metadata.desc : '',
    }))
}
