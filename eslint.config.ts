import type { Linter } from 'eslint'
import antfu from '@antfu/eslint-config'
import vuoto from 'eslint-plugin-vuoto'

const config = antfu({
  type: 'lib',
  typescript: true,
  stylistic: {
    indent: 2,
    quotes: 'single',
  },
  rules: {
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'antfu/top-level-function': 'off',
    'regexp/no-unused-capturing-group': 'off',
    'unused-imports/no-unused-vars': 'off',
  },
  yaml: {
    overrides: {
      'yaml/indent': ['error', 2],
    },
  },
}, {
  name: 'custom/vuoto',
  plugins: {
    vuoto,
  },
  rules: {
    'vuoto/zero-width': 'error',
  },
}) as Linter.Config

export default config
