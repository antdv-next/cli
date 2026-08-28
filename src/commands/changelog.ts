import type { ChangedApiItem, ComponentDiffResult, DiffApiItem } from '#/changelog.ts'
import { defineCommand } from 'citty'
import { changelogArgs } from '@/args/changelog.ts'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import { diffComponent } from '@/utils/api-diff.ts'
import { logError } from '@/utils/error.ts'
import { output } from '@/utils/output.ts'
import { resolveVersion } from '@/utils/version.ts'

function formatApiItem(item: DiffApiItem): string {
  return `[${item.category}] ${item.scope}.${item.name}${item.type ? `: ${item.type}` : ''}`
}

function formatChangedItem(item: ChangedApiItem): string[] {
  if (item.changeType === 'renamed') {
    return [
      `  ~ [${item.category}] ${item.scope}.${item.from.name} -> ${item.to.name}`,
      `    rename confidence: ${item.confidence}`,
    ]
  }

  const lines = [`  ~ [${item.category}] ${item.scope}.${item.name}`]

  for (const field of item.fields) {
    switch (field) {
      case 'type':
        lines.push(`    type: ${item.from.type || '-'} -> ${item.to.type || '-'}`)
        break
      case 'default':
        lines.push(`    default: ${item.from.default || '-'} -> ${item.to.default || '-'}`)
        break
      case 'signature':
        lines.push(`    signature: ${item.from.name} -> ${item.to.name}`)
        break
      case 'deprecated':
        lines.push(`    deprecated: ${item.changeType === 'deprecated' ? 'false -> true' : 'changed'}`)
        break
    }
  }

  return lines
}

export function outputTextChangelog(result: ComponentDiffResult): string {
  const lines = [`Antdv Next API Diff: ${result.from} -> ${result.to}`]

  if (!result.diffs.length) {
    lines.push('', 'No API differences found.')
    return lines.join('\n')
  }

  for (const diff of result.diffs) {
    lines.push('', diff.component)

    if (diff.added.length) {
      lines.push(' Added', ...diff.added.map(item => `  + ${formatApiItem(item)}`))
    }
    if (diff.removed.length) {
      lines.push(' Removed', ...diff.removed.map(item => `  - ${formatApiItem(item)}`))
    }
    if (diff.changed.length) {
      lines.push(' Changed', ...diff.changed.flatMap(formatChangedItem))
    }
  }

  return lines.join('\n')
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function getChangedBefore(item: ChangedApiItem): string {
  return item.changeType === 'renamed'
    ? `${item.from.name}: ${item.from.type || '-'}`
    : item.fields.map((field) => {
        if (field === 'signature') {
          return item.from.name
        }
        if (field === 'deprecated') {
          return 'deprecated: false'
        }
        return `${field}: ${item.from[field] || '-'}`
      }).join('<br>')
}

function getChangedAfter(item: ChangedApiItem): string {
  return item.changeType === 'renamed'
    ? `${item.to.name}: ${item.to.type || '-'}`
    : item.fields.map((field) => {
        if (field === 'signature') {
          return item.to.name
        }
        if (field === 'deprecated') {
          return `deprecated: ${item.changeType === 'deprecated' ? 'true' : 'changed'}`
        }
        return `${field}: ${item.to[field] || '-'}`
      }).join('<br>')
}

export function outputMarkdownChangelog(result: ComponentDiffResult): string {
  const lines = [`# Antdv Next API Diff: ${result.from} → ${result.to}`]

  if (!result.diffs.length) {
    lines.push('', 'No API differences found.')
    return lines.join('\n')
  }

  for (const diff of result.diffs) {
    lines.push(
      '',
      `## ${diff.component}`,
      '',
      '| Change | Category | Scope | Name | Before | After |',
      '| --- | --- | --- | --- | --- | --- |',
    )

    for (const item of diff.added) {
      lines.push(`| Added | ${item.category} | ${item.scope} | ${escapeMarkdown(item.name)} | - | ${escapeMarkdown(item.type || '-')} |`)
    }
    for (const item of diff.removed) {
      lines.push(`| Removed | ${item.category} | ${item.scope} | ${escapeMarkdown(item.name)} | ${escapeMarkdown(item.type || '-')} | - |`)
    }
    for (const item of diff.changed) {
      lines.push(`| ${item.changeType} | ${item.category} | ${item.scope} | ${escapeMarkdown(item.name)} | ${escapeMarkdown(getChangedBefore(item))} | ${escapeMarkdown(getChangedAfter(item))} |`)
    }
  }

  return lines.join('\n')
}

export default defineCommand({
  meta: {
    name: 'changelog',
    description: 'Compare component API differences between versions',
  },
  args: {
    ...defaultArgs,
    ...changelogArgs,
  },
  async run({ args }) {
    const config = resolveConfig(args)

    try {
      const v1 = await resolveVersion({ ...config, version: args.from })
      const v2 = await resolveVersion({ ...config, version: args.to })
      const result = await diffComponent(v1, v2, args.component)

      output({
        json: result,
        text: outputTextChangelog(result),
        markdown: outputMarkdownChangelog(result),
      }, args.format)
    }
    catch (error) {
      logError({
        message: error instanceof Error ? error.message : String(error),
      }, args.format)
    }
  },
})
