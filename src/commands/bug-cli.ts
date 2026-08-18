import { defineCommand } from 'citty'
import { bugArgs } from '@/args/bug.ts'
import { defaultArgs } from '@/args/default.ts'
import { createBug } from '@/commands/bug.ts'
import { ANTDV_REPO_CLI } from '@/constants/repo.ts'

export default defineCommand({
  meta: {
    name: 'bug-cli',
    description: 'Report a bug to the @antdv-next/cli repository',
  },
  args: {
    ...defaultArgs,
    ...bugArgs,
  },
  async run({ args }) {
    await createBug(ANTDV_REPO_CLI, args)
  },
})
