import type { ApiCategory, ApiChangeField, DiffApiItem, FlatApiItem } from '#/changelog.ts'
import type { ComponentApiItemRecord, ComponentApiRecord, ComponentRecord } from '#/components.ts'
import {
  API_CATEGORY_FIELDS,
  API_CATEGORY_ORDER,
  HTML_ENTITIES,
} from '@/constants/changelog.ts'

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z][\da-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) {
      return HTML_ENTITIES[code.toLowerCase()] ?? entity
    }

    const hexadecimal = code[1]?.toLowerCase() === 'x'
    const value = Number.parseInt(code.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)

    if (!Number.isInteger(value) || value < 0 || value > 0x10FFFF) {
      return entity
    }

    return String.fromCodePoint(value)
  })
}

export function normalizeComparableValue(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\\\|/g, '|')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeApiName(name: string): string {
  return normalizeComparableValue(name)
    .replace(/^~~([\s\S]*)~~$/, '$1')
    .trim()
}

function getApiIdentity(name: string, category: ApiCategory): string {
  const normalizedName = normalizeApiName(name)

  if (category !== 'methods') {
    return normalizedName
  }

  const signatureStart = normalizedName.indexOf('(')
  return signatureStart < 0 ? normalizedName : normalizedName.slice(0, signatureStart).trim()
}

function isDeprecated(item: ComponentApiItemRecord): boolean {
  return /^~~[\s\S]*~~$/.test(item.name.trim())
    || /\bdeprecated\b|已废弃|已弃用/i.test(`${item.description}\n${item.descriptionZh}`)
}

function flattenApiRecord(scope: string, api: ComponentApiRecord): FlatApiItem[] {
  return API_CATEGORY_FIELDS.flatMap(([category, field]) => {
    return api[field].flatMap((record): FlatApiItem[] => {
      const identity = getApiIdentity(record.name, category)

      if (!identity) {
        return []
      }

      return [{
        scope,
        category,
        identity,
        record,
        comparable: {
          type: normalizeComparableValue(record.type),
          default: normalizeComparableValue(record.default),
          signature: category === 'methods' ? normalizeApiName(record.name) : '',
          deprecated: isDeprecated(record),
        },
      }]
    })
  })
}

export function flattenComponent(component: ComponentRecord | undefined): FlatApiItem[] {
  if (!component) {
    return []
  }

  const items = flattenApiRecord(component.name, component.props)

  for (const [subComponent, api] of Object.entries(component.subComponentProps)) {
    items.push(...flattenApiRecord(`${component.name}.${subComponent}`, api))
  }

  return items
}

export function getChangedFields(from: FlatApiItem, to: FlatApiItem): ApiChangeField[] {
  const fields: ApiChangeField[] = []

  if (from.comparable.type !== to.comparable.type) {
    fields.push('type')
  }
  if (from.comparable.default !== to.comparable.default) {
    fields.push('default')
  }
  if (from.comparable.signature !== to.comparable.signature) {
    fields.push('signature')
  }
  if (from.comparable.deprecated !== to.comparable.deprecated) {
    fields.push('deprecated')
  }

  return fields
}

export function toDiffApiItem(item: FlatApiItem): DiffApiItem {
  return {
    scope: item.scope,
    category: item.category,
    ...item.record,
  }
}

export function compareDiffItems(
  left: Pick<DiffApiItem, 'scope' | 'category' | 'name'>,
  right: Pick<DiffApiItem, 'scope' | 'category' | 'name'>,
): number {
  return left.scope.localeCompare(right.scope)
    || (API_CATEGORY_ORDER.get(left.category) ?? 0) - (API_CATEGORY_ORDER.get(right.category) ?? 0)
    || normalizeApiName(left.name).localeCompare(normalizeApiName(right.name))
}
