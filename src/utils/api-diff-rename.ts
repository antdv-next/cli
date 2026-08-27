import type { ChangedApiItem, FlatApiItem, RenameConfidence } from '#/changelog.ts'
import * as levenshtein from 'fast-levenshtein'
import {
  HIGH_RENAME_SIMILARITY,
  MEDIUM_RENAME_SIMILARITY,
  MIN_RENAME_SCORE_GAP,
} from '@/constants/changelog.ts'
import { getChangedFields, normalizeComparableValue } from '@/utils/api-diff-normalize.ts'

interface RenameCandidate {
  removed: FlatApiItem
  added: FlatApiItem
  confidence: RenameConfidence
  score: number
}

interface RankedRenameCandidate {
  candidate: RenameCandidate
  scoreGap: number
}

function hasReplacementReference(from: FlatApiItem, to: FlatApiItem): boolean {
  const description = normalizeComparableValue(`${from.record.description} ${from.record.descriptionZh}`).toLowerCase()
  const targetName = to.identity.toLowerCase()

  return description.includes(targetName)
    && /\bdeprecated\b|\buse\b|\binstead\b|\breplace|废弃|弃用|替代|替换|请使用/i.test(description)
}

function getNameSimilarity(from: FlatApiItem, to: FlatApiItem): number {
  const fromName = from.identity.toLowerCase()
  const toName = to.identity.toLowerCase()
  const longestLength = Math.max(fromName.length, toName.length)

  if (!longestLength) {
    return 0
  }

  return 1 - levenshtein.get(fromName, toName) / longestLength
}

function createRenameCandidate(from: FlatApiItem, to: FlatApiItem): RenameCandidate | undefined {
  if (from.scope !== to.scope || from.category !== to.category) {
    return undefined
  }

  const explicitReplacement = hasReplacementReference(from, to)
  const similarity = getNameSimilarity(from, to)
  const sameType = from.comparable.type === to.comparable.type
  const sameDefault = from.comparable.default === to.comparable.default
  const isShortName = Math.max(from.identity.length, to.identity.length) < 5

  if (explicitReplacement) {
    return {
      removed: from,
      added: to,
      confidence: 'high',
      score: 3 + similarity,
    }
  }

  if (isShortName) {
    return undefined
  }

  if (similarity >= HIGH_RENAME_SIMILARITY && sameType) {
    return {
      removed: from,
      added: to,
      confidence: 'high',
      score: 2 + similarity + (sameDefault ? 0.05 : 0),
    }
  }

  if (similarity >= MEDIUM_RENAME_SIMILARITY && sameType && sameDefault) {
    return {
      removed: from,
      added: to,
      confidence: 'medium',
      score: 1 + similarity,
    }
  }

  return undefined
}

function rankCandidates(candidates: RenameCandidate[]): RankedRenameCandidate | undefined {
  const sorted = [...candidates].sort((left, right) => {
    return right.score - left.score
      || left.added.identity.localeCompare(right.added.identity)
      || left.removed.identity.localeCompare(right.removed.identity)
  })
  const candidate = sorted[0]

  if (!candidate) {
    return undefined
  }

  return {
    candidate,
    scoreGap: sorted[1] ? candidate.score - sorted[1].score : Number.POSITIVE_INFINITY,
  }
}

export function matchRenamedItems(
  removed: FlatApiItem[],
  added: FlatApiItem[],
): { removed: FlatApiItem[], added: FlatApiItem[], changed: ChangedApiItem[] } {
  const candidates = removed.flatMap((from) => {
    return added.flatMap((to) => {
      const candidate = createRenameCandidate(from, to)
      return candidate ? [candidate] : []
    })
  })
  const bestByRemoved = new Map<FlatApiItem, RankedRenameCandidate>()
  const bestByAdded = new Map<FlatApiItem, RankedRenameCandidate>()

  for (const item of removed) {
    const ranked = rankCandidates(candidates.filter(candidate => candidate.removed === item))
    if (ranked) {
      bestByRemoved.set(item, ranked)
    }
  }

  for (const item of added) {
    const ranked = rankCandidates(candidates.filter(candidate => candidate.added === item))
    if (ranked) {
      bestByAdded.set(item, ranked)
    }
  }

  const matchedRemoved = new Set<FlatApiItem>()
  const matchedAdded = new Set<FlatApiItem>()
  const changed: ChangedApiItem[] = []

  for (const from of removed) {
    const fromBest = bestByRemoved.get(from)
    if (!fromBest || fromBest.scoreGap < MIN_RENAME_SCORE_GAP) {
      continue
    }

    const to = fromBest.candidate.added
    const toBest = bestByAdded.get(to)

    if (
      !toBest
      || toBest.candidate.removed !== from
      || toBest.scoreGap < MIN_RENAME_SCORE_GAP
      || matchedAdded.has(to)
    ) {
      continue
    }

    matchedRemoved.add(from)
    matchedAdded.add(to)
    changed.push({
      scope: to.scope,
      category: to.category,
      name: to.identity,
      changeType: 'renamed',
      from: from.record,
      to: to.record,
      fields: ['name', ...getChangedFields(from, to)],
      confidence: fromBest.candidate.confidence,
    })
  }

  return {
    removed: removed.filter(item => !matchedRemoved.has(item)),
    added: added.filter(item => !matchedAdded.has(item)),
    changed,
  }
}
