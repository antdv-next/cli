import type { ComponentApiItemRecord, ComponentApiRecord, ComponentRecord } from '#/components.ts'
import type { OutputFormat } from '@/args/default.ts'
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

const COMMAND_ANCHOR_FIELDS = ['properties', 'events', 'slots', 'methods'] as (keyof ComponentApiRecord)[]

function outputJson(component: ComponentRecord): object {
  const { name, nameZh, description, props, subComponentProps } = component
  return {
    name,
    nameZh,
    description,
    props: props.properties,
    events: props.events,
    slots: props.slots,
    methods: props.methods,
    subComponentProps,
  }
}

function outputTextTableOrMarkdown(component: ComponentRecord, type: OutputFormat): string {
  let content = ''

  const optimizeTableRender = (props: Record<keyof ComponentApiRecord, ComponentApiItemRecord[]>, anchor: keyof ComponentApiRecord): string => {
    if (type === 'text') {
      const p = new Table({
        style: tableBorderStyle,
        columns: [
          { name: capitalize(anchor), alignment: 'left' },
          { name: 'Type', alignment: 'left' },
          { name: 'Default', alignment: 'left' },
          { name: 'Description', alignment: 'left' },
        ],
      })

      props[anchor].forEach((prop) => {
        p.addRow({
          [capitalize(anchor)]: prop.name,
          Type: prop.type,
          Default: prop.default,
          Description: prop.descriptionZh,
        })
      })

      return p.render()
    }

    let markdown = '\n'
    markdown += `| ${capitalize(anchor)} | Type | Default | Since |\n`
    markdown += '| --- | --- | --- | --- |\n'

    props[anchor].forEach((prop) => {
      markdown += `| ${prop.name} | ${prop.type} | ${prop.default} | ${prop.descriptionZh} |
`
    })

    return markdown
  }

  COMMAND_ANCHOR_FIELDS.forEach((anchor: keyof ComponentApiRecord) => {
    if (!component.props[anchor].length) {
      return ''
    }

    content += optimizeTableRender(component.props, anchor)
  })

  if (component.subComponents.length) {
    component.subComponents.forEach((subComponent) => {
      content += `\n${subComponent}\n`

      COMMAND_ANCHOR_FIELDS.forEach((anchor: keyof ComponentApiRecord) => {
        const subProps = component.subComponentProps[subComponent]!
        if (!subProps[anchor].length) {
          return ''
        }

        content += optimizeTableRender(subProps, anchor)
      })
    })
  }

  return content
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
      const component = loadComponent(config.component, await loadVersionMetaData(version))

      console.log(`${capitalize(config.component)} (${component.nameZh}) — ${component.description}`)

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
