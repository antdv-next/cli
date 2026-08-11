import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'migrate',
        description: 'Version migration guide with optional auto-fix',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
