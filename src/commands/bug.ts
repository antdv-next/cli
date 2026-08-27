import type { ResolvedConfig } from '@/types.ts'
import process from 'node:process'
import { defineCommand } from 'citty'
import { x } from 'tinyexec'
import { bugArgs } from '@/args/bug.ts'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import { ANTDV_REPO } from '@/constants/repo.ts'
import { logError } from '@/utils/error.ts'
import { hasGhAvailable, isUrl } from '@/utils/is.ts'
import { buildIssueUrl, collectAntdvEnv, createIssueBody } from '@/utils/issue.ts'
import { output } from '@/utils/output.ts'

export async function createBug(repo: string, config: ResolvedConfig): Promise<void> {
  const env = await collectAntdvEnv(config.cwd)

  if (config.reproduction!.length > 1 && !isUrl(config.reproduction!)) {
    console.log('Please provide a valid URL for the reproduction link.')
    process.exit(1)
  }

  const body = createIssueBody({
    reproduction: config.reproduction || '',
    steps: config.steps || '',
    expected: config.expected || '',
    actual: config.actual || '',
    extra: config.extra || '',
    env,
  })

  if (config.submit) {
    if (!(await hasGhAvailable())) {
      logError({
        message: 'gh CLI is not installed or not in PATH',
        suggestion: 'Install GitHub CLI: https://cli.github.com/ — or remove --submit to get a pre-filled URL instead',
      }, config.format)
      process.exit(1)
    }
    else {
      try {
        const result = await x('gh', [
          'issue',
          'create',
          '--repo',
          repo,
          '--title',
          config.title!,
          '--body',
          body,
          '--label',
          repo === ANTDV_REPO ? 'unconfirmed' : 'question',
          '--type',
          repo === ANTDV_REPO ? '' : 'bug',
        ], {
          nodeOptions: {
            stdio: 'pipe',
          },
        })

        const match = result.stdout.trim().match(/\/issues\/(\d+)/)
        const issueNumber = match ? parseInt(match[1]!, 10) : 0

        output({
          json: {
            repo,
            title: config.title,
            issueNumber,
            url: result.stdout.trim(),
          },
          text: '',
          markdown: '',
        }, 'json')
        process.exit(1)
      }
      catch {
        logError({
          message: '',
          suggestion: '',
        }, config.format)
        process.exit(1)
      }
    }
  }

  const url = buildIssueUrl(config.title || '', repo, body)

  output({
    json: {
      repo,
      title: config.title,
      body,
      url,
    },
    text: `Repository: ${repo}
Title: ${config.title!}

--- Issue Body ---
${body}
--- Issue End ---

To submit, re-run with --submit flag.\n`,
    markdown: body,
  }, config.format)
}

export default defineCommand({
  meta: {
    name: 'bug',
    description: 'Report a bug to the antdv-next repository',
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
    await createBug(ANTDV_REPO, config)
  },
})
