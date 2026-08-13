import type { ParsedArgs } from 'citty'
import { defineCommand } from 'citty'
import { bugArgs } from '@/args/bug.ts'
import { ANTDV_REPO } from '@/constants/repo.ts'
import { isUrl } from '@/utils/is.ts'
import { buildIssueUrl, collectAntdvEnv, createIssueBody } from '@/utils/issue.ts'
import { output } from '@/utils/output.ts'

export async function createBug(repo: string, args: ParsedArgs<typeof bugArgs>): Promise<void> {
    const env = await collectAntdvEnv(args.cwd)

    if (args.reproduction.length > 1 && !isUrl(args.reproduction)) {
        console.log('Please provide a valid URL for the reproduction link.')
        process.exit(1)
    }

    const body = createIssueBody({
        reproduction: args.reproduction,
        steps: args.steps,
        expected: args.expected,
        actual: args.actual,
        extra: args.extra,
        env,
    })

    const url = buildIssueUrl(args.title, repo, body)

    output({
        json: {
            repo,
            title: args.title,
            body,
            url,
        },
        text: `Repository: ${repo}
Title: ${args.title}

--- Issue Body ---
${body}
--- Issue End ---

To submit, re-run with --submit flag.\n`,
        markdown: body,
    }, args.format)
}

export default defineCommand({
    meta: {
        name: 'bug',
        description: 'Report a bug to the antdv-next repository',
    },
    args: bugArgs,
    async run({ args }) {
        await createBug(ANTDV_REPO, args)
    },
})
