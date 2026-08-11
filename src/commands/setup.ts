import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'setup',
        description: 'Set up Ant Design MCP/Skill for AI agents or GitHub Actions',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
