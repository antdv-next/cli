import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'doc',
        description: 'Output the full API documentation for a component in markdown',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
