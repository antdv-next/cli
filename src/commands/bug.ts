import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'bug',
        description: 'Report a bug to the antdv-next repository',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
