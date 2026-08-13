import type { ResolvedAntdvVersionEnv } from '../src/types'
import process from 'node:process'
import { runCommand } from 'citty'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import bugCommand from '../src/commands/bug'
import { ANTDV_REPO } from '../src/constants/repo'

const mocks = vi.hoisted(() => ({
    buildIssueUrl: vi.fn(),
    collectAntdvEnv: vi.fn(),
    createIssueBody: vi.fn(),
    output: vi.fn(),
}))

vi.mock('@/utils/issue.ts', () => ({
    buildIssueUrl: mocks.buildIssueUrl,
    collectAntdvEnv: mocks.collectAntdvEnv,
    createIssueBody: mocks.createIssueBody,
}))

vi.mock('@/utils/output.ts', () => ({
    output: mocks.output,
}))

const env: ResolvedAntdvVersionEnv = {
    vue: '3.5.0',
    vite: '7.0.0',
    antdv: '1.0.0',
    cli: '0.0.0',
    typescript: '6.0.0',
    system: 'darwin 25.0.0',
    package: {
        node: '26.0.0',
        npm: '11.0.0',
        pnpm: '11.9.0',
        deno: '2.0.0',
        bun: '1.0.0',
    },
}

const issueBody = 'generated issue body'
const issueUrl = 'https://github.com/antdv-next/antdv-next/issues/new?title=Button'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.collectAntdvEnv.mockResolvedValue(env)
    mocks.createIssueBody.mockReturnValue(issueBody)
    mocks.buildIssueUrl.mockReturnValue(issueUrl)
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('bug command', () => {
    it('collects issue details and renders the requested preview format', async () => {
        await runCommand(bugCommand, {
            rawArgs: [
                '--cwd',
                '/tmp/example-project',
                '--title',
                'Button cannot be clicked',
                '--reproduction',
                'https://stackblitz.com/edit/example',
                '--steps',
                'Open the demo and click the button',
                '--expected',
                'The click handler runs',
                '--actual',
                'Nothing happens',
                '--extra',
                'Only reproducible in production',
                '--format',
                'markdown',
            ],
        })

        expect(mocks.collectAntdvEnv).toHaveBeenCalledWith('/tmp/example-project')
        expect(mocks.createIssueBody).toHaveBeenCalledWith({
            reproduction: 'https://stackblitz.com/edit/example',
            steps: 'Open the demo and click the button',
            expected: 'The click handler runs',
            actual: 'Nothing happens',
            extra: 'Only reproducible in production',
            env,
        })
        expect(mocks.buildIssueUrl).toHaveBeenCalledWith(
            'Button cannot be clicked',
            ANTDV_REPO,
            issueBody,
        )
        expect(mocks.output).toHaveBeenCalledWith({
            json: {
                repo: ANTDV_REPO,
                title: 'Button cannot be clicked',
                body: issueBody,
                url: issueUrl,
            },
            text: `Repository: ${ANTDV_REPO}
Title: Button cannot be clicked

--- Issue Body ---
${issueBody}
--- Issue End ---

To submit, re-run with --submit flag.\n`,
            markdown: issueBody,
        }, 'markdown')
    })

    it('uses empty optional issue fields and text output by default', async () => {
        await runCommand(bugCommand, {
            rawArgs: [
                '--cwd',
                '/tmp/example-project',
                '--title',
                'Minimal report',
            ],
        })

        expect(mocks.createIssueBody).toHaveBeenCalledWith({
            reproduction: '',
            steps: '',
            expected: '',
            actual: '',
            extra: '',
            env,
        })
        expect(mocks.output).toHaveBeenCalledOnce()
        expect(mocks.output.mock.calls[0]?.[1]).toBe('text')
    })

    it('exits before building the issue when the reproduction link is invalid', async () => {
        const exitError = new Error('process exited')
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
            throw exitError
        })

        await expect(runCommand(bugCommand, {
            rawArgs: [
                '--cwd',
                '/tmp/example-project',
                '--title',
                'Invalid reproduction',
                '--reproduction',
                'not-a-url',
            ],
        })).rejects.toBe(exitError)

        expect(mocks.collectAntdvEnv).toHaveBeenCalledWith('/tmp/example-project')
        expect(logSpy).toHaveBeenCalledWith('Please provide a valid URL for the reproduction link.')
        expect(exitSpy).toHaveBeenCalledWith(1)
        expect(mocks.createIssueBody).not.toHaveBeenCalled()
        expect(mocks.buildIssueUrl).not.toHaveBeenCalled()
        expect(mocks.output).not.toHaveBeenCalled()
    })
})
