import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'upgrade',
        description: 'Upgrade the CLI to the latest version',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
