import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'info',
        description: 'Query component API: props, type definitions, default values',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
