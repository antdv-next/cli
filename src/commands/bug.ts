import process from 'node:process'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args.ts'
import { ANTDV_REPO } from '@/constants/repo.ts'
import { isUrl } from '@/utils/is.ts'
import { buildIssueUrl, collectAntdvEnv, createIssueBody } from '@/utils/issue.ts'
import { output } from '@/utils/output.ts'

export default defineCommand({
    meta: {
        name: 'bug',
        description: 'Report a bug to the antdv-next repository',
    },
    args: {
        ...defaultArgs,
        // 问题标题
        title: {
            type: 'string',
            description: 'Issue title',
            required: true,
            alias: 't',
        },
        // 重现链接
        reproduction: {
            type: 'string',
            description: 'Reproduction link',
            default: '',
        },
        // 重现步骤
        steps: {
            type: 'string',
            description: 'Steps to reproduce',
            default: '',
        },
        // 期望的结果是什么？
        expected: {
            type: 'string',
            description: 'Expected behavior',
            default: '',
        },
        // 实际的结果是什么?
        actual: {
            type: 'string',
            description: 'Actual behavior',
            default: '',
        },
        // 补充说明
        extra: {
            type: 'string',
            description: 'Additional comments',
            default: '',
        },
        // 是否 cli 创建 issues
        submit: {
            type: 'boolean',
            description: 'Submit via gh CLI instead of previewing',
            default: false,
        },
    },
    async run({ args }) {
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

        const url = buildIssueUrl(args.title, ANTDV_REPO, body)

        output({
            json: {
                repo: ANTDV_REPO,
                title: args.title,
                body,
                url,
            },
            text: `Repository: ${ANTDV_REPO}
Title: ${args.title}

--- Issue Body ---
${body}
--- Issue End ---

To submit, re-run with --submit flag.\n`,
            markdown: body,
        }, args.format)
    },
})
