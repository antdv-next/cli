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
    test: {
        include: [
            './test/**/*.{test,spec}.ts', // 仅运行 test/unit 文件夹下的测试
        ],
    },
})
