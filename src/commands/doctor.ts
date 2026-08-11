import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'doctor',
        description: 'Diagnose project-level antd configuration issues',
    },
    run({ args }) {
        console.log('Parsed args:', args)
    },
})
