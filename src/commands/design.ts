import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { getDataPath } from '@/utils/loader.ts'

export default defineCommand({
    meta: {
        name: 'design.md',
        description: 'Output the antd design-language document (design.md) for AI design tools',
    },
    args: defaultArgs,
    async run({ args }) {
        const doc = await readFile(join(getDataPath(), 'design.md'), 'utf-8')

        if (args.format === 'json') {
            console.log(JSON.stringify({ doc }, null, 2))
            return ''
        }
        process.stdout.write(`${doc}\n`)
    },
})
