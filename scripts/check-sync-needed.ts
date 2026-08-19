#!usr/bin/env node

import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

const PACKAGE_NAME = 'antdv-next'
const DATA_DIR = fileURLToPath(new URL('../data', import.meta.url))

async function getLatestStableVersion(): Promise<string> {
  const version = await x('npm', ['view', `${PACKAGE_NAME}`, 'version'], {
    nodeOptions: {
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  })

  return version.stdout.trim()
}

function setOutput(name: string, value: string): void {
  const line = `${name}=${value}`
  console.log(`::set-output name=${name}::${value}`) // 兼容旧版
  console.log(`GITHUB_OUTPUT → ${line}`)

  const githubOutput = process.env.GITHUB_OUTPUT
  if (githubOutput) {
    appendFileSync(githubOutput, `${line}\n`, 'utf-8')
  }
}

async function main() {
  console.log(`🔍 Checking latest stable version of ${PACKAGE_NAME}...`)

  const latestVersion = await getLatestStableVersion()
  console.log(`📦 Latest stable version: ${latestVersion}`)

  const targetFile = join(DATA_DIR, `v${latestVersion}.json`)

  const exists = existsSync(targetFile)

  console.log(`📁 Looking for: ${targetFile}`)
  console.log(exists ? '✅ File already exists' : '⚠️  File does NOT exist')

  if (exists) {
    console.log('✨ No sync needed.')
    setOutput('needs_sync', 'false')
    setOutput('version', latestVersion)
    process.exit(0)
  }

  console.log('🚀 needs_sync = true → subsequent job should run sync.ts')
  setOutput('needs_sync', 'true')
  setOutput('version', latestVersion)
}

await main().then(() => {
})
