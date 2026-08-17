// @env node

import type { TokenData } from './tokens'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import { parse } from 'semver'
import { x } from 'tinyexec'
import { fetchTokens, loaderVersionToken } from './tokens'

dayjs.extend(utc)

interface VersionRecord {
    version: string
    majorVersion: string
}

interface ChangelogChange {
    component: string
    type: string
    description: string
}

interface SourceChangelogChange extends Omit<ChangelogChange, 'component'> {
    component: string | null
}

interface ChangelogRecord extends VersionRecord {
    date: string
    changes: ChangelogChange[]
}

interface ChangelogFile extends VersionRecord {
    globalTokens: TokenData[] | unknown[]
    changelog: ChangelogRecord[]
}

type VersionFile = [Record<string, Record<string, string>>]

interface ParsedTag {
    record: VersionRecord
    major: number
    minor: number
    patch: number
}

interface MinorGroup {
    major: number
    minor: number
    tags: ParsedTag[]
}

const MAJOR_VERSIONS = [1, 2, 3, 4] as const
const PACKAGE_NAME = 'antdv-next'
const REMOTE_URL = 'https://github.com/antdv-next/antdv-next.git'
const TAG_PREFIX = `${PACKAGE_NAME}@`
const OUTPUT_DIRECTORY = fileURLToPath(new URL('../data', import.meta.url))
const CHANGELOG_FILE = path.join(OUTPUT_DIRECTORY, 'changelog.json')
const REMOTE_TAG_PATTERN = /^[0-9a-f]+\s+refs\/tags\/(.+)$/i
const MINOR_FILE_PATTERN = /^v(\d+)\.(\d+)\.(\d+)\.json$/

async function fetchTags(majorVersion: number): Promise<ParsedTag[]> {
    const tagPattern = `refs/tags/${TAG_PREFIX}${majorVersion}.*`
    const { stdout } = await x('git', [
        'ls-remote',
        '--tags',
        '--refs',
        '--sort=v:refname',
        REMOTE_URL,
        tagPattern,
    ], {
        throwOnError: true,
        nodeOptions: {
            stdio: 'pipe',
        },
    })

    const lines = stdout.split(/\r?\n/).filter(Boolean)
    return lines.map(line => parseRemoteTag(line, majorVersion))
}

async function fetchPublishTimes(): Promise<Map<string, string>> {
    const { stdout } = await x('npm', [
        'view',
        PACKAGE_NAME,
        'time',
        '--json',
    ], {
        throwOnError: true,
        nodeOptions: {
            stdio: 'pipe',
        },
    })

    let data: unknown

    try {
        data = JSON.parse(stdout)
    }
    catch {
        throw new Error(`Invalid npm publish time response for ${PACKAGE_NAME}`)
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`Unexpected npm publish time response for ${PACKAGE_NAME}`)
    }

    const publishTimes = new Map<string, string>()

    for (const [rawVersion, rawPublishedAt] of Object.entries(data)) {
        const semver = parse(rawVersion)

        if (!semver || typeof rawPublishedAt !== 'string') {
            continue
        }

        const publishedAt = dayjs.utc(rawPublishedAt)
        if (!publishedAt.isValid()) {
            throw new TypeError(`Invalid npm publish time for ${PACKAGE_NAME}@${rawVersion}`)
        }

        publishTimes.set(formatSemver(semver), publishedAt.format('YYYY-MM-DD'))
    }

    if (publishTimes.size === 0) {
        throw new Error(`No npm publish times found for ${PACKAGE_NAME}`)
    }

    return publishTimes
}

function isSourceChangelogChange(value: unknown): value is SourceChangelogChange {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false
    }

    const change = value as Record<string, unknown>

    return (typeof change.component === 'string' || change.component === null)
        && typeof change.type === 'string'
        && typeof change.description === 'string'
}

async function readChangesByVersion(): Promise<Map<string, ChangelogChange[]>> {
    const source = await fs.readFile(CHANGELOG_FILE, 'utf8')
    let data: unknown

    try {
        data = JSON.parse(source)
    }
    catch {
        throw new Error(`Invalid JSON in ${CHANGELOG_FILE}`)
    }

    if (!Array.isArray(data)) {
        throw new TypeError(`Expected an array in ${CHANGELOG_FILE}`)
    }

    const changesByVersion = new Map<string, ChangelogChange[]>()

    for (const [index, value] of data.entries()) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new TypeError(`Invalid changelog record at index ${index} in ${CHANGELOG_FILE}`)
        }

        const record = value as Record<string, unknown>
        const { version, changelog } = record

        if (typeof version !== 'string' || !Array.isArray(changelog)) {
            throw new TypeError(`Invalid changelog record at index ${index} in ${CHANGELOG_FILE}`)
        }

        if (!changelog.every(isSourceChangelogChange)) {
            throw new TypeError(`Invalid changes for version ${version} in ${CHANGELOG_FILE}`)
        }

        if (changesByVersion.has(version)) {
            throw new Error(`Duplicate version ${version} in ${CHANGELOG_FILE}`)
        }

        changesByVersion.set(version, changelog.map(change => ({
            ...change,
            component: change.component ?? '',
        })))
    }

    return changesByVersion
}

function parseRemoteTag(line: string, expectedMajorVersion: number): ParsedTag {
    const remoteTagMatch = line.match(REMOTE_TAG_PATTERN)
    const tag = remoteTagMatch?.[1]

    if (!tag?.startsWith(TAG_PREFIX)) {
        throw new Error(`Unexpected git ls-remote output: ${line}`)
    }

    const rawVersion = tag.slice(TAG_PREFIX.length)
    const semver = parse(rawVersion)

    if (!semver) {
        throw new Error(`Invalid semantic version tag: ${tag}`)
    }

    const { major, minor, patch } = semver

    if (major !== expectedMajorVersion) {
        throw new Error(`Unexpected major version tag: ${tag}`)
    }

    return {
        record: {
            version: formatSemver(semver),
            majorVersion: `v${major}`,
        },
        major,
        minor,
        patch,
    }
}

function formatSemver(semver: NonNullable<ReturnType<typeof parse>>): string {
    return semver.build.length > 0
        ? `${semver.version}+${semver.build.join('.')}`
        : semver.version
}

function groupTagsByMinor(tags: ParsedTag[]): MinorGroup[] {
    const groups = new Map<string, MinorGroup>()

    for (const tag of tags) {
        const key = `${tag.major}.${tag.minor}`
        const group = groups.get(key)

        if (group) {
            group.tags.push(tag)
            continue
        }

        groups.set(key, {
            major: tag.major,
            minor: tag.minor,
            tags: [tag],
        })
    }

    return [...groups.values()].sort((left, right) =>
        left.major - right.major || left.minor - right.minor,
    )
}

function compareBaseVersions(left: ParsedTag, right: ParsedTag): number {
    return left.major - right.major
        || left.minor - right.minor
        || left.patch - right.patch
}

function getHighestBaseVersion(tags: ParsedTag[]): ParsedTag {
    const [firstTag, ...remainingTags] = tags

    if (!firstTag) {
        throw new Error('Cannot resolve a version from an empty tag collection')
    }

    return remainingTags.reduce(
        (highestTag, tag) => compareBaseVersions(tag, highestTag) > 0 ? tag : highestTag,
        firstTag,
    )
}

function getBaseVersion(tag: ParsedTag): string {
    return `${tag.major}.${tag.minor}.${tag.patch}`
}

function createChangelogRecord(
    tag: ParsedTag,
    publishTimes: Map<string, string>,
    changesByVersion: Map<string, ChangelogChange[]>,
): ChangelogRecord {
    const publishedAt = publishTimes.get(tag.record.version)

    if (!publishedAt) {
        throw new Error(`Missing npm publish time for ${PACKAGE_NAME}@${tag.record.version}`)
    }

    return {
        ...tag.record,
        date: publishedAt,
        changes: changesByVersion.get(tag.record.version) ?? [],
    }
}

function assertPublishTimes(
    tags: ParsedTag[],
    publishTimes: Map<string, string>,
): void {
    for (const tag of tags) {
        if (!publishTimes.has(tag.record.version)) {
            throw new Error(`Missing npm publish time for ${PACKAGE_NAME}@${tag.record.version}`)
        }
    }
}

async function createChangelogFile(
    tags: ParsedTag[],
    publishTimes: Map<string, string>,
    changesByVersion: Map<string, ChangelogChange[]>,
): Promise<ChangelogFile> {
    const highestTag = getHighestBaseVersion(tags)
    const version = getBaseVersion(highestTag)

    await fetchTokens(version)

    const tokens = await loaderVersionToken(version)

    return {
        version,
        majorVersion: `v${highestTag.major}`,
        globalTokens: tokens,
        changelog: tags
            .map(tag => createChangelogRecord(tag, publishTimes, changesByVersion)),
    }
}

function groupTagsByMajor(tags: ParsedTag[]): Map<number, ParsedTag[]> {
    const groups = new Map<number, ParsedTag[]>()

    for (const tag of tags) {
        const group = groups.get(tag.major)

        if (group) {
            group.push(tag)
        }
        else {
            groups.set(tag.major, [tag])
        }
    }

    return groups
}

async function buildOutputFiles(
    tags: ParsedTag[],
    publishTimes: Map<string, string>,
    changesByVersion: Map<string, ChangelogChange[]>,
): Promise<Map<string, ChangelogFile>> {
    const outputFiles = new Map<string, ChangelogFile>()

    for (const [major, majorTags] of groupTagsByMajor(tags)) {
        outputFiles.set(
            `v${major}.json`,
            await createChangelogFile(majorTags, publishTimes, changesByVersion),
        )
    }

    for (const group of groupTagsByMinor(tags)) {
        const changelogFile = await createChangelogFile(
            group.tags,
            publishTimes,
            changesByVersion,
        )
        const filename = `v${changelogFile.version}.json`
        outputFiles.set(filename, changelogFile)
    }

    return outputFiles
}

function createVersionFile(tags: ParsedTag[]): VersionFile {
    const versions: Record<string, Record<string, string>> = {}

    for (const group of groupTagsByMinor(tags)) {
        const majorVersion = `v${group.major}`
        const minorVersions = versions[majorVersion] ?? {}
        const highestTag = getHighestBaseVersion(group.tags)

        minorVersions[`${group.major}.${group.minor}`] = getBaseVersion(highestTag)
        versions[majorVersion] = minorVersions
    }

    return [versions]
}

async function writeJsonFile(
    filename: string,
    data: ChangelogFile | VersionFile,
): Promise<void> {
    const file = path.join(OUTPUT_DIRECTORY, filename)
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function removeStaleMinorFiles(
    expectedFiles: Set<string>,
    syncedMajorVersions: Set<number>,
): Promise<void> {
    const filenames = await fs.readdir(OUTPUT_DIRECTORY)
    const staleFiles = filenames.filter((filename) => {
        const match = filename.match(MINOR_FILE_PATTERN)
        const majorVersion = Number(match?.[1])

        return match
            && syncedMajorVersions.has(majorVersion)
            && !expectedFiles.has(filename)
    })

    await Promise.all(staleFiles.map(filename =>
        fs.unlink(path.join(OUTPUT_DIRECTORY, filename)),
    ))
}

async function main(): Promise<void> {
    const [tagGroups, publishTimes, changesByVersion] = await Promise.all([
        Promise.all(MAJOR_VERSIONS.map(fetchTags)),
        fetchPublishTimes(),
        readChangesByVersion(),
    ])
    const tags = tagGroups.flat()

    if (tags.length === 0) {
        throw new Error(`No tags matched the configured major versions: ${MAJOR_VERSIONS.join(', ')}`)
    }

    assertPublishTimes(tags, publishTimes)
    const outputFiles = await buildOutputFiles(tags, publishTimes, changesByVersion)
    const versionFile = createVersionFile(tags)
    const syncedMajorVersions = new Set(tags.map(tag => tag.major))

    await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true })
    await Promise.all([
        ...[...outputFiles].map(([filename, changelog]) =>
            writeJsonFile(filename, changelog),
        ),
        writeJsonFile('version.json', versionFile),
    ])
    await removeStaleMinorFiles(new Set(outputFiles.keys()), syncedMajorVersions)

    console.log(
        `Synced ${tags.length} tags across ${syncedMajorVersions.size} major versions to ${outputFiles.size} changelog files and version.json`,
    )
}

await main()
