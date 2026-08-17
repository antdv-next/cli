import type { ChangelogFile } from '#/components.ts'
import type { ResolvedVersion } from '@/types.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { tokenArgs } from '@/args/token.ts'
import { resolveConfig } from '@/config.ts'
import capitalize from '@/utils/capitalize.ts'
import { getDataPath } from '@/utils/loader.ts'
import { resolveVersion } from '@/utils/version.ts'

async function loadVersionMetaData(version: ResolvedVersion): Promise<ChangelogFile> {
    const versionsPath = join(getDataPath(), 'versions.json')
    const versionsIndex = JSON.parse(await readFile(versionsPath, 'utf-8'))
    if (!Object.values(versionsIndex[version.majorVersion]).includes(version.version)) {
        throw new Error(`v${version.version} not found`)
    }
    return JSON.parse(await readFile(join(getDataPath(), `v${version.version}.json`), 'utf-8')) as ChangelogFile
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
        console.log('Parsed args:', args)
        const config = resolveConfig(args)
        try {
            const version = await resolveVersion(config)

            console.log(version)

            const metaData = await loadVersionMetaData(version)

            const components = metaData.components.filter(c => c.name === capitalize(args.component))
            if (!components.length) {
                console.log(`Error: Component ${args.component} not Found`)
                process.exit(1)
            }

            // TODO show format console
            console.log(`${capitalize(args.component)} Component Tokens:`)
            console.log(components.at(-1)?.tokens ?? [])
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
        catch (error) {
            console.log(`Error: Component '${args.component}' not found`)
            process.exit(1)
        }
    },
})
