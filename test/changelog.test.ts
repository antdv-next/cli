import type { ResolvedVersion } from '../src/types.ts'
import type { ComponentDiff } from '../src/types/changelog'
import type { ChangelogFile, ComponentApiItemRecord, ComponentApiRecord, ComponentRecord } from '../src/types/components.ts'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { diffComponent } from '../src/utils/api-diff.ts'
import { loadVersionMetaData } from '../src/utils/loader.ts'

vi.mock('../src/utils/loader.ts', () => ({
  loadVersionMetaData: vi.fn(),
}))

const mockedLoadVersionMetaData = vi.mocked(loadVersionMetaData)

function apiItem(
  name: string,
  type = 'string',
  defaultValue = '-',
  description = '',
): ComponentApiItemRecord {
  return {
    name,
    type,
    default: defaultValue,
    description,
    descriptionZh: '',
  }
}

function apiRecord(overrides: Partial<ComponentApiRecord> = {}): ComponentApiRecord {
  return {
    properties: [],
    events: [],
    slots: [],
    methods: [],
    ...overrides,
  }
}

function component(
  name: string,
  props: ComponentApiRecord,
  subComponentProps: Record<string, ComponentApiRecord> = {},
): ComponentRecord {
  return {
    name,
    nameZh: name,
    category: '',
    categoryZh: '',
    description: '',
    descriptionZh: '',
    whenToUse: '',
    whenToUseZh: '',
    doc: '',
    docZh: '',
    subComponents: Object.keys(subComponentProps),
    subComponentProps,
    props,
    tokens: [],
    faq: [],
    demos: [],
    semanticStructure: [],
  }
}

function snapshot(version: string, components: ComponentRecord[]): ChangelogFile {
  return {
    version,
    majorVersion: 'v1',
    globalTokens: [],
    components,
    changelog: [],
  }
}

function resolvedVersion(version: string): ResolvedVersion {
  return {
    version,
    majorVersion: `v${version.split('.')[0]}`,
  }
}

async function diffSnapshots(
  from: ChangelogFile,
  to: ChangelogFile,
  component?: string,
) {
  mockedLoadVersionMetaData
    .mockResolvedValueOnce(from)
    .mockResolvedValueOnce(to)

  return await diffComponent(
    resolvedVersion(from.version),
    resolvedVersion(to.version),
    component,
  )
}

describe('diffComponent', () => {
  it('returns added, removed, and changed API items in the requested shape', async () => {
    const from = snapshot('1.0.5', [
      component('Button', apiRecord({
        properties: [
          apiItem('legacy', 'boolean'),
          apiItem('size', 'string', 'middle'),
        ],
      })),
    ])
    const to = snapshot('1.5.2', [
      component('Button', apiRecord({
        properties: [
          apiItem('loading', 'boolean'),
          apiItem('size', `'small' \\| 'middle' \\| 'large'`, 'middle'),
        ],
      })),
    ])

    await expect(diffSnapshots(from, to, 'button')).resolves.toEqual({
      from: '1.0.5',
      to: '1.5.2',
      diffs: [{
        component: 'Button',
        added: [{
          scope: 'Button',
          category: 'props',
          ...apiItem('loading', 'boolean'),
        }],
        removed: [{
          scope: 'Button',
          category: 'props',
          ...apiItem('legacy', 'boolean'),
        }],
        changed: [{
          scope: 'Button',
          category: 'props',
          name: 'size',
          changeType: 'modified',
          from: apiItem('size', 'string', 'middle'),
          to: apiItem('size', `'small' \\| 'middle' \\| 'large'`, 'middle'),
          fields: ['type'],
        }],
      }],
    })
  })

  it('treats markdown strikethrough as a deprecation change', async () => {
    const fromItem = apiItem('rootStyle', 'CSSProperties', '-', 'Style on the root element')
    const toItem = apiItem('~~rootStyle~~', 'CSSProperties', '-', 'Deprecated. Use `styles.root` instead')
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Tree', apiRecord({ properties: [fromItem] }))]),
      snapshot('1.5.2', [component('Tree', apiRecord({ properties: [toItem] }))]),
      'Tree',
    )

    expect(result.diffs[0]).toMatchObject({
      added: [],
      removed: [],
      changed: [{
        name: 'rootStyle',
        changeType: 'deprecated',
        from: fromItem,
        to: toItem,
        fields: ['deprecated'],
      }],
    })
  })

  it('compares method signatures under the same method identity', async () => {
    const fromItem = apiItem('scrollTo(&#123; key: Key &#125;)', '')
    const toItem = apiItem('scrollTo(&#123; key: Key, autoExpand?: boolean &#125;)', '')
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Tree', apiRecord({ methods: [fromItem] }))]),
      snapshot('1.5.2', [component('Tree', apiRecord({ methods: [toItem] }))]),
      'Tree',
    )

    expect(result.diffs[0]?.changed).toEqual([{
      scope: 'Tree',
      category: 'methods',
      name: 'scrollTo',
      changeType: 'modified',
      from: fromItem,
      to: toItem,
      fields: ['signature'],
    }])
  })

  it('moves high-confidence replacements into changed as renamed', async () => {
    const fromItem = apiItem(
      'dropdownRender',
      '(originNode: VueNode) => VueNode',
      '-',
      'Deprecated. Use `popupRender` instead',
    )
    const toItem = apiItem('popupRender', '(originNode: VueNode) => VueNode')
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Select', apiRecord({ properties: [fromItem] }))]),
      snapshot('1.5.2', [component('Select', apiRecord({ properties: [toItem] }))]),
      'Select',
    )

    expect(result.diffs[0]).toMatchObject({
      added: [],
      removed: [],
      changed: [{
        name: 'popupRender',
        changeType: 'renamed',
        from: fromItem,
        to: toItem,
        fields: ['name', 'deprecated'],
        confidence: 'high',
      }],
    })
  })

  it('uses Levenshtein similarity for structurally compatible renames', async () => {
    const fromItem = apiItem('popupRenderer', '() => VueNode')
    const toItem = apiItem('popupRender', '() => VueNode')
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Select', apiRecord({ properties: [fromItem] }))]),
      snapshot('1.5.2', [component('Select', apiRecord({ properties: [toItem] }))]),
      'Select',
    )

    expect(result.diffs[0]?.changed).toMatchObject([{
      name: 'popupRender',
      changeType: 'renamed',
      confidence: 'high',
    }])
  })

  it('keeps ambiguous rename candidates as added and removed', async () => {
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Select', apiRecord({
        properties: [apiItem('optionLabel', 'string')],
      }))]),
      snapshot('1.5.2', [component('Select', apiRecord({
        properties: [
          apiItem('optionLabelA', 'string'),
          apiItem('optionLabelB', 'string'),
        ],
      }))]),
      'Select',
    )

    expect(result.diffs[0]).toMatchObject({
      added: [
        { name: 'optionLabelA' },
        { name: 'optionLabelB' },
      ],
      removed: [{ name: 'optionLabel' }],
      changed: [],
    })
  })

  it('does not report description-only changes', async () => {
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Button', apiRecord({
        properties: [apiItem('disabled', 'boolean', 'false', 'Old description')],
      }))]),
      snapshot('1.5.2', [component('Button', apiRecord({
        properties: [apiItem('disabled', 'boolean', 'false', 'New description')],
      }))]),
      'Button',
    )

    expect(result.diffs).toEqual([])
  })

  it('includes a component that only exists in one snapshot', async () => {
    const added = apiItem('value', 'string')
    const result = await diffSnapshots(
      snapshot('1.0.5', []),
      snapshot('1.5.2', [component('NewComponent', apiRecord({ properties: [added] }))]),
      'NewComponent',
    )

    expect(result.diffs).toEqual([{
      component: 'NewComponent',
      added: [{ scope: 'NewComponent', category: 'props', ...added }],
      removed: [],
      changed: [],
    }])
  })

  it('compares every component when no component is provided', async () => {
    const from = snapshot('1.0.5', [
      component('Button', apiRecord({ properties: [apiItem('legacy', 'boolean')] })),
      component('Input', apiRecord({ properties: [apiItem('value')] })),
    ])
    const to = snapshot('1.5.2', [
      component('Button', apiRecord({ properties: [apiItem('loading', 'boolean')] })),
      component('Input', apiRecord({ properties: [apiItem('value')] })),
      component('Select', apiRecord({ properties: [apiItem('options', 'object[]')] })),
    ])

    const result = await diffSnapshots(from, to)

    expect(result.diffs.map((diff: ComponentDiff) => diff.component)).toEqual([
      'Button',
      'Select',
    ])
    expect(result.diffs[0]).toMatchObject({
      added: [{ name: 'loading' }],
      removed: [{ name: 'legacy' }],
    })
    expect(result.diffs[1]).toMatchObject({
      added: [{ name: 'options' }],
      removed: [],
    })
  })

  it('includes sub-component scope in API identity', async () => {
    const result = await diffSnapshots(
      snapshot('1.0.5', [component('Select', apiRecord(), {
        Option: apiRecord(),
      })]),
      snapshot('1.5.2', [component('Select', apiRecord(), {
        Option: apiRecord({ properties: [apiItem('value')] }),
      })]),
      'Select',
    )

    expect(result.diffs[0]?.added[0]).toMatchObject({
      scope: 'Select.Option',
      category: 'props',
      name: 'value',
    })
  })

  it('throws when a requested component exists in neither snapshot', async () => {
    await expect(diffSnapshots(
      snapshot('1.0.5', []),
      snapshot('1.5.2', []),
      'Missing',
    )).rejects.toThrow('Component Missing not found')
  })

  it('throws a clear error when a version major does not exist', async () => {
    const { loadVersionMetaData: actualLoadVersionMetaData }
      = await vi.importActual<typeof import('../src/utils/loader.ts')>('../src/utils/loader.ts')

    await expect(actualLoadVersionMetaData({
      version: '9.0.0',
      majorVersion: 'v9',
    }, join(import.meta.dirname, '..', 'data'))).rejects.toThrow('v9.0.0 not found')
  })
})
