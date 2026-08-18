import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'setup',
        description: 'Set up Ant Design MCP/Skill for AI agents or GitHub Actions',
    },
    run({ args }) {
        // TODO antd setup
        // 为 Claude Code、Cursor、VS Code 或 Codex 接入 Ant Design MCP/Skill
        console.log('Parsed args:', args)
    },
})
