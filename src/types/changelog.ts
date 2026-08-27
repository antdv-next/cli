import type { ComponentApiItemRecord } from '#/components.ts'

export type ApiCategory = 'props' | 'events' | 'slots' | 'methods'
export type ApiChangeField = 'name' | 'type' | 'default' | 'signature' | 'deprecated'
export type ApiChangeType = 'modified' | 'renamed' | 'deprecated'
export type RenameConfidence = 'high' | 'medium'

export interface DiffApiItem extends ComponentApiItemRecord {
  scope: string
  category: ApiCategory
}

export interface ChangedApiItem {
  scope: string
  category: ApiCategory
  name: string
  changeType: ApiChangeType
  from: ComponentApiItemRecord
  to: ComponentApiItemRecord
  fields: ApiChangeField[]
  confidence?: RenameConfidence
}

export interface ComponentDiff {
  component: string
  added: DiffApiItem[]
  removed: DiffApiItem[]
  changed: ChangedApiItem[]
}

export interface ComponentDiffResult {
  from: string
  to: string
  diffs: ComponentDiff[]
}

export interface ComparableApiItem {
  type: string
  default: string
  signature: string
  deprecated: boolean
}

export interface FlatApiItem {
  scope: string
  category: ApiCategory
  identity: string
  record: ComponentApiItemRecord
  comparable: ComparableApiItem
}
