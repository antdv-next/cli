import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'env',
        description: 'Collect antd-related environment information for bug reporting',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
