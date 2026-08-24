import type { ComponentPropRecord } from '#/components.ts'
import type { ResolvedVersion } from '@/types.ts'
import { defineCommand } from 'citty'
import { Table } from 'console-table-printer'
import { componentArgs } from '@/args/component.ts'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import { tableBorderStyle } from '@/constants/table.ts'
import capitalize from '@/utils/capitalize.ts'
import { logErrorComponent } from '@/utils/error.ts'
import { loadVersionMetaData } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

function outputTokenTable(tokens: ComponentPropRecord[]): string {
  const p = new Table({
    style: tableBorderStyle,
    columns: [
      { name: 'Token', alignment: 'left' },
      { name: 'Type', alignment: 'left' },
      { name: 'Default', alignment: 'left' },
    ],
  })

  tokens.forEach((token) => {
    p.addRow({ Token: token.name, Type: token.type, Default: token.default })
  })

  return p.render()
}

function outputTokenMarkdown(tokens: ComponentPropRecord[]): string {
  let content = '\n| Token | Type | Default |\n'
  content += '| --- | --- | --- |\n'

  tokens.forEach((token) => {
    content += `| ${token.name} | ${token.type} | ${token.default} |\n`
  })
  return content
}

export async function getComponentToken(component: string, version: ResolvedVersion): Promise<ComponentPropRecord[]> {
  const metaData = await loadVersionMetaData(version)
  if (!component) {
    return metaData.globalTokens
  }

  const components = metaData.components.filter(c => c.name === capitalize(component))
  if (!components.length) {
    throw new Error(`Component ${component} not found`)
  }

  return components.at(-1)?.tokens ?? []
}

export default defineCommand({
  meta: {
    name: 'token',
    description: 'Query Design Tokens (global or component-level)',
  },
  args: {
    ...defaultArgs,
    ...componentArgs,
  },
  async run({ args }) {
    const config = resolveConfig(args)
    try {
      const version = await resolveVersion(config)
      const tokens = await getComponentToken(args.component, version)

      if (args.component) {
        if (args.format !== 'json') {
          console.log(`${capitalize(args.component)} Component Tokens:`)
        }
        output({
          json: { token: tokens },
          text: outputTokenTable(tokens),
          markdown: outputTokenMarkdown(tokens),
        }, args.format)

        return ''
      }

      output({
        json: { token: tokens },
        text: outputTokenTable(tokens),
        markdown: outputTokenMarkdown(tokens),
      }, args.format)
    }

    catch (error) {
      logErrorComponent(args)
    }
  },
})
