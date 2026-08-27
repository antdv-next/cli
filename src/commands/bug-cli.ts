import { defineCommand } from 'citty'
import { bugArgs } from '@/args/bug.ts'
import { defaultArgs } from '@/args/default.ts'
import { createBug } from '@/commands/bug.ts'
import { resolveConfig } from '@/config.ts'
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
    const config = resolveConfig(args)
    config.title = args.title
    config.reproduction = args.reproduction
    config.steps = args.steps
    config.expected = args.expected
    config.actual = args.actual
    config.extra = args.extra
    config.submit = args.submit

    await createBug(ANTDV_REPO_CLI, config)
  },
})
