import type { ResolvedVersion } from '@/types.ts'

export interface ChangelogFile extends ResolvedVersion {
    globalTokens: ComponentPropRecord[]
    components: ComponentRecord[]
    changelog: ChangelogRecord[]
}

interface ChangelogRecord extends ResolvedVersion {
    date: string
    changes: ChangelogChange[]
}

interface ChangelogChange {
    component: string
    type: string
    description: string
}

export interface ComponentPropRecord {
    name: string
    type: string
    default: string
    description: string
    descriptionZh: string
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
    subComponents: Record<string, ComponentPropRecord[]>
    props: ComponentPropRecord[]
    tokens: ComponentPropRecord[]
    faq: ComponentFaqRecord[]
    demos: ComponentDemoRecord[]
}
