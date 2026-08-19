import type { ComponentDemoRecord } from '../../src/types/components.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { logStep } from '../utils/log.ts'
import { normalizeHeadingTitle, parseHeadings } from './markdown.ts'

interface DemoReference {
  src: string
  title: string
}

interface ElementBlock {
  start: number
  openingTag: string
  content: string
  fullContent: string
}

function findElementStart(source: string, tagName: string, fromIndex: number): number {
  const marker = `<${tagName}`
  let index = source.indexOf(marker, fromIndex)

  while (index !== -1) {
    const boundary = source[index + marker.length]

    if (boundary === '>' || boundary === '/' || boundary === ' ' || boundary === '\t' || boundary === '\n' || boundary === '\r') {
      return index
    }

    index = source.indexOf(marker, index + marker.length)
  }

  return -1
}

function extractElementBlocks(source: string, tagName: string): ElementBlock[] {
  const blocks: ElementBlock[] = []
  let searchIndex = 0

  while (searchIndex < source.length) {
    const start = findElementStart(source, tagName, searchIndex)

    if (start === -1) {
      break
    }

    const openingEnd = source.indexOf('>', start)

    if (openingEnd === -1) {
      break
    }

    const openingTag = source.slice(start, openingEnd + 1)

    if (openingTag.trimEnd().endsWith('/>')) {
      blocks.push({
        start,
        openingTag,
        content: '',
        fullContent: openingTag,
      })
      searchIndex = openingEnd + 1
      continue
    }

    let depth = 1
    let cursor = openingEnd + 1
    let closingStart = -1
    let closingEnd = -1

    while (depth > 0) {
      const nextOpening = findElementStart(source, tagName, cursor)
      const nextClosing = source.indexOf(`</${tagName}`, cursor)

      if (nextClosing === -1) {
        break
      }

      if (nextOpening !== -1 && nextOpening < nextClosing) {
        const nestedOpeningEnd = source.indexOf('>', nextOpening)

        if (nestedOpeningEnd === -1) {
          break
        }

        if (!source.slice(nextOpening, nestedOpeningEnd + 1).trimEnd().endsWith('/>')) {
          depth += 1
        }

        cursor = nestedOpeningEnd + 1
        continue
      }

      closingStart = nextClosing
      closingEnd = source.indexOf('>', closingStart)

      if (closingEnd === -1) {
        break
      }

      depth -= 1
      cursor = closingEnd + 1
    }

    if (depth !== 0 || closingStart === -1 || closingEnd === -1) {
      searchIndex = openingEnd + 1
      continue
    }

    blocks.push({
      start,
      openingTag,
      content: source.slice(openingEnd + 1, closingStart),
      fullContent: source.slice(start, closingEnd + 1),
    })
    searchIndex = closingEnd + 1
  }

  return blocks
}

function getElementAttribute(openingTag: string, attributeName: string): string {
  const lowerOpeningTag = openingTag.toLowerCase()
  const lowerAttributeName = attributeName.toLowerCase()
  let index = lowerOpeningTag.indexOf(lowerAttributeName)

  while (index !== -1) {
    const previousCharacter = lowerOpeningTag[index - 1]
    let cursor = index + lowerAttributeName.length

    if (index > 0 && previousCharacter !== ' ' && previousCharacter !== '\t' && previousCharacter !== '\n' && previousCharacter !== '\r') {
      index = lowerOpeningTag.indexOf(lowerAttributeName, cursor)
      continue
    }

    while (/\s/.test(openingTag[cursor] ?? '')) {
      cursor += 1
    }

    if (openingTag[cursor] !== '=') {
      index = lowerOpeningTag.indexOf(lowerAttributeName, cursor)
      continue
    }

    cursor += 1

    while (/\s/.test(openingTag[cursor] ?? '')) {
      cursor += 1
    }

    const quote = openingTag[cursor]

    if (quote !== '"' && quote !== '\'') {
      return ''
    }

    const valueEnd = openingTag.indexOf(quote, cursor + 1)
    return valueEnd === -1 ? '' : openingTag.slice(cursor + 1, valueEnd)
  }

  return ''
}

function parseDemoReferences(markdown: string): DemoReference[] {
  const headings = parseHeadings(markdown)
  const semanticSections = headings
    .map((heading, index) => ({ heading, index }))
    .filter(({ heading }) =>
      heading.anchor === 'semantic-dom'
      || ['semantic dom', '语义化 dom'].includes(normalizeHeadingTitle(heading.title)),
    )
    .map(({ heading, index }) => ({
      start: heading.start,
      end: headings
        .slice(index + 1)
        .find(candidate => candidate.level <= heading.level)
        ?.start ?? markdown.length,
    }))

  return extractElementBlocks(markdown, 'demo')
    .filter(block => !semanticSections.some(section =>
      block.start >= section.start && block.start < section.end,
    ))
    .map(block => ({
      src: getElementAttribute(block.openingTag, 'src'),
      title: block.content.trim(),
    }))
    .filter(reference => reference.src !== '')
}

function getDemoDescription(source: string, language: string): string {
  const docs = extractElementBlocks(source, 'docs')
    .find(block => getElementAttribute(block.openingTag, 'lang') === language)

  return docs?.content.trim() ?? ''
}

function getDemoCode(source: string): string {
  return [
    ...extractElementBlocks(source, 'script'),
    ...extractElementBlocks(source, 'template'),
  ]
    .sort((left, right) => left.start - right.start)
    .map(block => block.fullContent.trim())
    .join('\n\n')
}

export async function readDemos(
  componentDirectory: string,
  enMarkdown: string,
  zhMarkdown: string,
): Promise<ComponentDemoRecord[]> {
  const componentScope = `component:${path.basename(componentDirectory)}`
  const enReferences = parseDemoReferences(enMarkdown)
  const zhReferences = parseDemoReferences(zhMarkdown)
  const enBySrc = new Map(enReferences.map(reference => [reference.src, reference]))
  const zhBySrc = new Map(zhReferences.map(reference => [reference.src, reference]))
  const sources = [...new Set([...enBySrc.keys(), ...zhBySrc.keys()])]

  const demos = await Promise.all(sources.map(async (src): Promise<ComponentDemoRecord | undefined> => {
    const demoFile = path.resolve(componentDirectory, src)
    const relativeDemoFile = path.relative(componentDirectory, demoFile)

    if (relativeDemoFile.startsWith('..') || path.isAbsolute(relativeDemoFile)) {
      throw new Error(`Demo source is outside component directory: ${src}`)
    }

    let source: string

    try {
      source = await fs.readFile(demoFile, 'utf8')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logStep(componentScope, `Skipping missing demo: ${src}`)
        return undefined
      }

      throw error
    }

    return {
      name: path.basename(src, path.extname(src)),
      title: enBySrc.get(src)?.title ?? '',
      titleZh: zhBySrc.get(src)?.title ?? '',
      description: getDemoDescription(source, 'en-US'),
      descriptionZh: getDemoDescription(source, 'zh-CN'),
      code: getDemoCode(source),
    }
  }))

  return demos.filter(demo => demo !== undefined)
}
