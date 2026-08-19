import type { ComponentSemanticStructureRecord } from '#/components.ts'
import { defineCommand } from 'citty'
import { componentArgs } from '@/args/component.ts'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import capitalize from '@/utils/capitalize.ts'
import { logErrorComponent } from '@/utils/error.ts'
import { loadComponent, loadVersionMetaData } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

function outputTextSemantic(component: string, semantic: ComponentSemanticStructureRecord[]): string {
  let content = `${component} Semantic Structure:\n`

  semantic.forEach((item, index, array) => {
    if (index === array.length - 1) {
      content += `└── ${item.key}         # ${item.description}\n`
    }
    else {
      content += `├── ${item.key}         # ${item.description}\n`
    }
  })

  return content
}

function outputMarkdownSemantic(component: string, semantic: ComponentSemanticStructureRecord[]): string {
  return [
    `## ${component} Semantic Structure:`,
    '',
    '| Key | Description |',
    '| --- | --- |',
    ...semantic.map(item => `| ${item.key} | ${item.description} |`),
  ].join('\n')
}

export default defineCommand({
  meta: {
    name: 'semantic',
    description: 'Query the semantic customization structure of a component',
  },
  args: {
    ...defaultArgs,
    ...componentArgs,
  },
  async run({ args }) {
    const config = resolveConfig(args)
    const component = capitalize(args.component)

    try {
      const version = await resolveVersion(config)
      const metaData = loadComponent(component, await loadVersionMetaData(version))

      const semantic = metaData.semanticStructure

      if (!semantic.length) {
        console.log(`No semantic structure data available for ${capitalize(component)}.`)
        return ''
      }

      output({
        json: {
          name: component,
          semanticStructure: semantic,
        },
        text: outputTextSemantic(component, semantic),
        markdown: outputMarkdownSemantic(component, semantic),
      }, args.format)
    }
    catch (error) {
      logErrorComponent(args)
    }
  },
})
