import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'design.md',
        description: 'Output the antd design-language document (design.md) for AI design tools',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
