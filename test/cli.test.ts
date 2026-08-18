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
})
