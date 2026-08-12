import fs from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const CLI_PATH = fileURLToPath(new URL('../bin/antdv.js', import.meta.url))
const genPath = fileURLToPath(new URL(`../.temp/${randomStr()}`, import.meta.url))

function randomStr() {
    return Math.random().toString(36).slice(2)
}

async function run(params: string[] = [], env = {
    SKIP_PROMPT: '1',
    NO_COLOR: '1',
}) {
    return x(process.execPath, [CLI_PATH, ...params], {
        throwOnError: true,
        nodeOptions: {
            cwd: genPath,
            env: {
                ...process.env,
                ...env,
            },
        },
    })
}

async function createMockDir() {
    await fs.rm(genPath, { recursive: true, force: true })
    await fs.mkdir(genPath, { recursive: true })
}

beforeEach(async () => await createMockDir())
afterAll(async () => await fs.rm(genPath, {
    recursive: true,
    force: true,
}))

describe('cli', () => {
    it('run antdv command', async () => {
        const { stdout } = await run()

        expect(stdout).toContain('@antdv-next/cli v0.0.0')
    })

    it('run antdv env command', async () => {
        const { stdout } = await run(['env'])

        expect(stdout).toContain('Parsed args')
    })
})
