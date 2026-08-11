import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'usage',
        description: 'Scan project for antd component/API usage statistics',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
