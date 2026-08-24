import type { ComponentApiItemRecord, ComponentApiRecord, ComponentRecord } from '#/components.ts'
import type { OutputFormat } from '@/args/default.ts'
import type { ResolvedVersion } from '@/types.ts'
import { defineCommand } from 'citty'
import { Table } from 'console-table-printer'
import { componentArgs } from '@/args/component.ts'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import { tableBorderStyle } from '@/constants/table.ts'
import capitalize from '@/utils/capitalize.ts'
import { logErrorComponent } from '@/utils/error.ts'
import { loadComponent, loadVersionMetaData } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

type ApiField = keyof ComponentApiRecord

const COMMAND_ANCHOR_FIELDS = ['properties', 'events', 'slots', 'methods'] as const satisfies readonly ApiField[]
const API_FIELD_LABELS = {
  properties: 'Property',
  events: 'Event',
  slots: 'Slot',
  methods: 'Method',
} satisfies Record<ApiField, string>

const COMMON_PROPS: ComponentApiItemRecord[] = [
  {
    name: 'style',
    type: 'CSSProperties',
    default: '-',
    description: 'The additional style',
    descriptionZh: '自定义样式',
  },
  { name: 'class', type: 'string', default: '-', description: 'The additional css class', descriptionZh: '自定义类名' },
  {
    name: 'rootClass',
    type: 'string',
    default: '-',
    description: 'ClassName on the root element',
    descriptionZh: '添加在组件最外层的 className',
  },
  {
    name: 'autoFocus',
    type: 'boolean',
    default: 'false',
    description: 'Auto focus when component mounted, only effective for focusable elements like forms, links, etc.',
    descriptionZh: '自动获取焦点，仅对表单类、链接、交互容器等可聚焦元素生效',
  },
]

function outputJson(component: ComponentRecord): object {
  const { name, nameZh, description, props, subComponentProps, commonProps } = component
  return {
    name,
    nameZh,
    description,
    props: props.properties,
    events: props.events,
    slots: props.slots,
    methods: props.methods,
    subComponentProps,
    commonProps,
  }
}

function renderTextTable(items: ComponentApiItemRecord[], field: ApiField): string {
  const fieldLabel = API_FIELD_LABELS[field]
  const table = new Table({
    style: tableBorderStyle,
    columns: [
      { name: fieldLabel, alignment: 'left' },
      { name: 'Type', alignment: 'left' },
      { name: 'Default', alignment: 'left' },
      { name: 'Description', alignment: 'left' },
    ],
  })

  for (const item of items) {
    table.addRow({
      [fieldLabel]: item.name,
      Type: item.type,
      Default: item.default,
      Description: item.descriptionZh || item.description,
    })
  }

  return table.render()
}

function renderMarkdownTable(items: ComponentApiItemRecord[], field: ApiField): string {
  const rows = items.map((item) => {
    const description = item.descriptionZh || item.description
    return `| ${item.name} | ${item.type} | ${item.default} | ${description} |`
  })

  return [
    `| ${API_FIELD_LABELS[field]} | Type | Default | Description |`,
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
}

function renderApiTables(props: ComponentApiRecord, type: OutputFormat): string {
  return COMMAND_ANCHOR_FIELDS
    .filter(field => props[field].length)
    .map((field) => {
      return type === 'text'
        ? renderTextTable(props[field], field)
        : renderMarkdownTable(props[field], field)
    })
    .join('\n')
}

function outputTextTableOrMarkdown(component: ComponentRecord, type: OutputFormat): string {
  const sections = [renderApiTables(component.props, type)]

  for (const subComponent of component.subComponents) {
    const props = component.subComponentProps[subComponent]
    if (!props) {
      continue
    }

    sections.push(`\n${subComponent}\n`, renderApiTables(props, type))
  }

  if (component.commonProps?.length) {
    const commonPropsTitle = '\n通用属性（所有组件均支持，无需单独列出）\n'
    const commonPropsTable = type === 'text'
      ? renderTextTable(component.commonProps, 'properties')
      : renderMarkdownTable(component.commonProps, 'properties')

    sections.push(commonPropsTitle, commonPropsTable)
  }

  return sections.filter(Boolean).join(type === 'markdown' ? '\n\n' : '')
}

const COMMON_PROPS_EXCLUDED = new Set(['ConfigProvider'])

async function getComponentInfo(name: string, version: ResolvedVersion): Promise<ComponentRecord> {
  const component = loadComponent(name, await loadVersionMetaData(version))

  const commonProps = COMMON_PROPS_EXCLUDED.has(component.name) ? undefined : COMMON_PROPS

  return {
    ...component,
    commonProps,
  }
}

export default defineCommand({
  meta: {
    name: 'info',
    description: 'Query component API: props, type definitions, default values',
  },
  args: {
    ...defaultArgs,
    ...componentArgs,
  },
  async run({ args }) {
    const config = resolveConfig(args)
    try {
      const version = await resolveVersion(config)
      const component = await getComponentInfo(config.component, version)

      if (args.format !== 'json') {
        console.log(`${capitalize(config.component)} (${component.nameZh}) — ${component.description}`)
      }

      output({
        json: outputJson(component),
        text: outputTextTableOrMarkdown(component, 'text'),
        markdown: outputTextTableOrMarkdown(component, 'markdown'),
      }, args.format)
    }
    catch (error) {
      logErrorComponent(args)
    }
  },
})
