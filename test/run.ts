import type { ExecProcess } from 'tinyexec'
import fs from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

export const CLI_PATH = fileURLToPath(new URL('../bin/antdv.js', import.meta.url))
export const genPath = fileURLToPath(new URL(`../.temp/${randomStr()}`, import.meta.url))

export function randomStr(): string {
    return Math.random().toString(36).slice(2)
}

export async function run(params: string[] = [], env = {
    SKIP_PROMPT: '1',
    NO_COLOR: '1',
}): Promise<ExecProcess> {
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

export async function createMockDir(): Promise<void> {
    await fs.rm(genPath, { recursive: true, force: true })
    await fs.mkdir(genPath, { recursive: true })
}
