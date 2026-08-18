import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
    define: {
        __CLI_VERSION__: JSON.stringify(version),
    },
    resolve: {
        alias: {
            '@/': new URL('./src/', import.meta.url).pathname,
        },
    },
})
