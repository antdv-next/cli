// @env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { downloadTemplate } from 'giget'

interface ChangelogItem {
    component: string
    type: string
    description: string
}

interface ChangelogRecord {
    version: string
    date: string | null
    changelog: ChangelogItem[]
}

interface ParsedSection {
    record: ChangelogRecord
    listItemCount: number
}

interface ParsedChangelog {
    records: ChangelogRecord[]
    listItemCount: number
}

const REPOSITORY_SOURCE = 'github:antdv-next/antdv-next#main'
const CHANGELOG_FILE = 'docs/src/pages/components/changelog.en-US.md'
const OUTPUT_FILE = fileURLToPath(new URL('../data/changelog.json', import.meta.url))
const VERSION_HEADING_PATTERN = /^##[ \t]+v?(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?)(?:[ \t]+-[ \t]+(\d{4}-\d{2}-\d{2}))?[ \t]*$/gim
const RELEASE_DATE_PATTERN = /^Release Date[ \t]*:[ \t]*(\d{4}-\d{2}-\d{2})[ \t]*$/i
const LIST_ITEM_PATTERN = /^[*+-][ \t]+(\S.*)$/
const LIST_ITEM_CONTINUATION_PATTERN = /^[ \t]+(\S.*)$/
const COMMIT_METADATA_PATTERN = /^(feat|fix|docs|test|chore|perf|refactor|build|ci|style|revert)(?:\(([^)\r\n]+)\))?!?:[ \t]+(\S[\s\S]*)$/

function trimBlankLines(lines: string[]): string[] {
    let start = 0
    let end = lines.length

    while (start < end && lines[start]?.trim() === '') {
        start += 1
    }

    while (end > start && lines[end - 1]?.trim() === '') {
        end -= 1
    }

    return lines.slice(start, end)
}

function collectListItems(lines: string[]): string[] {
    const items: string[] = []
    let currentItem: string[] | null = null

    const finishCurrentItem = (): void => {
        if (!currentItem) {
            return
        }

        items.push(trimBlankLines(currentItem).join('\n'))
        currentItem = null
    }

    for (const line of lines) {
        const listItemMatch = line.match(LIST_ITEM_PATTERN)

        if (listItemMatch?.[1]) {
            finishCurrentItem()
            currentItem = [listItemMatch[1]]
            continue
        }

        if (!currentItem) {
            continue
        }

        if (line.trim() === '') {
            currentItem.push('')
            continue
        }

        const continuationMatch = line.match(LIST_ITEM_CONTINUATION_PATTERN)

        if (continuationMatch?.[1]) {
            currentItem.push(continuationMatch[1])
            continue
        }

        finishCurrentItem()
    }

    finishCurrentItem()

    return items
}

function assertValidDate(date: string, context: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error(`Invalid release date ${date} in ${context}`)
    }

    const year = Number(date.slice(0, 4))
    const month = Number(date.slice(5, 7))
    const day = Number(date.slice(8, 10))
    const parsedDate = new Date(Date.UTC(year, month - 1, day))

    if (
        parsedDate.getUTCFullYear() !== year
        || parsedDate.getUTCMonth() + 1 !== month
        || parsedDate.getUTCDate() !== day
    ) {
        throw new Error(`Invalid release date ${date} in ${context}`)
    }
}

function parseSection(
    rawSection: string,
    version: string,
    inlineDate: string | null,
): ParsedSection {
    const lines = trimBlankLines(rawSection.split('\n'))
    const releaseDateMatch = lines[0]?.match(RELEASE_DATE_PATTERN)
    const releaseDate = releaseDateMatch?.[1] ?? null

    if (releaseDateMatch) {
        lines.shift()
    }

    if (inlineDate && releaseDate && inlineDate !== releaseDate) {
        throw new Error(
            `Conflicting release dates for ${version} in ${CHANGELOG_FILE}: ${inlineDate} and ${releaseDate}`,
        )
    }

    const date = inlineDate ?? releaseDate
    if (date) {
        assertValidDate(date, `${CHANGELOG_FILE} (${version})`)
    }

    const listItems = collectListItems(lines)
    const changelog = listItems.flatMap((item): ChangelogItem[] => {
        const match = item.match(COMMIT_METADATA_PATTERN)

        if (!match) {
            return []
        }

        const [, type, component, description] = match

        if (!type || !description) {
            return []
        }

        return [{
            component: component?.trim() || '',
            type,
            description: description.trim(),
        }]
    })

    return {
        record: {
            version,
            date,
            changelog,
        },
        listItemCount: listItems.length,
    }
}

function parseChangelog(markdown: string): ParsedChangelog {
    const normalizedMarkdown = markdown.replace(/\r\n?/g, '\n')
    const matches = [...normalizedMarkdown.matchAll(VERSION_HEADING_PATTERN)]

    if (matches.length === 0) {
        throw new Error(`No version headings found in ${CHANGELOG_FILE}`)
    }

    const seenVersions = new Set<string>()

    const sections = matches.map((match, index) => {
        const version = match[1]
        const sectionStart = match.index + match[0].length
        const sectionEnd = matches[index + 1]?.index ?? normalizedMarkdown.length

        if (!version) {
            throw new Error(`Invalid version heading in ${CHANGELOG_FILE}: ${match[0]}`)
        }

        if (seenVersions.has(version)) {
            throw new Error(`Duplicate version ${version} in ${CHANGELOG_FILE}`)
        }

        seenVersions.add(version)

        return parseSection(
            normalizedMarkdown.slice(sectionStart, sectionEnd),
            version,
            match[2] ?? null,
        )
    })

    return {
        records: sections.map(section => section.record),
        listItemCount: sections.reduce(
            (count, section) => count + section.listItemCount,
            0,
        ),
    }
}

async function main(): Promise<void> {
    const repositoryDirectory = path.join(process.cwd(), 'repository')

    try {
        const downloadedRepository = await downloadTemplate(REPOSITORY_SOURCE, {
            dir: repositoryDirectory,
            silent: true,
        })
        const markdown = await fs.readFile(
            path.join(downloadedRepository.dir, CHANGELOG_FILE),
            'utf8',
        )
        const { records: changelogs, listItemCount } = parseChangelog(markdown)
        const changelogItemCount = changelogs.reduce(
            (count, changelog) => count + changelog.changelog.length,
            0,
        )
        const skippedItemCount = listItemCount - changelogItemCount

        if (changelogItemCount === 0) {
            throw new Error(`No conventional-commit changelog items found in ${CHANGELOG_FILE}`)
        }

        if (skippedItemCount > 0) {
            console.warn(
                `Skipped ${skippedItemCount} list items without conventional-commit metadata`,
            )
        }

        await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
        await fs.writeFile(
            OUTPUT_FILE,
            `${JSON.stringify(changelogs, null, 2)}\n`,
            'utf8',
        )

        console.log(
            `Wrote ${changelogs.length} releases with ${changelogItemCount} changelog items to ${OUTPUT_FILE}`,
        )
    }
    finally {
        await fs.rm(repositoryDirectory, { recursive: true, force: true })
    }
}

await main()
