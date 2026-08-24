import type { ComponentRecord } from '#/components.ts'
import type { ResolvedVersion } from '@/types.ts'
import { defineCommand } from 'citty'
import { componentArgs } from '@/args/component.ts'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import capitalize from '@/utils/capitalize.ts'
import { logErrorComponent } from '@/utils/error.ts'
import { loadComponent, loadVersionMetaData } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

export async function getComponentDocument(component: string, version: ResolvedVersion): Promise<ComponentRecord> {
  const metaData = await loadVersionMetaData(version)
  return loadComponent(component, metaData)
}

export default defineCommand({
  meta: {
    name: 'doc',
    description: 'Output the full API documentation for a component in markdown',
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
      const components = await getComponentDocument(component, version)

      if (!components.doc) {
        logErrorComponent(args)
        return ''
      }

      output({
        json: {
          name: component,
          doc: components.doc,
        },
        text: components.doc,
        markdown: components.doc,
      }, args.format)
    }
    catch (error) {
      logErrorComponent(args)
    }
  },
})
