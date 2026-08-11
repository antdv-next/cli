import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'bug-cli',
        description: 'Report a bug to the @antdv-next/cli repository',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
