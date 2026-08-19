export interface MarkdownHeading {
  level: number
  title: string
  anchor: string
  start: number
  contentStart: number
}

export function parseHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const lines = markdown.split('\n')
  let offset = 0
  let fence = ''

  for (const rawLine of lines) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const trimmedLine = line.trimStart()
    const fenceMarker = trimmedLine.startsWith('```')
      ? '```'
      : trimmedLine.startsWith('~~~') ? '~~~' : ''

    if (fenceMarker) {
      fence = fence === fenceMarker ? '' : fence || fenceMarker
      offset += rawLine.length + 1
      continue
    }

    if (fence) {
      offset += rawLine.length + 1
      continue
    }

    const headingMatch = line.match(/^(#{1,6})[ \t]+/)

    if (!headingMatch) {
      offset += rawLine.length + 1
      continue
    }

    let rawTitle = line.slice(headingMatch[0].length).trim()

    while (rawTitle.endsWith('#')) {
      rawTitle = rawTitle.slice(0, -1).trimEnd()
    }

    const anchorMatch = rawTitle.match(/\s*\{#([^}]+)\}\s*$/)
    const title = rawTitle.replace(/\s*\{#[^}]+\}\s*$/, '').trim()

    headings.push({
      level: headingMatch[1]!.length,
      title,
      anchor: anchorMatch?.[1]?.toLowerCase() ?? '',
      start: offset,
      contentStart: offset + line.length,
    })

    offset += rawLine.length + 1
  }

  return headings
}

export function normalizeHeadingTitle(title: string): string {
  return title
    .replace(/[`*_~]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
}
