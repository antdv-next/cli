import type { Options, Output } from 'tinyexec'
import type { PackageManager } from '@/args/upgrade.ts'

export interface UpgradeCommand {
  args: readonly string[]
  command: string
}

export interface AlreadyUpToDateResult {
  currentVersion: string
  status: 'up-to-date'
}

export interface UpgradeSuccessResult {
  newVersion: string
  packageManager: PackageManager
  previousVersion: string
  status: 'upgraded'
  verified: boolean
}

export type UpgradeResult = AlreadyUpToDateResult | UpgradeSuccessResult

export type CommandRunner = (
  command: string,
  args?: readonly string[],
  options?: Partial<Options>,
) => PromiseLike<Output>
