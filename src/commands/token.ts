import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'token',
        description: 'Query Design Tokens (global or component-level)',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
