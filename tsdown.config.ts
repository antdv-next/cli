import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsdown'

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

export default defineConfig({
  clean: true,
  dts: false,
  unbundle: false,
  define: {
    __CLI_VERSION__: JSON.stringify(version),
  },
  minify: true,
  deps: {
    onlyBundle: false,
  },
  outputOptions: {
    codeSplitting: false,
  },
})
