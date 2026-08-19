import type { ComponentDemoRecord } from '#/components.ts'
import type { OptionsArgs } from '@/args/args'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { demoArgs } from '@/args/demo.ts'
import { resolveConfig } from '@/config.ts'
import capitalize from '@/utils/capitalize.ts'
import { loadVersionMetaData } from '@/utils/loader.ts'
import { resolveVersion } from '@/utils/version.ts'

function outputDemoContent(demo: Record<string, ComponentDemoRecord>, args: OptionsArgs): object | string {
  const component = capitalize(args.component!)
  switch (args.format) {
    case 'json':
      return {
        component,
        demos: Object.values(demo).map((d) => {
          return {
            name: d.name,
            title: d.title,
            description: d.description,
          }
        }),
      }
    case 'text':
      return [
        `${component} Demos:`,
        ``,
        ...(Object.values(demo).map(d => [
          `  ${d.name} — ${d.title}`,
          `    ${d.description}`,
        ].join('\n'))),
      ].join('\n')
    case 'markdown':
      return [
        `## ${component} Demos`,
        ``,
        `| Name | Title | Description |`,
        `| --- | --- | --- |`,
        ...(Object.values(demo).map(d => `| ${d.name} | ${d.title} | ${d.description} |`)),
      ].join('\n')
  }
}

function outputDemoCode(demo: ComponentDemoRecord, args: OptionsArgs): string {
  const component = capitalize(args.component!)
  switch (args.format) {
    case 'json':
      return JSON.stringify({
        component,
        name: demo.name,
        title: demo.title,
        description: demo.description,
        code: demo.code,
      }, null, 2)
    case 'text':
      return [
        `${component} / ${demo.title}`,
        demo.description,
        '',
        demo.code,
      ].join('\n')
    case 'markdown':
      return [
        `## ${component} / ${demo.title}`,
        '',
        `${demo.description}`,
        '',
        '```vue',
        demo.code,
        '```',
      ].join('\n')
  }
}

export default defineCommand({
  meta: {
    name: 'demo',
    description: 'Get demo source code for a component',
  },
  args: {
    ...defaultArgs,
    ...demoArgs,
  },
  async run({ args }) {
    const config = resolveConfig(args)
    try {
      const version = await resolveVersion(config)
      const metaData = await loadVersionMetaData(version)
      const components = metaData.components.filter(c => c.name === capitalize(args.component)).at(-1)

      if (!components) {
        console.log(`Error: Component ${args.component} not found`)
        return ''
      }

      const demos = components?.demos.reduce((acc, cur) => ({
        ...acc,
        [cur.name]: cur,
      }), {}) as Record<string, ComponentDemoRecord> ?? {}

      if (!Object.keys(demos).length) {
        console.log(`Error: Demo not found for ${capitalize(args.component)} v${version.version}`)
        return ''
      }

      if (!args.name) {
        console.log(outputDemoContent(demos, args))
        return ''
      }

      if (!Object.keys(demos).includes(args.name)) {
        console.log(
          [
            `Error: Demo '${args.name}' not found for ${capitalize(args.component)} v${version.version}`,
            `Suggestion: Did you mean '${Object.keys(demos).at(0)}'?`,
          ].join('\n'),
        )
        return ''
      }

      console.log(outputDemoCode(demos[args.name]!, args))
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (error) {
      console.log(`Error: Component '${args.component}' not found`)
    }
  },
})
