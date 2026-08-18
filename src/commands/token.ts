import type { ChangelogFile, ComponentPropRecord } from '#/components.ts'
import type { ResolvedVersion } from '@/types.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { defineCommand } from 'citty'
import { Table } from 'console-table-printer'
import { defaultArgs } from '@/args/default.ts'
import { tokenArgs } from '@/args/token.ts'
import { resolveConfig } from '@/config.ts'
import { tableBorderStyle } from '@/constants/table.ts'
import capitalize from '@/utils/capitalize.ts'
import { getDataPath } from '@/utils/loader.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

async function loadVersionMetaData(version: ResolvedVersion): Promise<ChangelogFile> {
    const versionsPath = join(getDataPath(), 'versions.json')
    const versionsIndex = JSON.parse(await readFile(versionsPath, 'utf-8'))
    if (!Object.values(versionsIndex[version.majorVersion]).includes(version.version)) {
        throw new Error(`v${version.version} not found`)
    }
    return JSON.parse(await readFile(join(getDataPath(), `v${version.version}.json`), 'utf-8')) as ChangelogFile
}

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

export default defineCommand({
    meta: {
        name: 'token',
        description: 'Query Design Tokens (global or component-level)',
    },
    args: {
        ...defaultArgs,
        ...tokenArgs,
    },
    async run({ args }) {
        const config = resolveConfig(args)
        try {
            const version = await resolveVersion(config)

            const metaData = await loadVersionMetaData(version)

            if (args.component) {
                const components = metaData.components.filter(c => c.name === capitalize(args.component))
                if (!components.length) {
                    console.log(`Error: Component ${args.component} not Found`)
                    process.exit(1)
                }

                // TODO show format console
                if (args.format !== 'json') {
                    console.log(`${capitalize(args.component)} Component Tokens:`)
                }
                const tokens = components.at(-1)?.tokens ?? []
                output({
                    json: { token: tokens },
                    text: outputTokenTable(tokens),
                    markdown: outputTokenMarkdown(tokens),
                }, args.format)

                return ''
            }

            output({
                json: { token: metaData.globalTokens },
                text: outputTokenTable(metaData.globalTokens),
                markdown: outputTokenMarkdown(metaData.globalTokens),
            }, args.format)
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
        catch (error) {
            console.log(`Error: Component '${args.component}' not found`)
            process.exit(1)
        }
    },
})
