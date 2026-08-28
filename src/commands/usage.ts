import type { ComponentRecord } from '#/components.ts'
import type { AstNode, ComponentUsage, ParsedSourceUsage } from '@/types/usage'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineCommand } from 'citty'
import { Table } from 'console-table-printer'
import { glob } from 'glob'
import { parseSync } from 'oxc-parser'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import { tableBorderStyle } from '@/constants/table.ts'
import { loadVersionMetaData } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

function getJsxName(node: AstNode): string | undefined {
  if (node.type === 'JSXIdentifier' && typeof node.name === 'string')
    return node.name

  if (node.type === 'JSXMemberExpression') {
    const object = getJsxName(node.object!)
    const property = getJsxName(node.property!)
    return object && property ? `${object}.${property}` : undefined
  }

  return undefined
}

function collectJsxTagNames(program: unknown): string[] {
  const tags: { name: string, start: number }[] = []
  const nodes: unknown[] = [program]
  const visited = new WeakSet<object>()

  while (nodes.length) {
    const value = nodes.pop() as AstNode
    if (!value || typeof value !== 'object' || visited.has(value))
      continue

    visited.add(value)

    if (Array.isArray(value)) {
      nodes.push(...value)
      continue
    }

    const node = value as AstNode
    if (node.type === 'JSXOpeningElement') {
      const name = getJsxName(node.name as AstNode)
      if (name)
        tags.push({ name, start: node.start ?? 0 })
    }

    for (const child of Object.values(node))
      nodes.push(child)
  }

  return tags.sort((a, b) => a.start - b.start).map(tag => tag.name)
}

function extractVueTemplate(source: string): string {
  const openingTag = /<template(?:\s[^>]*)?>/i.exec(source)
  if (!openingTag)
    return ''

  const start = openingTag.index + openingTag[0].length
  const end = source.lastIndexOf('</template>')
  return end >= start ? source.slice(start, end) : ''
}

function extractVueOpeningTagNames(template: string): string[] {
  const tags: string[] = []
  let index = 0

  while (index < template.length) {
    if (template.startsWith('<!--', index)) {
      const commentEnd = template.indexOf('-->', index + 4)
      index = commentEnd === -1 ? template.length : commentEnd + 3
      continue
    }

    if (template.startsWith('{{', index)) {
      const interpolationEnd = template.indexOf('}}', index + 2)
      index = interpolationEnd === -1 ? template.length : interpolationEnd + 2
      continue
    }

    if (template[index] !== '<') {
      index += 1
      continue
    }

    let cursor = index + 1
    while (/\s/.test(template[cursor] ?? ''))
      cursor += 1

    const isClosingOrSpecial = ['/', '!', '?'].includes(template[cursor] ?? '')
    if (isClosingOrSpecial)
      cursor += 1

    const nameStart = cursor
    while (/[\w.$-]/.test(template[cursor] ?? ''))
      cursor += 1

    const name = template.slice(nameStart, cursor)
    if (!isClosingOrSpecial && /^[A-Z][\w$]*(?:\.[\w$]+)*$/.test(name))
      tags.push(name)

    let quote = ''
    while (cursor < template.length) {
      const character = template[cursor]!
      if (quote) {
        if (character === quote)
          quote = ''
      }
      else if (character === '"' || character === '\'') {
        quote = character
      }
      else if (character === '>') {
        cursor += 1
        break
      }
      cursor += 1
    }
    index = cursor
  }

  return tags
}

function parseVueTagNames(filePath: string, source: string): string[] {
  const template = extractVueTemplate(source)
  const jsx = extractVueOpeningTagNames(template)
    .map(tag => `<${tag} />`)
    .join('')

  if (!jsx)
    return []

  const result = parseSync(`${filePath}.tsx`, `<>${jsx}</>`, { lang: 'tsx' })
  return collectJsxTagNames(result.program)
}

function collectAntdvImports(program: unknown): Pick<ParsedSourceUsage, 'namedImports' | 'namespaceImports'> {
  const namedImports = new Map<string, string>()
  const namespaceImports = new Set<string>()
  const body = (program as { body?: AstNode[] } | undefined)?.body ?? []

  for (const declaration of body) {
    if (declaration.type !== 'ImportDeclaration'
      || declaration.importKind === 'type'
      || declaration.source?.value !== 'antdv-next') {
      continue
    }

    for (const specifier of declaration.specifiers ?? []) {
      const local = specifier.local!.name as string
      if (!local || specifier.importKind === 'type')
        continue

      if (specifier.type === 'ImportSpecifier') {
        const imported = specifier.imported!.name as string
        if (imported)
          namedImports.set(local!, imported)
      }
      else if (specifier.type === 'ImportNamespaceSpecifier') {
        namespaceImports.add(local)
      }
    }
  }

  return { namedImports, namespaceImports }
}

function mergeAntdvImports(target: Pick<ParsedSourceUsage, 'namedImports' | 'namespaceImports'>, program: unknown): void {
  const imports = collectAntdvImports(program)
  imports.namedImports.forEach((imported, local) => target.namedImports.set(local, imported))
  imports.namespaceImports.forEach(local => target.namespaceImports.add(local))
}

function parseVueScripts(filePath: string, source: string): Pick<ParsedSourceUsage, 'namedImports' | 'namespaceImports'> {
  const imports = {
    namedImports: new Map<string, string>(),
    namespaceImports: new Set<string>(),
  }
  const scriptBlockRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi

  for (const match of source.matchAll(scriptBlockRe)) {
    const attributes = match[1] ?? ''
    const script = match[2] ?? ''
    const lang = /\blang=["'](tsx?|jsx?)["']/i.exec(attributes)?.[1]?.toLowerCase()
    const parserLang = lang === 'tsx' || lang === 'jsx' ? lang : lang === 'js' ? 'js' : 'ts'
    const program = parseSync(`${filePath}.${parserLang}`, script, { lang: parserLang }).program
    mergeAntdvImports(imports, program)
  }

  return imports
}

function parseSourceUsage(filePath: string, source: string): ParsedSourceUsage {
  if (filePath.endsWith('.vue')) {
    return {
      tags: parseVueTagNames(filePath, source),
      ...parseVueScripts(filePath, source),
    }
  }

  const result = parseSync(filePath, source, { lang: 'tsx' })
  return {
    tags: collectJsxTagNames(result.program),
    ...collectAntdvImports(result.program),
  }
}

export function parseComponentTags(filePath: string, source: string): string[] {
  return parseSourceUsage(filePath, source).tags.map(tag => tag.split('.')[0]!)
}

function createComponentLookup(components: ComponentRecord[]): Map<string, string> {
  const componentLookup = new Map<string, string>()

  for (const component of components) {
    componentLookup.set(component.name, component.name)
    component.subComponents?.forEach((subComponent) => {
      if (/^[A-Z][\w$]*$/.test(subComponent) && !componentLookup.has(subComponent))
        componentLookup.set(subComponent, component.name)
    })
  }

  return componentLookup
}

function resolveMetadataComponent(exported: string, components: ComponentRecord[], lookup: Map<string, string>): string | undefined {
  const exact = lookup.get(exported)
  if (exact)
    return exact

  return components
    .map(component => component.name)
    .sort((a, b) => b.length - a.length)
    .find(component => exported.startsWith(component))
}

function resolveUsedComponent(tag: string, parsed: ParsedSourceUsage, components: ComponentRecord[], lookup: Map<string, string>): string | undefined {
  const [root, member] = tag.split('.')
  if (!root)
    return undefined

  const imported = parsed.namedImports.get(root)
  if (imported)
    return resolveMetadataComponent(imported, components, lookup)

  if (parsed.namespaceImports.has(root) && member)
    return resolveMetadataComponent(member, components, lookup)

  if (root.startsWith('A'))
    return resolveMetadataComponent(root.slice(1), components, lookup)

  return undefined
}

export async function scanProjectUsage(projectRoot: string, components: ComponentRecord[]): Promise<ComponentUsage[]> {
  const files = await glob('./**/*.{vue,tsx}', {
    cwd: projectRoot,
    ignore: ['**/node_modules/**'],
    nodir: true,
  })
  const componentLookup = createComponentLookup(components)
  const usage = new Map<string, { count: number, files: Set<string> }>()

  for (const file of files.sort()) {
    const source = await readFile(resolve(projectRoot, file), 'utf8')
    const parsed = parseSourceUsage(file, source)

    for (const tag of parsed.tags) {
      const component = resolveUsedComponent(tag, parsed, components, componentLookup)
      if (!component)
        continue

      const entry = usage.get(component) ?? { count: 0, files: new Set<string>() }
      entry.count += 1
      entry.files.add(file)
      usage.set(component, entry)
    }
  }

  return [...usage]
    .map(([component, item]) => ({
      component,
      count: item.count,
      files: [...item.files],
    }))
    .sort((a, b) => a.component.localeCompare(b.component))
}

function outputTable(usages: ComponentUsage[]): string {
  const table = new Table({
    style: tableBorderStyle,
    columns: [
      { name: 'Component', alignment: 'left' },
      { name: 'Usage', alignment: 'right' },
      { name: 'Files', alignment: 'right' },
    ],
  })

  usages.forEach((usage) => {
    table.addRow({
      Component: usage.component,
      Usage: usage.count,
      Files: usage.files.length,
    })
  })

  return table.render()
}

function outputMarkdown(usages: ComponentUsage[]): string {
  const rows = usages.map(usage => `| ${usage.component} | ${usage.count} | ${usage.files.length} |`)
  return [
    '| Component | Usage | Files |',
    '| --- | ---: | ---: |',
    ...rows,
  ].join('\n')
}

export default defineCommand({
  meta: {
    name: 'usage',
    description: 'Scan project for antdv-next component usage statistics',
  },
  args: defaultArgs,
  async run({ args }) {
    const config = resolveConfig(args)
    const version = await resolveVersion(config)
    const metaData = await loadVersionMetaData(version)
    const usages = await scanProjectUsage(config.cwd, metaData.components)

    output({
      text: outputTable(usages),
      markdown: outputMarkdown(usages),
      json: usages,
    }, args.format)
  },
})
