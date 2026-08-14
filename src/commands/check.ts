import { defineCommand } from 'citty'
import { reportUpdateCheck } from '@/utils/check.ts'

export default defineCommand({
    meta: {
        name: 'check',
        description: 'Test item version',
    },
    async run() {
        await reportUpdateCheck()
    },
})
