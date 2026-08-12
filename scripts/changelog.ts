// @env node

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadTemplate } from 'giget'

type Locale = 'en-US' | 'zh-CN'

interface ParsedChangelog {
    version: string
    date: string | null
    changelog: string
}

interface ChangelogRecord {
    version: string
    date: string | null
    changelog: Record<Locale, string>
}

const REPOSITORY_SOURCE = 'github:antdv-next/antdv-next#main'
const CHANGELOG_DIRECTORY = 'docs/src/pages/components'
const CHANGELOG_FILES = {
    'en-US': 'changelog.en-US.md',
    'zh-CN': 'changelog.zh-CN.md',
} as const satisfies Record<Locale, string>
const OUTPUT_FILE = fileURLToPath(new URL('../data/changelog.json', import.meta.url))
const VERSION_HEADING_PATTERN = /^##[ \t]+v?(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?(?:\+[a-z0-9.-]+)?)(?:[ \t]+-[ \t]+(\d{4}-\d{2}-\d{2}))?[ \t]*$/gim
const RELEASE_DATE_PATTERN = /^(?:Release Date|发布日期)[ \t]*[:：][ \t]*(\d{4}-\d{2}-\d{2})[ \t]*$/i

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

function assertValidDate(date: string, context: string): void {
    const [year, month, day] = date.split('-').map(Number)
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
    locale: Locale,
): ParsedChangelog {
    const lines = trimBlankLines(rawSection.split('\n'))
    const releaseDateMatch = lines[0]?.match(RELEASE_DATE_PATTERN)
    const releaseDate = releaseDateMatch?.[1] ?? null

    if (releaseDateMatch) {
        lines.shift()
    }

    if (inlineDate && releaseDate && inlineDate !== releaseDate) {
        throw new Error(
            `Conflicting release dates for ${version} in ${CHANGELOG_FILES[locale]}: ${inlineDate} and ${releaseDate}`,
        )
    }

    const date = inlineDate ?? releaseDate
    if (date) {
        assertValidDate(date, `${CHANGELOG_FILES[locale]} (${version})`)
    }

    const changelog = trimBlankLines(lines).join('\n')
    if (!changelog) {
        throw new Error(`Empty changelog for ${version} in ${CHANGELOG_FILES[locale]}`)
    }

    return {
        version,
        date,
        changelog,
    }
}

function parseChangelog(markdown: string, locale: Locale): ParsedChangelog[] {
    const normalizedMarkdown = markdown.replace(/\r\n?/g, '\n')
    const matches = [...normalizedMarkdown.matchAll(VERSION_HEADING_PATTERN)]

    if (matches.length === 0) {
        throw new Error(`No version headings found in ${CHANGELOG_FILES[locale]}`)
    }

    const seenVersions = new Set<string>()

    return matches.map((match, index) => {
        const version = match[1]
        const sectionStart = match.index + match[0].length
        const sectionEnd = matches[index + 1]?.index ?? normalizedMarkdown.length

        if (!version) {
            throw new Error(`Invalid version heading in ${CHANGELOG_FILES[locale]}: ${match[0]}`)
        }

        if (seenVersions.has(version)) {
            throw new Error(`Duplicate version ${version} in ${CHANGELOG_FILES[locale]}`)
        }

        seenVersions.add(version)

        return parseSection(
            normalizedMarkdown.slice(sectionStart, sectionEnd),
            version,
            match[2] ?? null,
            locale,
        )
    })
}

function mergeChangelogs(
    englishChangelogs: ParsedChangelog[],
    chineseChangelogs: ParsedChangelog[],
): ChangelogRecord[] {
    const chineseByVersion = new Map(
        chineseChangelogs.map(changelog => [changelog.version, changelog]),
    )

    if (englishChangelogs.length !== chineseChangelogs.length) {
        throw new Error(
            `Changelog version count differs: en-US has ${englishChangelogs.length}, zh-CN has ${chineseChangelogs.length}`,
        )
    }

    return englishChangelogs.map((englishChangelog) => {
        const chineseChangelog = chineseByVersion.get(englishChangelog.version)

        if (!chineseChangelog) {
            throw new Error(`Version ${englishChangelog.version} is missing from ${CHANGELOG_FILES['zh-CN']}`)
        }

        if (
            englishChangelog.date
            && chineseChangelog.date
            && englishChangelog.date !== chineseChangelog.date
        ) {
            throw new Error(
                `Release date differs for ${englishChangelog.version}: en-US is ${englishChangelog.date}, zh-CN is ${chineseChangelog.date}`,
            )
        }

        return {
            version: englishChangelog.version,
            date: englishChangelog.date ?? chineseChangelog.date,
            changelog: {
                'en-US': englishChangelog.changelog,
                'zh-CN': chineseChangelog.changelog,
            },
        }
    })
}

async function readChangelogs(repositoryDirectory: string): Promise<ChangelogRecord[]> {
    const locales = Object.keys(CHANGELOG_FILES) as Locale[]
    const parsedChangelogs = await Promise.all(locales.map(async (locale) => {
        const filename = path.join(
            repositoryDirectory,
            CHANGELOG_DIRECTORY,
            CHANGELOG_FILES[locale],
        )
        const markdown = await fs.readFile(filename, 'utf8')

        return [locale, parseChangelog(markdown, locale)] as const
    }))
    const changelogsByLocale = Object.fromEntries(parsedChangelogs) as Record<
        Locale,
        ParsedChangelog[]
    >

    return mergeChangelogs(
        changelogsByLocale['en-US'],
        changelogsByLocale['zh-CN'],
    )
}

async function main(): Promise<void> {
    const temporaryDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), 'antdv-next-changelog-'),
    )

    try {
        const repositoryDirectory = path.join(temporaryDirectory, 'repository')
        const downloadedRepository = await downloadTemplate(REPOSITORY_SOURCE, {
            dir: repositoryDirectory,
            silent: true,
        })
        const changelogs = await readChangelogs(downloadedRepository.dir)

        await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true })
        await fs.writeFile(
            OUTPUT_FILE,
            `${JSON.stringify(changelogs, null, 2)}\n`,
            'utf8',
        )

        console.log(`Wrote ${changelogs.length} releases to ${OUTPUT_FILE}`)
    }
    finally {
        await fs.rm(temporaryDirectory, { recursive: true, force: true })
    }
}

await main()
