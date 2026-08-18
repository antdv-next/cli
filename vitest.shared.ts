import type { ViteUserConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

interface TestFiles {
  include: string[]
  exclude?: string[]
}

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

export function createVitestConfig({ include, exclude }: TestFiles): ViteUserConfig {
  return defineConfig({
    define: {
      __CLI_VERSION__: JSON.stringify(version),
    },
    resolve: {
      alias: {
        '@/': new URL('./src/', import.meta.url).pathname,
      },
    },
    test: {
      include,
      exclude,
    },
  })
}
