import type { ApiCategory } from '#/changelog.ts'
import type { ComponentApiRecord } from '#/components.ts'

export const API_CATEGORY_FIELDS = [
  ['props', 'properties'],
  ['events', 'events'],
  ['slots', 'slots'],
  ['methods', 'methods'],
] as const satisfies readonly (readonly [ApiCategory, keyof ComponentApiRecord])[]

export const API_CATEGORY_ORDER = new Map<ApiCategory, number>(
  API_CATEGORY_FIELDS.map(([category], index) => [category, index]),
)

export const HIGH_RENAME_SIMILARITY = 0.75
export const MEDIUM_RENAME_SIMILARITY = 0.6
export const MIN_RENAME_SCORE_GAP = 0.1

export const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}
