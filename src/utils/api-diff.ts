import type { ChangedApiItem, ComponentDiff, ComponentDiffResult, FlatApiItem } from '#/changelog.ts'
import type { ChangelogFile, ComponentRecord } from '#/components.ts'
import {
  compareDiffItems,
  flattenComponent,
  getChangedFields,
  toDiffApiItem,
} from '@/utils/api-diff-normalize.ts'
import { matchRenamedItems } from '@/utils/api-diff-rename.ts'

function getItemKey(item: FlatApiItem): string {
  return `${item.scope}\0${item.category}\0${item.identity}`
}

function groupItems(items: FlatApiItem[]): Map<string, FlatApiItem[]> {
  const grouped = new Map<string, FlatApiItem[]>()

  for (const item of items) {
    const key = getItemKey(item)
    const group = grouped.get(key)

    if (group) {
      group.push(item)
    }
    else {
      grouped.set(key, [item])
    }
  }

  return grouped
}

function createChangedItem(from: FlatApiItem, to: FlatApiItem): ChangedApiItem | undefined {
  const fields = getChangedFields(from, to)

  if (!fields.length) {
    return undefined
  }

  const changeType = fields.length === 1 && fields[0] === 'deprecated' && to.comparable.deprecated
    ? 'deprecated'
    : 'modified'

  return {
    scope: to.scope,
    category: to.category,
    name: to.identity,
    changeType,
    from: from.record,
    to: to.record,
    fields,
  }
}

function matchExactItems(
  fromItems: FlatApiItem[],
  toItems: FlatApiItem[],
): { removed: FlatApiItem[], added: FlatApiItem[], changed: ChangedApiItem[] } {
  const fromGroups = groupItems(fromItems)
  const toGroups = groupItems(toItems)
  const keys = [...new Set([...fromGroups.keys(), ...toGroups.keys()])].sort()
  const removed: FlatApiItem[] = []
  const added: FlatApiItem[] = []
  const changed: ChangedApiItem[] = []

  for (const key of keys) {
    const fromGroup = [...(fromGroups.get(key) ?? [])]
    const toGroup = [...(toGroups.get(key) ?? [])]
    const remainingFrom: FlatApiItem[] = []

    for (const fromItem of fromGroup) {
      const unchangedIndex = toGroup.findIndex(toItem => !getChangedFields(fromItem, toItem).length)

      if (unchangedIndex >= 0) {
        toGroup.splice(unchangedIndex, 1)
      }
      else {
        remainingFrom.push(fromItem)
      }
    }

    const changedPairCount = Math.min(remainingFrom.length, toGroup.length)

    for (let index = 0; index < changedPairCount; index += 1) {
      const changedItem = createChangedItem(remainingFrom[index]!, toGroup[index]!)
      if (changedItem) {
        changed.push(changedItem)
      }
    }

    removed.push(...remainingFrom.slice(changedPairCount))
    added.push(...toGroup.slice(changedPairCount))
  }

  return { removed, added, changed }
}

function diffSingleComponent(
  component: string,
  fromComponent: ComponentRecord | undefined,
  toComponent: ComponentRecord | undefined,
): ComponentDiff | undefined {
  const exact = matchExactItems(flattenComponent(fromComponent), flattenComponent(toComponent))
  const renamed = matchRenamedItems(exact.removed, exact.added)
  const added = renamed.added.map(toDiffApiItem).sort(compareDiffItems)
  const removed = renamed.removed.map(toDiffApiItem).sort(compareDiffItems)
  const changed = [...exact.changed, ...renamed.changed].sort(compareDiffItems)

  if (!added.length && !removed.length && !changed.length) {
    return undefined
  }

  return { component, added, removed, changed }
}

function findComponent(components: ComponentRecord[], name: string): ComponentRecord | undefined {
  const normalizedName = name.toLowerCase()
  return components.find(component => component.name.toLowerCase() === normalizedName)
}

export function diffComponent(
  fromSnapshot: ChangelogFile,
  toSnapshot: ChangelogFile,
  component?: string,
): ComponentDiffResult {
  const componentNames = component
    ? [component]
    : [...new Set([
        ...fromSnapshot.components.map(component => component.name),
        ...toSnapshot.components.map(component => component.name),
      ])].sort((left, right) => left.localeCompare(right))
  const diffs: ComponentDiff[] = []

  for (const requestedName of componentNames) {
    const fromComponent = findComponent(fromSnapshot.components, requestedName)
    const toComponent = findComponent(toSnapshot.components, requestedName)

    if (!fromComponent && !toComponent) {
      throw new Error(`Component ${requestedName} not found`)
    }

    const componentName = toComponent?.name ?? fromComponent!.name
    const diff = diffSingleComponent(componentName, fromComponent, toComponent)

    if (diff) {
      diffs.push(diff)
    }
  }

  return {
    from: fromSnapshot.version,
    to: toSnapshot.version,
    diffs,
  }
}
