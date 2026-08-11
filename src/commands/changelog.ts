import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'changelog',
        description: 'Query changelog or compare API differences between versions',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
