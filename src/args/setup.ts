import type { ArgsDef } from 'citty'

export const clientOptions = ['claude', 'cursor', 'vscode', 'codex', 'github-actions']
export type clientOption = typeof clientOptions[number]
export const modeOptions = ['mcp', 'skill', 'both', 'ci']
export type modeOption = typeof modeOptions[number]

export const setupArgs = {
  'client': {
    type: 'enum',
    description: 'Agent client: claude, cursor, vscode, codex, or github-actions',
    options: clientOptions,
    default: '',
    required: true,
  },
  'mode': {
    type: 'enum',
    description: 'Setup mode: mcp, skill, both, or ci',
    options: modeOptions,
    default: '',
    required: true,
  },
  'write-instructions': {
    type: 'boolean',
    description: 'Write agent instructions for using the antdv MCP server',
    default: false,
  },
} satisfies ArgsDef
