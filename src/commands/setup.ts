import type { clientOption, modeOption } from '@/args/setup.ts'
import type { ResolvedConfig } from '@/types.ts'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { setupArgs } from '@/args/setup.ts'
import { resolveConfig } from '@/config.ts'
import { __dirname } from '@/constants/dirname.ts'
import { logError } from '@/utils/error.ts'
import { output } from '@/utils/output.ts'

interface SetupResult {
  cwd: string
  client: clientOption
  mode: modeOption
  file: string
  config: Record<string, unknown>
  skillDir?: string
  skillChanged?: boolean
  instructionsFile?: string
  instructionsChanged?: boolean
}

interface ClientConfig {
  file: string
  serverKey: 'mcpServers' | 'servers'
}

interface SkillDir {
  dir: string
  changed: boolean
}

interface WriteInstructions {
  file: string
  changed: boolean
}

const INSTRUCTIONS_START = '<!-- antdv-next-cli setup start -->'
const INSTRUCTIONS_END = '<!-- antdv-next-cli setup end -->'

const CLIENTS_CONFIG: Record<clientOption, ClientConfig> = {
  claude: { file: '.mcp.json', serverKey: 'mcpServers' },
  cursor: { file: '.cursor/mcp.json', serverKey: 'mcpServers' },
  vscode: { file: '.vscode/mcp.json', serverKey: 'servers' },
}

function resolveSkillDir(config: ResolvedConfig): string {
  if (config.client === 'claude')
    return join(config.cwd, '.claude', 'skills', 'antdv')
  return join(config.cwd, '.agents', 'skills', 'antdv')
}

function resolveSkillPath(config: ResolvedConfig): string {
  return resolve(resolveSkillDir(config), 'SKILL.md').replace(config.cwd, '.')
}

function resolveChooseInstructionsFile(config: ResolvedConfig): string {
  if (config.client === 'github-actions')
    return resolve(config.cwd, '.github', 'workflows', 'antdv-cli.yml')

  return resolve(config.cwd, config.client === 'claude' ? 'CLAUDE.md' : 'AGENTS.md')
}

function createGitHubActionsWorkflow(): string {
  return [
    'name: Antdv-Next CLI',
    '',
    'on:',
    '  pull_request:',
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  antdv:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v7',
    '      - uses: actions/setup-node@v6',
    '        with:',
    '          node-version: lts/*',
    '          cache: npm',
    '      - run: npm ci',
    '      - run: npm run build',
    '      - name: Run antdv doctor',
    `        run: npx -y @antdv-next/cli doctor --format json`,
    '',
  ].join('\n')
}

function createMcpServers(server: ClientConfig): Record<string, unknown> {
  return {
    [server.serverKey]: {
      antdv: {
        command: 'npx',
        args: [
          '-y',
          '@antdv-next/cli',
          'mcp',
        ],
      },
    },
  }
}

async function createInstallSkill(config: ResolvedConfig): Promise<SkillDir> {
  const source = resolve(__dirname, '../skills/antdv/')
  const target = resolveSkillDir(config)
  const sourceSkill = join(source, 'SKILL.md')
  const targetSkill = join(target, 'SKILL.md')

  const changed = !existsSync(targetSkill) || readFileSync(sourceSkill, 'utf-8') !== readFileSync(targetSkill, 'utf-8')
  if (changed) {
    await mkdir(dirname(target), { recursive: true })
    await cp(source, target, { recursive: true, force: true })
  }
  return {
    dir: target,
    changed,
  }
}

function createSkillInstructionsBlock(config: ResolvedConfig): string {
  const skillPath = resolveSkillPath(config)
  const label = config.client === 'claude' ? 'installed antdv-next skill' : 'shared antdv-next skill'
  return [
    INSTRUCTIONS_START,
    '## Antdv Next CLI Skill',
    '',
    `Use the ${label} at \`${skillPath}\` before working on Antdv Next code in this repository.`,
    '',
    'The skill teaches agents when and how to call `@antdv-next/cli` commands such as `antdv info`, `antdv doc`, `antdv demo`, `antdv token`, `antdv semantic`, and `antdv changelog`.',
    '',
    INSTRUCTIONS_END,
  ].join('\n')
}

function createMcpInstructionsBlock(): string {
  return [
    INSTRUCTIONS_START,
    '## Antdv Next CLI MCP',
    '',
    'When working with Antdv Next in this repository, use the configured `antdv` MCP server before writing component code:',
    '',
    '- Use `antdv_info` for component props/events/slots, defaults, common props, and native HTML element hints.',
    '- Use `antdv_doc` when you need the full component API documentation.',
    '- Use `antdv_demo` before generating non-trivial usage examples.',
    '- Use `antdv_token` and `antdv_next_md` for theme, token, and design-language work.',
    '- Use `antdv_semantic` when customizing `class` or `styles` slots.',
    '',
    INSTRUCTIONS_END,
  ].join('\n')
}

function createInstructionsBlock(config: ResolvedConfig): string {
  if (config.mode === 'skill')
    return createSkillInstructionsBlock(config)

  if (config.mode === 'both') {
    const skillPath = resolveSkillPath(config)
    const label = config.client === 'claude' ? 'installed antdv-next skill' : 'shared antdv-next skill'
    return createMcpInstructionsBlock().replace(
      INSTRUCTIONS_END,
      [
        `Use the ${label} at \`${skillPath}\` for CLI fallback guidance and project-local agent instructions.`,
        '',
        INSTRUCTIONS_END,
      ].join('\n'),
    )
  }

  return createMcpInstructionsBlock()
}

async function createWriteInstructions(config: ResolvedConfig): Promise<WriteInstructions> {
  const file = resolveChooseInstructionsFile(config)
  const current = existsSync(file) ? await readFile(file, 'utf-8') : ''
  const next = createInstructionsBlock(config)
  const changed = current !== next

  if (changed) {
    await writeFile(file, next)
  }

  return {
    file,
    changed,
  }
}

async function createSetup(config: ResolvedConfig): Promise<SetupResult> {
  const isGitHubActions = config.client === 'github-actions'
  const clientConfig = !['github-actions', 'codex'].includes(config.client!) ? CLIENTS_CONFIG[config.client!] : undefined
  const file = isGitHubActions
    ? resolve(config.cwd, '.github', 'workflows', 'antd-cli.yml')
    : clientConfig ? resolve(config.cwd, clientConfig.file) : resolveChooseInstructionsFile(config)

  if (isGitHubActions) {
    const workflow = createGitHubActionsWorkflow()

    return {
      client: config.client!,
      mode: config.mode!,
      cwd: config.cwd,
      file,
      config: { workflow },
    }
  }

  const server = ['mcp', 'both'].includes(config.mode!) ? createMcpServers(clientConfig!) : {}
  if (server) {
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(server, null, 2), 'utf-8')
  }

  const skill = ['skill', 'both'].includes(config.mode!)
    ? await createInstallSkill(config)
    : {
        dir: '',
        changed: false,
      }

  const instructionsFile = ['skill', 'both'].includes(config.mode!) || config.writeInstructions
    ? await createWriteInstructions(config)
    : {
        file: '',
        changed: false,
      }

  return {
    client: config.client!,
    mode: config.mode!,
    cwd: config.cwd,
    file,
    config: server,
    ...(skill.dir
      ? {
          skillDir: skill.dir,
          skillChanged: skill.changed,
        }
      : {}),
    ...(instructionsFile.file
      ? {
          instructionsFile: instructionsFile.file,
          instructionsChanged: instructionsFile.changed,
        }
      : {}),
  }
}

function transformText(result: SetupResult): string {
  let content = ''
  const targets = [
    ...(result.mode === 'skill' ? [] : [result.file]),
    ...(result.skillDir ? [result.skillDir] : []),
    ...(result.instructionsFile ? [result.instructionsFile] : []),
  ]
  targets.forEach((t) => {
    content += `Already configured:${t}\n`
  })

  return content
}

function transformMarkdown(result: SetupResult): string {
  return [
    `## Setup Agent`,
    '',
    `| Field | Value |`,
    '|---|---|',
    `| Client | ${result.client} |`,
    `| Mode | ${result.mode} |`,
    `| File | ${result.file} |`,
    `| Instructions Changed | ${String(result.instructionsChanged ?? false)} |`,
  ].join('\n')
}

export default defineCommand({
  meta: {
    name: 'setup',
    description: 'Set up Ant Design MCP/Skill for AI agents or GitHub Actions',
  },
  args: {
    ...defaultArgs,
    ...setupArgs,
  },
  async run({ args }) {
    const config = resolveConfig(args)
    config.mode = args.mode
    config.client = args.client
    config.writeInstructions = args['write-instructions']

    if (config.client === 'codex' && config.mode !== 'skill') {
      logError({
        message: `Codex setup only supports '--mode skill'`,
        suggestion: 'Use `antdv setup --client codex --mode skill` to install the project skill.',
      }, args.format)
      process.exit(1)
    }

    if (config.client === 'github-actions' && config.mode !== 'ci') {
      logError({
        message: 'GitHub Actions setup only supports `--mode ci`',
        suggestion: 'Use `antdv setup --client github-actions --mode ci` to write the workflow.',
      }, args.format)
      process.exit(1)
    }

    if (config.client !== 'github-actions' && config.mode === 'ci') {
      logError({
        message: `'--mode ci' is only supported with --client github-actions`,
        suggestion: 'Use `--mode mcp`, `--mode skill`, or `--mode both` for agent clients.',
      }, args.format)
      process.exit(1)
    }

    const result = await createSetup(config)
    output({
      json: result,
      text: transformText(result),
      markdown: transformMarkdown(result),
    }, args.format)
  },
})
