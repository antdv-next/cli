import type { ResolvedVersion } from '@/types.ts'

export interface ChangelogFile {
  version: string
  majorVersion: string
  globalTokens: ComponentPropRecord[]
  components: ComponentRecord[]
  changelog: ChangelogRecord[]
}

export interface ChangelogRecord extends ResolvedVersion {
  date: string
  changes: ChangelogChange[]
}

export interface ChangelogChange {
  component: string
  type: string
  description: string
}

export interface ComponentApiItemRecord {
  name: string
  type: string
  default: string
  description: string
  descriptionZh: string
}

export type ComponentPropRecord = ComponentApiItemRecord

export interface ComponentApiRecord {
  properties: ComponentApiItemRecord[]
  events: ComponentApiItemRecord[]
  slots: ComponentApiItemRecord[]
  methods: ComponentApiItemRecord[]
}

export interface ComponentFaqRecord {
  question: string
  answer: string
}

export interface ComponentDemoRecord {
  name: string
  title: string
  titleZh: string
  description: string
  descriptionZh: string
  code: string
}

export interface ComponentSemanticStructureRecord {
  key: string
  description: string
  descriptionZh: string
}

export interface ComponentRecord {
  name: string
  nameZh: string
  category: string
  categoryZh: string
  description: string
  descriptionZh: string
  whenToUse: string
  whenToUseZh: string
  doc: string
  docZh: string
  subComponents: string[]
  subComponentProps: Record<string, ComponentApiRecord>
  props: ComponentApiRecord
  tokens: ComponentPropRecord[]
  faq: ComponentFaqRecord[]
  demos: ComponentDemoRecord[]
  semanticStructure: ComponentSemanticStructureRecord[]
  commonProps?: ComponentApiItemRecord[]
}
