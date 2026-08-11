import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'list',
        description: 'List all components with bilingual names, descriptions, and first-supported version',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
