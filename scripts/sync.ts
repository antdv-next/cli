// @env node

import type { ResolvedVersion } from '../src/types.ts'
import type {
  ChangelogChange,
  ChangelogFile,
  ChangelogRecord,
  ComponentApiRecord,
  ComponentFaqRecord,
  ComponentPropRecord,
  ComponentRecord,
} from '../src/types/components.ts'
import type { MarkdownHeading } from './extractors/markdown.ts'
import type { TokenDefaultIndex, TokenFiles, TokenMetaFile } from './extractors/tokens.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import { parse } from 'semver'
import { x } from 'tinyexec'
import { readDemos } from './extractors/demos.ts'
import { normalizeHeadingTitle, parseHeadings } from './extractors/markdown.ts'
import { readSemanticStructure } from './extractors/semantic-structure.ts'
import { getComponentTokens, getGlobalTokens, readTokenData } from './extractors/tokens.ts'
import { formatDuration, logSection, logStep } from './utils/log.ts'

dayjs.extend(utc)

interface SourceChangelogChange extends Omit<ChangelogChange, 'component'> {
  component: string | null
}

type ApiSectionName = 'properties' | 'events' | 'slots' | 'methods'
type MarkdownTableRow = Record<string, string>

interface VersionSourceData {
  globalTokens: ComponentPropRecord[]
  components: ComponentRecord[]
}

interface ParsedApi {
  properties: MarkdownTableRow[]
  events: MarkdownTableRow[]
  slots: MarkdownTableRow[]
  methods: MarkdownTableRow[]
}

interface ParsedSubComponent {
  key: string
  matchKeys: string[]
  name: string
  props: ParsedApi
}

interface ParsedComponentDocument {
  frontmatter: Record<string, string>
  whenToUse: string
  subComponents: ParsedSubComponent[]
  props: ParsedApi
}

type VersionFile = Record<string, Record<string, string>>

interface ParsedTag {
  record: ResolvedVersion
  major: number
  minor: number
  patch: number
}

interface MinorGroup {
  major: number
  minor: number
  tags: ParsedTag[]
}

const MAJOR_VERSIONS = [1, 2, 3, 4] as const
const PACKAGE_NAME = 'antdv-next'
const REMOTE_URL = 'https://github.com/antdv-next/antdv-next.git'
const TAG_PREFIX = `${PACKAGE_NAME}@`
const OUTPUT_DIRECTORY = fileURLToPath(new URL('../data', import.meta.url))
const SOURCE_DIRECTORY = fileURLToPath(new URL('../antdv-source', import.meta.url))
const COMPONENTS_DIRECTORY = path.join(SOURCE_DIRECTORY, 'docs/src/pages/components')
const TOKEN_DIRECTORIES = [
  path.join(SOURCE_DIRECTORY, 'docs/src/assets'),
  path.join(SOURCE_DIRECTORY, 'playground/src/assets'),
]
const CHANGELOG_FILE = path.join(OUTPUT_DIRECTORY, 'changelog.json')
const REMOTE_TAG_PATTERN = /^[0-9a-f]+\s+refs\/tags\/(.+)$/i
const MINOR_FILE_PATTERN = /^v(\d+)\.(\d+)\.(\d+)\.json$/

const sourceDataCache = new Map<string, Promise<VersionSourceData>>()

function parseFrontmatterValue(rawValue: string): string {
  const value = rawValue.trim()

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string
    }
    catch {
      return value.slice(1, -1)
    }
  }

  if (value.startsWith('\'') && value.endsWith('\'')) {
    return value.slice(1, -1).replace(/''/g, '\'')
  }

  return value
}

function parseFrontmatter(markdown: string): Record<string, string> {
  const markdownLines = markdown.split(/\r?\n/)
  const closingDelimiterIndex = markdownLines
    .slice(1)
    .findIndex(line => line.trim() === '---') + 1

  if (markdownLines[0]?.trim() !== '---' || closingDelimiterIndex <= 0) {
    return {}
  }

  const lines = markdownLines.slice(1, closingDelimiterIndex)
  const frontmatter: Record<string, string> = {}

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!
    const delimiterIndex = line.indexOf(':')
    const key = line.slice(0, delimiterIndex)

    if (delimiterIndex <= 0 || !/^[\w-]+$/.test(key)) {
      continue
    }

    const rawValue = line.slice(delimiterIndex + 1).trim()

    if (rawValue === '|' || rawValue === '>' || rawValue === '|-' || rawValue === '>-') {
      const blockLines: string[] = []

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1]!

        if (nextLine !== '' && nextLine[0] !== ' ' && nextLine[0] !== '\t') {
          break
        }

        index += 1
        blockLines.push(lines[index]!.replace(/^\s+/, ''))
      }

      frontmatter[key!] = rawValue.startsWith('>')
        ? blockLines.join(' ').trim()
        : blockLines.join('\n').trim()
      continue
    }

    frontmatter[key!] = parseFrontmatterValue(rawValue)
  }

  return frontmatter
}

function getHeadingContent(
  markdown: string,
  headings: MarkdownHeading[],
  headingIndex: number,
  boundaryLevel: number,
): string {
  const heading = headings[headingIndex]

  if (!heading) {
    return ''
  }

  const nextHeading = headings
    .slice(headingIndex + 1)
    .find(candidate => candidate.level <= boundaryLevel)

  return markdown.slice(heading.contentStart, nextHeading?.start ?? markdown.length).trim()
}

function getApiSectionName(heading: MarkdownHeading): ApiSectionName | undefined {
  const anchorSection = heading.anchor
    .toLowerCase()
    .match(/(?:^|-)(props?|property|properties|events?|slots?|methods?|arguments?)$/)?.[1]
  const title = normalizeHeadingTitle(heading.title)
    .replace(/\s*\{[^}]+\}\s*$/, '')
    .replace(/\s+/g, ' ')

  if (
    ['prop', 'props', 'properties', 'property', 'argument', 'arguments'].includes(anchorSection ?? '')
    || ['属性', '参数', 'argument', 'arguments', 'property', 'properties', 'props', 'common api'].includes(title)
  ) {
    return 'properties'
  }
  if (
    ['event', 'events'].includes(anchorSection ?? '')
    || ['事件', 'event', 'events'].includes(title)
  ) {
    return 'events'
  }
  if (
    ['slot', 'slots'].includes(anchorSection ?? '')
    || ['插槽', 'slot', 'slots'].includes(title)
  ) {
    return 'slots'
  }
  if (
    ['method', 'methods'].includes(anchorSection ?? '')
    || ['方法', 'method', 'methods', 'common methods', 'static methods'].includes(title)
  ) {
    return 'methods'
  }

  return undefined
}

function splitMarkdownTableRow(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let escaped = false
  let codeDelimiterLength = 0

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]!

    if (escaped) {
      cell += character
      escaped = false
      continue
    }

    if (character === '\\') {
      cell += character
      escaped = true
      continue
    }

    if (character === '`') {
      let delimiterLength = 1

      while (line[index + delimiterLength] === '`') {
        delimiterLength += 1
      }

      if (codeDelimiterLength === 0) {
        codeDelimiterLength = delimiterLength
      }
      else if (codeDelimiterLength === delimiterLength) {
        codeDelimiterLength = 0
      }

      cell += '`'.repeat(delimiterLength)
      index += delimiterLength - 1
      continue
    }

    if (character === '|' && codeDelimiterLength === 0) {
      cells.push(cell.trim())
      cell = ''
      continue
    }

    cell += character
  }

  cells.push(cell.trim())

  if (cells[0] === '') {
    cells.shift()
  }
  if (cells.at(-1) === '') {
    cells.pop()
  }

  return cells
}

function isMarkdownTableSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s/g, '')))
}

function createUniqueColumnNames(columns: string[]): string[] {
  const occurrences = new Map<string, number>()

  return columns.map((column, index) => {
    const baseName = column || `column${index + 1}`
    const occurrence = (occurrences.get(baseName) ?? 0) + 1
    occurrences.set(baseName, occurrence)
    return occurrence === 1 ? baseName : `${baseName}_${occurrence}`
  })
}

function parseMarkdownTableGroups(markdown: string): MarkdownTableRow[][] {
  const lines = markdown.split(/\r?\n/)
  const tables: MarkdownTableRow[][] = []

  for (let index = 0; index < lines.length - 1; index += 1) {
    const columns = splitMarkdownTableRow(lines[index]!)
    const separator = splitMarkdownTableRow(lines[index + 1]!)

    if (!lines[index]!.includes('|') || !isMarkdownTableSeparator(separator)) {
      continue
    }

    const uniqueColumns = createUniqueColumnNames(columns)
    const rows: MarkdownTableRow[] = []
    index += 2

    while (index < lines.length && lines[index]!.includes('|')) {
      const cells = splitMarkdownTableRow(lines[index]!)
      const row: MarkdownTableRow = {}

      for (const [columnIndex, column] of uniqueColumns.entries()) {
        row[column] = cells[columnIndex] ?? ''
      }

      rows.push(row)
      index += 1
    }

    if (rows.length > 0) {
      tables.push(rows)
    }

    index -= 1
  }

  return tables
}

function createEmptyParsedApi(): ParsedApi {
  return {
    properties: [],
    events: [],
    slots: [],
    methods: [],
  }
}

function inferApiSectionName(rows: MarkdownTableRow[]): ApiSectionName {
  const columns = new Set(
    rows.flatMap(row => Object.keys(row).map(normalizeTableColumn)),
  )

  if (['event', 'eventname', 'events', '事件', '事件名'].some(column => columns.has(column))) {
    return 'events'
  }
  if (['slot', 'slotname', 'slots', '插槽', '插槽名'].some(column => columns.has(column))) {
    return 'slots'
  }
  if (['method', 'methodname', 'methods', '方法', '方法名'].some(column => columns.has(column))) {
    return 'methods'
  }

  return 'properties'
}

function normalizeComponentIdentity(value: string): string {
  return cleanSubComponentName(value)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toLowerCase()
}

function createSubComponentKey(name: string): string {
  return cleanSubComponentName(name)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_$-]/gu, '')
}

function isSemanticDomHeading(heading: MarkdownHeading): boolean {
  const title = normalizeHeadingTitle(heading.title).replace(/[\s-]+/g, '')
  return heading.anchor === 'semantic-dom'
    || title === 'semanticdom'
    || title === '语义化dom'
}

function isTypeDefinitionsHeading(
  heading: MarkdownHeading,
  apiHeadingLevel: number,
): boolean {
  const title = normalizeHeadingTitle(heading.title)
  return heading.level === apiHeadingLevel
    && (heading.anchor === 'types' || title === 'types' || title === '类型')
}

function isFallbackApiBoundary(heading: MarkdownHeading): boolean {
  const title = normalizeHeadingTitle(heading.title).replace(/[\s-]+/g, '')
  return heading.level === 2
    && (
      heading.anchor === 'design-token'
      || heading.anchor === 'faq'
      || ['designtoken', '设计令牌', '主题变量（designtoken）', 'faq', '常见问题'].includes(title)
    )
}

function getDirectHeadingContent(
  markdown: string,
  headings: MarkdownHeading[],
  headingIndex: number,
  endOffset: number,
): string {
  const heading = headings[headingIndex]

  if (!heading) {
    return ''
  }

  const nextHeading = headings[headingIndex + 1]
  return markdown
    .slice(heading.contentStart, Math.min(nextHeading?.start ?? endOffset, endOffset))
    .trim()
}

function appendMarkdownTables(
  api: ParsedApi,
  markdown: string,
  sectionName?: ApiSectionName,
): void {
  for (const rows of parseMarkdownTableGroups(markdown)) {
    api[sectionName ?? inferApiSectionName(rows)].push(...rows)
  }
}

function parseComponentApi(
  markdown: string,
  headings: MarkdownHeading[],
  componentName: string,
): { props: ParsedApi, subComponents: ParsedSubComponent[] } {
  const props = createEmptyParsedApi()
  const subComponents: ParsedSubComponent[] = []
  const apiIndex = headings.findIndex(heading =>
    heading.level === 2
    && (heading.anchor === 'api' || normalizeHeadingTitle(heading.title) === 'api'),
  )

  if (apiIndex === -1) {
    return { props, subComponents }
  }

  const semanticDomIndex = headings.findIndex((heading, index) =>
    index > apiIndex && isSemanticDomHeading(heading),
  )
  const fallbackEndIndex = semanticDomIndex === -1
    ? headings.findIndex((heading, index) => index > apiIndex && isFallbackApiBoundary(heading))
    : -1
  let scopedEndIndex = headings.length

  if (semanticDomIndex !== -1) {
    scopedEndIndex = semanticDomIndex
  }
  else if (fallbackEndIndex !== -1) {
    scopedEndIndex = fallbackEndIndex
  }
  const scopedEndOffset = headings[scopedEndIndex]?.start ?? markdown.length
  const componentIdentity = normalizeComponentIdentity(componentName)
  const owners = new Map<number, {
    heading: MarkdownHeading
    root: boolean
    subComponent?: ParsedSubComponent
  }>()
  const ancestors: number[] = []

  appendMarkdownTables(
    props,
    getDirectHeadingContent(markdown, headings, apiIndex, scopedEndOffset),
  )

  function getOwnerApi(owner: NonNullable<ReturnType<typeof owners.get>>): ParsedApi {
    if (owner.root) {
      return props
    }

    if (!owner.subComponent) {
      const matchKeys = [
        normalizeComponentIdentity(owner.heading.title),
        normalizeComponentIdentity(owner.heading.anchor),
      ].filter(Boolean)

      owner.subComponent = {
        key: createSubComponentKey(owner.heading.title),
        matchKeys: [...new Set(matchKeys)],
        name: owner.heading.title,
        props: createEmptyParsedApi(),
      }
      subComponents.push(owner.subComponent)
    }

    return owner.subComponent.props
  }

  for (let index = apiIndex + 1; index < scopedEndIndex; index += 1) {
    const heading = headings[index]!

    if (isTypeDefinitionsHeading(heading, headings[apiIndex]!.level)) {
      while (
        index + 1 < scopedEndIndex
        && headings[index + 1]!.level > heading.level
      ) {
        index += 1
      }
      ancestors.length = 0
      continue
    }

    while (
      ancestors.length > 0
      && headings[ancestors.at(-1)!]!.level >= heading.level
    ) {
      ancestors.pop()
    }

    const sectionName = getApiSectionName(heading)
    const directContent = getDirectHeadingContent(markdown, headings, index, scopedEndOffset)

    if (sectionName) {
      const owner = [...ancestors]
        .reverse()
        .map(ancestorIndex => owners.get(ancestorIndex))
        .find(Boolean)
      appendMarkdownTables(owner ? getOwnerApi(owner) : props, directContent, sectionName)
      ancestors.push(index)
      continue
    }

    const headingIdentity = normalizeComponentIdentity(heading.title)
    const owner = {
      heading,
      root: Boolean(componentIdentity && headingIdentity === componentIdentity),
    }
    owners.set(index, owner)

    if (parseMarkdownTableGroups(directContent).length > 0) {
      appendMarkdownTables(getOwnerApi(owner), directContent)
    }

    ancestors.push(index)
  }

  return { props, subComponents }
}

function parseComponentDocument(markdown: string): ParsedComponentDocument {
  const headings = parseHeadings(markdown)
  const frontmatter = parseFrontmatter(markdown)
  const whenToUseIndex = headings.findIndex(heading =>
    heading.level === 2 && heading.anchor === 'when-to-use',
  )
  const { props, subComponents } = parseComponentApi(
    markdown,
    headings,
    getFrontmatterField(frontmatter, 'name', 'title'),
  )

  return {
    frontmatter,
    whenToUse: whenToUseIndex === -1
      ? ''
      : getHeadingContent(markdown, headings, whenToUseIndex, 2),
    subComponents,
    props,
  }
}

function normalizeTableColumn(column: string): string {
  return column
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function getTableCell(row: MarkdownTableRow, columns: string[]): string {
  const normalizedColumns = new Set(columns.map(normalizeTableColumn))

  for (const [column, value] of Object.entries(row)) {
    if (normalizedColumns.has(normalizeTableColumn(column))) {
      return value.trim()
    }
  }

  return ''
}

function getTableRowName(row: MarkdownTableRow): string {
  return getTableCell(row, [
    'name',
    'property',
    'property name',
    'properties',
    'event',
    'event name',
    'events',
    'slot',
    'slot name',
    'slots',
    'method',
    'method name',
    'methods',
    'argument',
    'argument name',
    'arguments',
    'parameter',
    'parameter name',
    'parameters',
    '名称',
    '属性',
    '属性名',
    '参数',
    '参数名',
    '事件',
    '事件名',
    '插槽',
    '插槽名',
    '方法',
    '方法名',
  ]).replace(/`/g, '').trim()
}

function getTableRowType(row: MarkdownTableRow): string {
  return getTableCell(row, ['type', '类型'])
}

function getTableRowDefault(row: MarkdownTableRow): string {
  return getTableCell(row, ['default', 'default value', '默认', '默认值'])
}

function getTableRowDescription(row: MarkdownTableRow): string {
  return getTableCell(row, ['description', '描述', '说明'])
}

function normalizeTableRowName(row: MarkdownTableRow): string {
  return getTableRowName(row).replace(/\s+/g, '').toLowerCase()
}

function mergeTableRows(
  enRows: MarkdownTableRow[],
  zhRows: MarkdownTableRow[],
): ComponentPropRecord[] {
  const zhRowsByName = new Map<string, MarkdownTableRow[]>()
  const usedZhRows = new Set<MarkdownTableRow>()

  for (const zhRow of zhRows) {
    const name = normalizeTableRowName(zhRow)
    const rows = zhRowsByName.get(name) ?? []
    rows.push(zhRow)
    zhRowsByName.set(name, rows)
  }

  const records = enRows.map((enRow) => {
    const matchingRows = zhRowsByName.get(normalizeTableRowName(enRow))
    const zhRow = matchingRows?.find(row => !usedZhRows.has(row))

    if (zhRow) {
      usedZhRows.add(zhRow)
    }

    return {
      name: getTableRowName(enRow) || (zhRow ? getTableRowName(zhRow) : ''),
      type: getTableRowType(enRow) || (zhRow ? getTableRowType(zhRow) : ''),
      default: getTableRowDefault(enRow) || (zhRow ? getTableRowDefault(zhRow) : ''),
      description: getTableRowDescription(enRow),
      descriptionZh: zhRow ? getTableRowDescription(zhRow) : '',
    }
  })

  for (const zhRow of zhRows) {
    if (usedZhRows.has(zhRow)) {
      continue
    }

    records.push({
      name: getTableRowName(zhRow),
      type: getTableRowType(zhRow),
      default: getTableRowDefault(zhRow),
      description: '',
      descriptionZh: getTableRowDescription(zhRow),
    })
  }

  return records
}

function localizeApi(en: ParsedApi, zh: ParsedApi): ComponentApiRecord {
  return {
    properties: mergeTableRows(en.properties, zh.properties),
    events: mergeTableRows(en.events, zh.events),
    slots: mergeTableRows(en.slots, zh.slots),
    methods: mergeTableRows(en.methods, zh.methods),
  }
}

function countApiItems(api: ComponentApiRecord): number {
  return api.properties.length
    + api.events.length
    + api.slots.length
    + api.methods.length
}

function cleanSubComponentName(name: string): string {
  return name
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
}

function mergeLocalizedApi(
  current: ComponentApiRecord | undefined,
  next: ComponentApiRecord,
): ComponentApiRecord {
  if (!current) {
    return next
  }

  return {
    properties: [...current.properties, ...next.properties],
    events: [...current.events, ...next.events],
    slots: [...current.slots, ...next.slots],
    methods: [...current.methods, ...next.methods],
  }
}

function addSubComponentRecord(
  records: Record<string, ComponentApiRecord>,
  key: string,
  props: ComponentApiRecord,
): void {
  records[key] = mergeLocalizedApi(records[key], props)
}

function localizeSubComponentProps(
  enSubComponents: ParsedSubComponent[],
  zhSubComponents: ParsedSubComponent[],
): Record<string, ComponentApiRecord> {
  const zhByMatchKey = new Map<string, ParsedSubComponent[]>()
  const usedZhComponents = new Set<ParsedSubComponent>()
  const records: Record<string, ComponentApiRecord> = {}

  for (const zhSubComponent of zhSubComponents) {
    for (const matchKey of zhSubComponent.matchKeys) {
      const matches = zhByMatchKey.get(matchKey) ?? []
      matches.push(zhSubComponent)
      zhByMatchKey.set(matchKey, matches)
    }
  }

  for (const enSubComponent of enSubComponents) {
    const zhSubComponent = enSubComponent.matchKeys
      .flatMap(matchKey => zhByMatchKey.get(matchKey) ?? [])
      .find(subComponent => !usedZhComponents.has(subComponent))

    if (zhSubComponent) {
      usedZhComponents.add(zhSubComponent)
    }

    addSubComponentRecord(
      records,
      enSubComponent.key,
      localizeApi(enSubComponent.props, zhSubComponent?.props ?? createEmptyParsedApi()),
    )
  }

  for (const zhSubComponent of zhSubComponents) {
    if (usedZhComponents.has(zhSubComponent)) {
      continue
    }

    addSubComponentRecord(
      records,
      zhSubComponent.key,
      localizeApi(createEmptyParsedApi(), zhSubComponent.props),
    )
  }

  return records
}

export function extractLocalizedComponentApi(
  enMarkdown: string,
  zhMarkdown: string,
): Pick<ComponentRecord, 'props' | 'subComponents' | 'subComponentProps'> {
  const en = parseComponentDocument(enMarkdown)
  const zh = parseComponentDocument(zhMarkdown)
  const subComponentProps = localizeSubComponentProps(en.subComponents, zh.subComponents)

  return {
    props: localizeApi(en.props, zh.props),
    subComponents: Object.keys(subComponentProps),
    subComponentProps,
  }
}

function parseFaq(markdown: string): ComponentFaqRecord[] {
  const headings = parseHeadings(markdown)
  const faqIndex = headings.findIndex(heading =>
    heading.level === 2
    && (heading.anchor === 'faq' || normalizeHeadingTitle(heading.title) === 'faq'),
  )

  if (faqIndex === -1) {
    return []
  }

  const faqEndIndex = headings.findIndex((heading, index) =>
    index > faqIndex && heading.level <= 2,
  )
  const scopedEndIndex = faqEndIndex === -1 ? headings.length : faqEndIndex
  const faq: ComponentFaqRecord[] = []

  for (let index = faqIndex + 1; index < scopedEndIndex; index += 1) {
    const heading = headings[index]!

    if (heading.level !== 3) {
      continue
    }

    faq.push({
      question: heading.title,
      answer: getHeadingContent(markdown, headings, index, 3),
    })
  }

  return faq
}

function getFrontmatterField(
  frontmatter: Record<string, string>,
  field: string,
  fallbackField?: string,
): string {
  return frontmatter[field] ?? (fallbackField ? frontmatter[fallbackField] : undefined) ?? ''
}

async function readComponent(
  componentDirectory: string,
  tokenMeta: TokenMetaFile,
  tokenDefaults: TokenDefaultIndex,
): Promise<ComponentRecord | undefined> {
  const componentScope = `component:${componentDirectory}`
  const directory = path.join(COMPONENTS_DIRECTORY, componentDirectory)
  const enFile = path.join(directory, 'index.en-US.md')
  const zhFile = path.join(directory, 'index.zh-CN.md')
  let enMarkdown: string
  let zhMarkdown: string

  logStep(componentScope, 'Reading bilingual documentation')

  try {
    [enMarkdown, zhMarkdown] = await Promise.all([
      fs.readFile(enFile, 'utf8'),
      fs.readFile(zhFile, 'utf8'),
    ])
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logStep(componentScope, 'Skipping component because bilingual documentation is missing')
      return undefined
    }
    throw error
  }

  const en = parseComponentDocument(enMarkdown)
  const zh = parseComponentDocument(zhMarkdown)
  const name = getFrontmatterField(en.frontmatter, 'name', 'title')
  const [demos, semanticStructure] = await Promise.all([
    readDemos(directory, enMarkdown, zhMarkdown),
    readSemanticStructure(directory),
  ])
  const subComponentProps = localizeSubComponentProps(en.subComponents, zh.subComponents)
  const component = {
    name,
    nameZh: getFrontmatterField(zh.frontmatter, 'subtitle'),
    category: getFrontmatterField(en.frontmatter, 'category'),
    categoryZh: getFrontmatterField(zh.frontmatter, 'category'),
    description: getFrontmatterField(en.frontmatter, 'description'),
    descriptionZh: getFrontmatterField(zh.frontmatter, 'description'),
    whenToUse: en.whenToUse,
    whenToUseZh: zh.whenToUse,
    doc: enMarkdown,
    docZh: zhMarkdown,
    subComponents: Object.keys(subComponentProps),
    subComponentProps,
    props: localizeApi(en.props, zh.props),
    tokens: getComponentTokens(name, tokenMeta, tokenDefaults),
    faq: parseFaq(enMarkdown),
    demos,
    semanticStructure,
  }
  const subComponentApiItemCount = Object.values(component.subComponentProps)
    .reduce((count, api) => count + countApiItems(api), 0)

  logStep(
    componentScope,
    `Parsed ${countApiItems(component.props)} root API items and ${subComponentApiItemCount} API items across ${component.subComponents.length} subcomponents, ${component.tokens.length} tokens, ${component.faq.length} FAQs, ${component.demos.length} demos and ${component.semanticStructure.length} semantic structures`,
  )

  return component
}

async function getCurrentSourceReference(): Promise<string> {
  const commandOptions = {
    nodeOptions: {
      stdio: 'pipe' as const,
    },
  }
  const branch = await x('git', [
    '-C',
    SOURCE_DIRECTORY,
    'symbolic-ref',
    '--short',
    '--quiet',
    'HEAD',
  ], commandOptions)

  if (branch.exitCode === 0 && branch.stdout.trim()) {
    return branch.stdout.trim()
  }

  const tag = await x('git', [
    '-C',
    SOURCE_DIRECTORY,
    'describe',
    '--tags',
    '--exact-match',
    'HEAD',
  ], commandOptions)

  if (tag.exitCode === 0 && tag.stdout.trim()) {
    return tag.stdout.trim()
  }

  const commit = await x('git', [
    '-C',
    SOURCE_DIRECTORY,
    'rev-parse',
    '--short',
    'HEAD',
  ], {
    ...commandOptions,
    throwOnError: true,
  })

  return commit.stdout.trim()
}

async function checkoutSourceVersion(version: string): Promise<void> {
  const scope = `source:${version}`

  try {
    await fs.access(SOURCE_DIRECTORY)
  }
  catch {
    throw new Error(`Missing source repository: ${SOURCE_DIRECTORY}`)
  }

  const currentReference = await getCurrentSourceReference()
  const targetReference = `${TAG_PREFIX}${version}`

  logStep(scope, `git checkout ${currentReference} -> ${targetReference}`)

  await x('git', [
    '-C',
    SOURCE_DIRECTORY,
    'checkout',
    '--quiet',
    targetReference,
  ], {
    throwOnError: true,
    nodeOptions: {
      stdio: 'pipe',
    },
  })

  logStep(scope, 'Git checkout completed')
}

function getTokenFileCandidates(filename: string): string[] {
  return TOKEN_DIRECTORIES.map(directory => path.join(directory, filename))
}

async function getFileModificationTime(filename: string): Promise<number | undefined> {
  try {
    return (await fs.stat(filename)).mtimeMs
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }

    throw error
  }
}

async function getTokenFileModificationTimes(): Promise<Map<string, number | undefined>> {
  const candidates = [
    ...getTokenFileCandidates('token-meta.json'),
    ...getTokenFileCandidates('token.json'),
  ]
  const modificationTimes = await Promise.all(candidates.map(getFileModificationTime))
  const result = new Map<string, number | undefined>()

  for (const [index, filename] of candidates.entries()) {
    result.set(filename, modificationTimes[index])
  }

  return result
}

async function resolveGeneratedTokenFile(
  filename: string,
  previousModificationTimes: Map<string, number | undefined>,
): Promise<string> {
  const candidates = getTokenFileCandidates(filename)
  const currentFiles = (await Promise.all(candidates.map(async candidate => ({
    filename: candidate,
    modificationTime: await getFileModificationTime(candidate),
  }))))
    .filter(file => file.modificationTime !== undefined)
    .sort((left, right) => right.modificationTime! - left.modificationTime!)
  const generatedFile = currentFiles.find(file =>
    file.modificationTime !== previousModificationTimes.get(file.filename),
  )

  if (generatedFile) {
    return generatedFile.filename
  }

  throw new Error(
    `Token build did not update ${filename} in: ${TOKEN_DIRECTORIES.join(', ')}`,
  )
}

async function prepareSourceVersion(version: string): Promise<TokenFiles> {
  const scope = `source:${version}`

  await checkoutSourceVersion(version)

  logStep(scope, 'Recording token file modification times')
  const previousModificationTimes = await getTokenFileModificationTimes()

  logStep(scope, 'Running pnpm install')
  await x('pnpm', ['install'], {
    throwOnError: true,
    nodeOptions: {
      cwd: SOURCE_DIRECTORY,
      stdio: 'pipe',
    },
  })
  logStep(scope, 'Completed pnpm install')

  logStep(scope, `Running pnpm --filter ${PACKAGE_NAME} build:esm`)
  await x('pnpm', ['--filter', PACKAGE_NAME, 'build:esm'], {
    throwOnError: true,
    nodeOptions: {
      cwd: SOURCE_DIRECTORY,
      stdio: 'pipe',
    },
  })
  logStep(scope, 'Completed ESM build')

  logStep(scope, `Running pnpm --filter ${PACKAGE_NAME} build:token`)
  await x('pnpm', ['--filter', PACKAGE_NAME, 'build:token'], {
    throwOnError: true,
    nodeOptions: {
      cwd: SOURCE_DIRECTORY,
      stdio: 'pipe',
    },
  })
  logStep(scope, 'Completed token build')

  logStep(scope, 'Resolving generated token files')
  const [tokenMeta, token] = await Promise.all([
    resolveGeneratedTokenFile('token-meta.json', previousModificationTimes),
    resolveGeneratedTokenFile('token.json', previousModificationTimes),
  ])

  logStep(scope, `Resolved token metadata: ${path.relative(SOURCE_DIRECTORY, tokenMeta)}`)
  logStep(scope, `Resolved token defaults: ${path.relative(SOURCE_DIRECTORY, token)}`)

  return { tokenMeta, token }
}

async function readSourceDataForVersion(version: string): Promise<VersionSourceData> {
  const scope = `source:${version}`
  const tokenFiles = await prepareSourceVersion(version)

  logStep(scope, 'Reading token metadata and defaults')
  const { tokenMeta, tokenDefaults } = await readTokenData(tokenFiles)

  logStep(scope, `Scanning component directories in ${COMPONENTS_DIRECTORY}`)
  const directoryEntries = await fs.readdir(COMPONENTS_DIRECTORY, { withFileTypes: true })
  const componentDirectories = directoryEntries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))

  logStep(scope, `Found ${componentDirectories.length} component directories`)
  const components = await Promise.all(componentDirectories.map(componentDirectory =>
    readComponent(componentDirectory, tokenMeta, tokenDefaults),
  ))
  const globalTokens = getGlobalTokens(tokenMeta, tokenDefaults)
  const parsedComponents = components.filter(component => component !== undefined)

  logStep(
    scope,
    `Parsed ${parsedComponents.length} components and ${globalTokens.length} global tokens`,
  )

  return {
    globalTokens,
    components: parsedComponents,
  }
}

function loadSourceData(version: string): Promise<VersionSourceData> {
  const cachedSourceData = sourceDataCache.get(version)

  if (cachedSourceData) {
    logStep(`source:${version}`, 'Reusing cached source data')
    return cachedSourceData
  }

  logSection(`Source version: v${version}`)
  const sourceData = readSourceDataForVersion(version)
  sourceDataCache.set(version, sourceData)
  return sourceData
}

async function fetchTags(majorVersion: number): Promise<ParsedTag[]> {
  const scope = `remote:v${majorVersion}`
  const tagPattern = `refs/tags/${TAG_PREFIX}${majorVersion}.*`

  logStep(scope, 'Fetching remote repository versions')
  const { stdout } = await x('git', [
    'ls-remote',
    '--tags',
    '--refs',
    '--sort=v:refname',
    REMOTE_URL,
    tagPattern,
  ], {
    throwOnError: true,
    nodeOptions: {
      stdio: 'pipe',
    },
  })

  const lines = stdout.split(/\r?\n/).filter(Boolean)
  const tags = lines.map(line => parseRemoteTag(line, majorVersion))

  logStep(scope, `Found ${tags.length} tags`)
  return tags
}

async function fetchPublishTimes(): Promise<Map<string, string>> {
  logStep('npm', `Fetching publish times for ${PACKAGE_NAME}`)
  const { stdout } = await x('npm', [
    'view',
    PACKAGE_NAME,
    'time',
    '--json',
  ], {
    throwOnError: true,
    nodeOptions: {
      stdio: 'pipe',
    },
  })

  let data: unknown

  try {
    data = JSON.parse(stdout)
  }
  catch {
    throw new Error(`Invalid npm publish time response for ${PACKAGE_NAME}`)
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Unexpected npm publish time response for ${PACKAGE_NAME}`)
  }

  const publishTimes = new Map<string, string>()

  for (const [rawVersion, rawPublishedAt] of Object.entries(data)) {
    const semver = parse(rawVersion)

    if (!semver || typeof rawPublishedAt !== 'string') {
      continue
    }

    const publishedAt = dayjs.utc(rawPublishedAt)
    if (!publishedAt.isValid()) {
      throw new TypeError(`Invalid npm publish time for ${PACKAGE_NAME}@${rawVersion}`)
    }

    publishTimes.set(formatSemver(semver), publishedAt.format('YYYY-MM-DD'))
  }

  if (publishTimes.size === 0) {
    throw new Error(`No npm publish times found for ${PACKAGE_NAME}`)
  }

  logStep('npm', `Found publish times for ${publishTimes.size} versions`)
  return publishTimes
}

function isSourceChangelogChange(value: unknown): value is SourceChangelogChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const change = value as Record<string, unknown>

  return (typeof change.component === 'string' || change.component === null)
    && typeof change.type === 'string'
    && typeof change.description === 'string'
}

async function readChangesByVersion(): Promise<Map<string, ChangelogChange[]>> {
  logStep('changelog', `Reading existing changes from ${CHANGELOG_FILE}`)
  const source = await fs.readFile(CHANGELOG_FILE, 'utf8')
  let data: unknown

  try {
    data = JSON.parse(source)
  }
  catch {
    throw new Error(`Invalid JSON in ${CHANGELOG_FILE}`)
  }

  if (!Array.isArray(data)) {
    throw new TypeError(`Expected an array in ${CHANGELOG_FILE}`)
  }

  const changesByVersion = new Map<string, ChangelogChange[]>()

  for (const [index, value] of data.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`Invalid changelog record at index ${index} in ${CHANGELOG_FILE}`)
    }

    const record = value as Record<string, unknown>
    const { version, changelog } = record

    if (typeof version !== 'string' || !Array.isArray(changelog)) {
      throw new TypeError(`Invalid changelog record at index ${index} in ${CHANGELOG_FILE}`)
    }

    if (!changelog.every(isSourceChangelogChange)) {
      throw new TypeError(`Invalid changes for version ${version} in ${CHANGELOG_FILE}`)
    }

    if (changesByVersion.has(version)) {
      throw new Error(`Duplicate version ${version} in ${CHANGELOG_FILE}`)
    }

    changesByVersion.set(version, changelog.map(change => ({
      ...change,
      component: change.component ?? '',
    })))
  }

  logStep('changelog', `Loaded changes for ${changesByVersion.size} versions`)
  return changesByVersion
}

function parseRemoteTag(line: string, expectedMajorVersion: number): ParsedTag {
  const remoteTagMatch = line.match(REMOTE_TAG_PATTERN)
  const tag = remoteTagMatch?.[1]

  if (!tag?.startsWith(TAG_PREFIX)) {
    throw new Error(`Unexpected git ls-remote output: ${line}`)
  }

  const rawVersion = tag.slice(TAG_PREFIX.length)
  const semver = parse(rawVersion)

  if (!semver) {
    throw new Error(`Invalid semantic version tag: ${tag}`)
  }

  const { major, minor, patch } = semver

  if (major !== expectedMajorVersion) {
    throw new Error(`Unexpected major version tag: ${tag}`)
  }

  return {
    record: {
      version: formatSemver(semver),
      majorVersion: `v${major}`,
    },
    major,
    minor,
    patch,
  }
}

function formatSemver(semver: NonNullable<ReturnType<typeof parse>>): string {
  return semver.build.length > 0
    ? `${semver.version}+${semver.build.join('.')}`
    : semver.version
}

function groupTagsByMinor(tags: ParsedTag[]): MinorGroup[] {
  const groups = new Map<string, MinorGroup>()

  for (const tag of tags) {
    const key = `${tag.major}.${tag.minor}`
    const group = groups.get(key)

    if (group) {
      group.tags.push(tag)
      continue
    }

    groups.set(key, {
      major: tag.major,
      minor: tag.minor,
      tags: [tag],
    })
  }

  return [...groups.values()].sort((left, right) =>
    left.major - right.major || left.minor - right.minor,
  )
}

function compareBaseVersions(left: ParsedTag, right: ParsedTag): number {
  return left.major - right.major
    || left.minor - right.minor
    || left.patch - right.patch
}

function getHighestBaseVersion(tags: ParsedTag[]): ParsedTag {
  const [firstTag, ...remainingTags] = tags

  if (!firstTag) {
    throw new Error('Cannot resolve a version from an empty tag collection')
  }

  return remainingTags.reduce(
    (highestTag, tag) => compareBaseVersions(tag, highestTag) > 0 ? tag : highestTag,
    firstTag,
  )
}

function getBaseVersion(tag: ParsedTag): string {
  return `${tag.major}.${tag.minor}.${tag.patch}`
}

function createChangelogRecord(
  tag: ParsedTag,
  publishTimes: Map<string, string>,
  changesByVersion: Map<string, ChangelogChange[]>,
): ChangelogRecord {
  const publishedAt = publishTimes.get(tag.record.version)

  if (!publishedAt) {
    throw new Error(`Missing npm publish time for ${PACKAGE_NAME}@${tag.record.version}`)
  }

  return {
    ...tag.record,
    date: publishedAt,
    changes: changesByVersion.get(tag.record.version) ?? [],
  }
}

function assertPublishTimes(
  tags: ParsedTag[],
  publishTimes: Map<string, string>,
): void {
  for (const tag of tags) {
    if (!publishTimes.has(tag.record.version)) {
      throw new Error(`Missing npm publish time for ${PACKAGE_NAME}@${tag.record.version}`)
    }
  }
}

async function createChangelogFile(
  tags: ParsedTag[],
  publishTimes: Map<string, string>,
  changesByVersion: Map<string, ChangelogChange[]>,
  outputScope: string,
): Promise<ChangelogFile> {
  const highestTag = getHighestBaseVersion(tags)
  const version = getBaseVersion(highestTag)

  logStep(outputScope, `Selected source version ${version} from ${tags.length} tags`)
  const { components, globalTokens } = await loadSourceData(version)
  const changelog = tags
    .map(tag => createChangelogRecord(tag, publishTimes, changesByVersion))

  logStep(
    outputScope,
    `Prepared ${components.length} components, ${globalTokens.length} global tokens and ${changelog.length} changelog entries`,
  )

  return {
    version,
    majorVersion: `v${highestTag.major}`,
    globalTokens,
    components,
    changelog,
  }
}

function groupTagsByMajor(tags: ParsedTag[]): Map<number, ParsedTag[]> {
  const groups = new Map<number, ParsedTag[]>()

  for (const tag of tags) {
    const group = groups.get(tag.major)

    if (group) {
      group.push(tag)
    }
    else {
      groups.set(tag.major, [tag])
    }
  }

  return groups
}

async function buildOutputFiles(
  tags: ParsedTag[],
  publishTimes: Map<string, string>,
  changesByVersion: Map<string, ChangelogChange[]>,
): Promise<Map<string, ChangelogFile>> {
  const outputFiles = new Map<string, ChangelogFile>()

  for (const [major, majorTags] of groupTagsByMajor(tags)) {
    const outputLabel = `v${major}`
    const outputScope = `output:${outputLabel}`

    logSection(`Output group: ${outputLabel}`)
    outputFiles.set(
      `v${major}.json`,
      await createChangelogFile(
        majorTags,
        publishTimes,
        changesByVersion,
        outputScope,
      ),
    )
    logStep(outputScope, `Prepared v${major}.json`)
  }

  for (const group of groupTagsByMinor(tags)) {
    const outputLabel = `v${group.major}.${group.minor}.x`
    const outputScope = `output:${outputLabel}`

    logSection(`Output group: ${outputLabel}`)
    const changelogFile = await createChangelogFile(
      group.tags,
      publishTimes,
      changesByVersion,
      outputScope,
    )
    const filename = `v${changelogFile.version}.json`
    outputFiles.set(filename, changelogFile)
    logStep(outputScope, `Prepared ${filename}`)
  }

  return outputFiles
}

function createVersionFile(tags: ParsedTag[]): VersionFile {
  const versions: Record<string, Record<string, string>> = {}

  for (const group of groupTagsByMinor(tags)) {
    const majorVersion = `v${group.major}`
    const minorVersions = versions[majorVersion] ?? {}
    const highestTag = getHighestBaseVersion(group.tags)

    minorVersions[`${group.major}.${group.minor}`] = getBaseVersion(highestTag)
    versions[majorVersion] = minorVersions
  }

  return versions
}

async function writeJsonFile(
  filename: string,
  data: ChangelogFile | VersionFile,
): Promise<void> {
  const file = path.join(OUTPUT_DIRECTORY, filename)

  logStep(`write:${filename}`, `Writing ${file}`)
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  logStep(`write:${filename}`, 'Completed')
}

async function removeStaleMinorFiles(
  expectedFiles: Set<string>,
  syncedMajorVersions: Set<number>,
): Promise<void> {
  logStep('cleanup', `Scanning ${OUTPUT_DIRECTORY} for stale minor-version files`)
  const filenames = await fs.readdir(OUTPUT_DIRECTORY)
  const staleFiles = filenames.filter((filename) => {
    const match = filename.match(MINOR_FILE_PATTERN)
    const majorVersion = Number(match?.[1])

    return match
      && syncedMajorVersions.has(majorVersion)
      && !expectedFiles.has(filename)
  })

  if (staleFiles.length === 0) {
    logStep('cleanup', 'No stale minor-version files found')
    return
  }

  for (const filename of staleFiles) {
    logStep('cleanup', `Removing ${filename}`)
    await fs.unlink(path.join(OUTPUT_DIRECTORY, filename))
  }

  logStep('cleanup', `Removed ${staleFiles.length} stale minor-version files`)
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  const tagGroups: ParsedTag[][] = []

  logStep('sync', 'Starting synchronization')
  logStep('sync', `Remote repository: ${REMOTE_URL}`)
  logStep('sync', `Source directory: ${SOURCE_DIRECTORY}`)
  logStep('sync', `Output directory: ${OUTPUT_DIRECTORY}`)
  logStep('sync', `Configured major versions: ${MAJOR_VERSIONS.map(version => `v${version}`).join(', ')}`)

  for (const majorVersion of MAJOR_VERSIONS) {
    logSection(`Remote tags: v${majorVersion}`)
    tagGroups.push(await fetchTags(majorVersion))
  }

  logSection('npm publish times')
  const publishTimes = await fetchPublishTimes()

  logSection('Existing changelog changes')
  const changesByVersion = await readChangesByVersion()
  const tags = tagGroups.flat()

  if (tags.length === 0) {
    throw new Error(`No tags matched the configured major versions: ${MAJOR_VERSIONS.join(', ')}`)
  }

  logSection('Validation')
  logStep('sync', `Validating publish times for ${tags.length} tags`)
  assertPublishTimes(tags, publishTimes)
  logStep('sync', 'All tags have npm publish times')

  const outputFiles = await buildOutputFiles(tags, publishTimes, changesByVersion)

  logSection('Version index')
  logStep('version', 'Creating versions.json')
  const versionFile = createVersionFile(tags)
  const syncedMajorVersions = new Set(tags.map(tag => tag.major))
  logStep('version', `Prepared mappings for ${syncedMajorVersions.size} major versions`)

  logSection('Writing output files')
  logStep('write', `Ensuring output directory exists: ${OUTPUT_DIRECTORY}`)
  await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true })

  for (const [filename, changelog] of outputFiles) {
    await writeJsonFile(filename, changelog)
  }

  await writeJsonFile('versions.json', versionFile)

  logSection('Cleanup')
  await removeStaleMinorFiles(new Set(outputFiles.keys()), syncedMajorVersions)

  logSection('Synchronization completed')
  logStep(
    'sync',
    `Synced ${tags.length} tags across ${syncedMajorVersions.size} major versions to ${outputFiles.size} changelog files and versions.json in ${formatDuration(startedAt)}`,
  )
}

const entryFile = process.argv[1]

if (entryFile && import.meta.url === pathToFileURL(entryFile).href) {
  try {
    await main()
  }
  catch (error) {
    logSection('Synchronization failed')
    logStep('sync', error instanceof Error ? error.message : String(error))
    throw error
  }
}
