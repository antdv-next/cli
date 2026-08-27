import type { ResolvedConfig, ResolvedVersion } from '@/types.ts'
import { readdir } from 'node:fs/promises'
import { getPackageInfo } from 'local-pkg'
import semver from 'semver'
import { getDataPath } from '@/utils/loader.ts'

const VERSION_FILE_RE = /^v(.+)\.json$/

function parseVersion(version: string): ResolvedVersion {
  const parsedVersion = semver.coerce(version.trim())

  if (!parsedVersion) {
    return {
      version: '',
      majorVersion: `v0`,
    }
  }

  return {
    version: parsedVersion.version,
    majorVersion: `v${parsedVersion.major}`,
  }
}

async function resolveInstalledVersion(cwd: string): Promise<ResolvedVersion> {
  const packageInfo = await getPackageInfo('antdv-next', {
    paths: [cwd],
  })

  return parseVersion(packageInfo?.version ?? '')
}

async function getAvailableVersions(dataPath: string): Promise<string[]> {
  const entries = await readdir(dataPath, { withFileTypes: true })

  return entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name.match(VERSION_FILE_RE)?.[1])
    .filter((version): version is string => Boolean(version && semver.valid(version)))
    .sort(semver.rcompare)
}

async function resolveAvailableVersion(resolvedVersion: ResolvedVersion, dataPath: string): Promise<ResolvedVersion> {
  if (!resolvedVersion.version) {
    return resolvedVersion
  }

  const requestedVersion = semver.parse(resolvedVersion.version)
  if (!requestedVersion) {
    return resolvedVersion
  }

  const versions = await getAvailableVersions(dataPath)

  const exactVersion = versions.find(version => semver.eq(version, requestedVersion))
  if (exactVersion) {
    return parseVersion(exactVersion)
  }

  const latestMinorVersion = versions.find((version) => {
    return semver.major(version) === requestedVersion.major
      && semver.minor(version) === requestedVersion.minor
  })
  if (latestMinorVersion) {
    return parseVersion(latestMinorVersion)
  }

  // v{major}.json is the latest-version alias for that major. Returning its
  // concrete semantic version keeps loadVersionMetaData pointed at a versioned file.
  const latestMajorVersion = versions.find((version) => {
    return semver.major(version) === requestedVersion.major
  })

  return latestMajorVersion ? parseVersion(latestMajorVersion) : resolvedVersion
}

export async function resolveFallBack(dataPath = getDataPath()): Promise<ResolvedVersion> {
  const versions = await getAvailableVersions(dataPath)

  const resolvedVersion = versions[0] && parseVersion(versions[0])

  if (!resolvedVersion) {
    throw new Error(`No valid antdv-next version files found in ${dataPath}`)
  }

  return resolvedVersion
}

export async function resolveVersion(config: ResolvedConfig, dataPath = getDataPath()): Promise<ResolvedVersion> {
  const { version, cwd } = config

  if (version) {
    const resolvedVersion = parseVersion(version)

    return await resolveAvailableVersion(resolvedVersion, dataPath)
  }

  const pkgVersion = await resolveInstalledVersion(cwd)
  if (pkgVersion.version) {
    return await resolveAvailableVersion(pkgVersion, dataPath)
  }

  return await resolveFallBack(dataPath)
}
