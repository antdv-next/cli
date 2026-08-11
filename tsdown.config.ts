import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
    clean: true,
    dts: true,
    define: {
        __CLI_VERSION__: JSON.stringify(version),
    },
})
