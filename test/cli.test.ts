import fs from 'node:fs/promises'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createMockDir, genPath, run } from './run'

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

    it('run antdv env command in text format', async () => {
        const { stdout } = await run(['env'])

        expect(stdout).toContain('Environment')
        expect(stdout).toContain('Dependencies')
    })

    it('run antdv env command in json format', async () => {
        const { stdout } = await run(['env', '--format', 'json'])
        const data = JSON.parse(stdout)

        expect(data).toHaveProperty('envinfo')
        expect(data).toHaveProperty('dependencies')
        expect(data).toHaveProperty('ecosystem')
        expect(data).toHaveProperty('buildTools')
    })
})
