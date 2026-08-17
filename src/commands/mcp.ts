import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'usage',
        description: 'Start MCP server for AI assistant integration',
    },
    run({ args }) {
        // TODO : stage second development
        console.log('Parsed args:', args)
    },
})
