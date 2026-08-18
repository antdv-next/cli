import type { ComponentRecord } from '#/components.ts'
import { defineCommand } from 'citty'
import { Table } from 'console-table-printer'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import { tableBorderStyle } from '@/constants/table.ts'
import { loadVersionMetaData } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

function outputMarkdown(components: ComponentRecord[]): string {
    let context = '| Component | Name | Description |\n'
    context += '| --- | --- | --- |\n'

    components.forEach((component) => {
        context += `| ${component.name} | ${component.nameZh} | ${component.description} |\n`
    })

    return context
}

function outputTable(components: ComponentRecord[]): string {
    const p = new Table({
        style: tableBorderStyle,
        columns: [
            { name: 'Component', alignment: 'left' },
            { name: 'Name', alignment: 'left' },
            { name: 'Description', alignment: 'left' },
        ],
    })

    components.forEach((component) => {
        p.addRow({
            Component: component.name,
            Name: component.nameZh,
            Description: component.description,
        })
    })

    return p.render()
}

export default defineCommand({
    meta: {
        name: 'list',
        description: 'List all components with bilingual names, descriptions, and first-supported version',
    },
    args: defaultArgs,
    async run({ args }) {
        const config = resolveConfig(args)
        const version = await resolveVersion(config)

        const metaData = await loadVersionMetaData(version)
        const components = metaData.components

        output({
            text: outputTable(components),
            json: components,
            markdown: outputMarkdown(components),
        }, args.format)
    },
})
