import type { Linter } from 'eslint'
import antfu from '@antfu/eslint-config'

const config = antfu({
    type: 'lib',
    typescript: true,
    stylistic: {
        indent: 4,
        quotes: 'single',
    },
    rules: {
        'no-console': 'off',
        'node/prefer-global/process': 'off',
        'antfu/top-level-function': 'off',
        'regexp/no-unused-capturing-group': 'off',
    },
    yaml: {
        overrides: {
            'yaml/indent': ['error', 2],
        },
    },
}) as Linter.Config

export default config
