import fs from 'node:fs/promises'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createMockDir, genPath, run } from '../run'

beforeEach(async () => await createMockDir())
afterAll(async () => await fs.rm(genPath, {
  recursive: true,
  force: true,
}))

describe('cli env integration', () => {
  it('runs the env command in text format', async () => {
    const { stdout } = await run(['env'])

    expect(stdout).toContain('Environment')
    expect(stdout).toContain('Dependencies')
  })

  it('runs the env command in json format', async () => {
    const { stdout } = await run(['env', '--format', 'json'])
    const data = JSON.parse(stdout)

    expect(data).toHaveProperty('envinfo')
    expect(data).toHaveProperty('dependencies')
    expect(data).toHaveProperty('ecosystem')
    expect(data).toHaveProperty('buildTools')
  })
})
