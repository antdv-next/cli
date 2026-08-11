import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'demo',
        description: 'Get demo source code for a component',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
