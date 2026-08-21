import type { OptionsArgs } from '@/args/args'
import { glob } from 'glob'
import { readPackageJSON } from 'pkg-types'

export interface packageVersionInfo {
  path: string
  version: string
}

export async function resolvePackage(name: string, ctx: OptionsArgs): Promise<packageVersionInfo | false> {
  const pkgPaths = await glob('**/package.json', {
    cwd: ctx.cwd,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
    ],
  })

  const result: packageVersionInfo[] = []

  for (const path of pkgPaths) {
    const packageJson = await readPackageJSON(path)
    const version = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name]

    if (version) {
      result.push({ path, version })
    }
  }

  if (!result.length) {
    return false
  }

  return result.at(0)!
}

export function stripVersionPrefix(specifier: string): string {
  const value = specifier.trim()
  return value.replace(/^[~^]/, '')
}
