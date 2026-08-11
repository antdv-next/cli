import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'lint',
        description: 'Check antdv-next usage against best practices',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
