import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'semantic',
        description: 'Query the semantic customization structure of a component',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
