// @env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { x } from 'tinyexec'

interface ChangelogRecord {
    version: string
    majorVersion: string
}

interface ParsedTag {
    record: ChangelogRecord
    major: number
    minor: number
    patch: number
}

interface MinorGroup {
    major: number
    minor: number
    highestPatch: number
    changelog: ChangelogRecord[]
}

const TARGET_MAJOR = 1
const REMOTE_URL = 'https://github.com/antdv-next/antdv-next.git'
const TAG_PREFIX = 'antdv-next@'
const TAG_PATTERN = 'refs/tags/antdv-next@1.*'
const OUTPUT_DIRECTORY = fileURLToPath(new URL('../data', import.meta.url))
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Z-]+(?:\.[0-9A-Z-]+)*)?(?:\+[0-9A-Z-]+(?:\.[0-9A-Z-]+)*)?$/i
const REMOTE_TAG_PATTERN = /^[0-9a-f]+\s+refs\/tags\/(.+)$/i
const MINOR_FILE_PATTERN = /^v1\.(\d+)\.(\d+)\.json$/

async function fetchTags(): Promise<ParsedTag[]> {
    const { stdout } = await x('git', [
        'ls-remote',
        '--tags',
        '--refs',
        '--sort=v:refname',
        REMOTE_URL,
        TAG_PATTERN,
    ], {
        throwOnError: true,
        nodeOptions: {
            stdio: 'pipe',
        },
    })

    const lines = stdout.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) {
        throw new Error(`No tags matched ${TAG_PATTERN}`)
    }

    return lines.map(parseRemoteTag)
}

function parseRemoteTag(line: string): ParsedTag {
    const remoteTagMatch = line.match(REMOTE_TAG_PATTERN)
    const tag = remoteTagMatch?.[1]

    if (!tag?.startsWith(TAG_PREFIX)) {
        throw new Error(`Unexpected git ls-remote output: ${line}`)
    }

    const rawVersion = tag.slice(TAG_PREFIX.length)
    const semverMatch = rawVersion.match(SEMVER_PATTERN)

    if (!semverMatch) {
        throw new Error(`Invalid semantic version tag: ${tag}`)
    }

    const major = Number(semverMatch[1])
    const minor = Number(semverMatch[2])
    const patch = Number(semverMatch[3])

    if (major !== TARGET_MAJOR) {
        throw new Error(`Unexpected major version tag: ${tag}`)
    }

    return {
        record: {
            version: `v${rawVersion}`,
            majorVersion: `v${major}`,
        },
        major,
        minor,
        patch,
    }
}

function groupTagsByMinor(tags: ParsedTag[]): MinorGroup[] {
    const groups = new Map<string, MinorGroup>()

    for (const tag of tags) {
        const key = `${tag.major}.${tag.minor}`
        const group = groups.get(key)

        if (group) {
            group.highestPatch = Math.max(group.highestPatch, tag.patch)
            group.changelog.push(tag.record)
            continue
        }

        groups.set(key, {
            major: tag.major,
            minor: tag.minor,
            highestPatch: tag.patch,
            changelog: [tag.record],
        })
    }

    return [...groups.values()].sort((left, right) =>
        left.major - right.major || left.minor - right.minor,
    )
}

function buildOutputFiles(tags: ParsedTag[]): Map<string, ChangelogRecord[]> {
    const outputFiles = new Map<string, ChangelogRecord[]>()

    outputFiles.set(
        `v${TARGET_MAJOR}.json`,
        tags.map(tag => tag.record),
    )

    for (const group of groupTagsByMinor(tags)) {
        const filename = `v${group.major}.${group.minor}.${group.highestPatch}.json`
        outputFiles.set(filename, group.changelog)
    }

    return outputFiles
}

async function writeJsonFile(filename: string, changelog: ChangelogRecord[]): Promise<void> {
    const file = path.join(OUTPUT_DIRECTORY, filename)
    await fs.writeFile(file, `${JSON.stringify(changelog, null, 2)}\n`, 'utf8')
}

async function removeStaleMinorFiles(expectedFiles: Set<string>): Promise<void> {
    const filenames = await fs.readdir(OUTPUT_DIRECTORY)
    const staleFiles = filenames.filter(filename =>
        MINOR_FILE_PATTERN.test(filename) && !expectedFiles.has(filename),
    )

    await Promise.all(staleFiles.map(filename =>
        fs.unlink(path.join(OUTPUT_DIRECTORY, filename)),
    ))
}

async function main(): Promise<void> {
    const tags = await fetchTags()
    const outputFiles = buildOutputFiles(tags)

    await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true })
    await Promise.all([...outputFiles].map(([filename, changelog]) =>
        writeJsonFile(filename, changelog),
    ))
    await removeStaleMinorFiles(new Set(outputFiles.keys()))

    console.log(`Synced ${tags.length} tags to ${outputFiles.size} changelog files`)
}

await main()
