import { describe, expect, it } from 'vitest'
import { extractLocalizedComponentApi } from '../scripts/sync.ts'

const enTypography = `---
title: Typography
---

## API

### Typography {#typography}

#### Props

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| direction | Direction control | string | ltr |

### Typography.Text {#typography-text}

#### Props

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| code | Code style | boolean | false |

#### Events

| Event | Description | Type |
| --- | --- | --- |
| click | Click handler | (event: MouseEvent) => void |

#### Slots

| Slot | Description | Type |
| --- | --- | --- |
| default | Text content | () => any |

#### Methods

| Method | Description | Type |
| --- | --- | --- |
| focus | Focus text | () => void |

## Types

### copyable {#copyable}

| Property | Description | Type | Default |
| --- | --- | --- | --- |
| format | Copy format | string | text/plain |

#### Events

| Event | Description | Type |
| --- | --- | --- |
| copy | Copy handler | () => void |

## Additional API

### Typography.Link

#### Props

| Property | Description | Type |
| --- | --- | --- |
| href | Link target | string |

## Semantic DOM {#semantic-dom}

### Props

| Property | Description |
| --- | --- |
| ignored | Must not be parsed |
`

const zhTypography = `---
title: Typography
---

## API

### Typography

#### 属性

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| direction | 文字方向 | string | ltr |

### TypographyText

#### 属性

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| code | 代码样式 | boolean | false |

#### 事件

| 事件 | 说明 | 类型 |
| --- | --- | --- |
| click | 点击回调 | (event: MouseEvent) => void |

#### 插槽

| 插槽 | 说明 | 类型 |
| --- | --- | --- |
| default | 文本内容 | () => any |

#### 方法

| 方法 | 说明 | 类型 |
| --- | --- | --- |
| focus | 聚焦文本 | () => void |

## 类型

### copyable

| 参数 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| format | 复制格式 | string | text/plain |

#### 事件

| 事件 | 说明 | 类型 |
| --- | --- | --- |
| copy | 复制回调 | () => void |

## 补充 API

### TypographyLink

#### 属性

| 参数 | 说明 | 类型 |
| --- | --- | --- |
| href | 链接地址 | string |

## 语义化 DOM {#semantic-dom}
`

describe('extractLocalizedComponentApi', () => {
  it('keeps API kinds separate and filters type definitions before Semantic DOM', () => {
    const result = extractLocalizedComponentApi(enTypography, zhTypography)

    expect(result.props).toEqual({
      properties: [expect.objectContaining({
        name: 'direction',
        description: 'Direction control',
        descriptionZh: '文字方向',
      })],
      events: [],
      slots: [],
      methods: [],
    })
    expect(result.subComponents).toEqual(['TypographyText', 'TypographyLink'])
    expect(result.subComponentProps.TypographyText).toEqual({
      properties: [expect.objectContaining({
        name: 'code',
        descriptionZh: '代码样式',
      })],
      events: [expect.objectContaining({
        name: 'click',
        descriptionZh: '点击回调',
      })],
      slots: [expect.objectContaining({
        name: 'default',
        descriptionZh: '文本内容',
      })],
      methods: [expect.objectContaining({
        name: 'focus',
        descriptionZh: '聚焦文本',
      })],
    })
    expect(result.subComponentProps.copyable).toBeUndefined()
    expect(result.subComponentProps.TypographyLink).toEqual({
      properties: [expect.objectContaining({
        name: 'href',
        descriptionZh: '链接地址',
      })],
      events: [],
      slots: [],
      methods: [],
    })
    expect(result.props.properties).not.toContainEqual(expect.objectContaining({ name: 'ignored' }))
  })

  it('matches reordered bilingual subcomponents by identity instead of array index', () => {
    const en = `---
title: Root
---
## API
### Root.ChildA
| Property | Description |
| --- | --- |
| alpha | Alpha |
### Root.ChildB
| Property | Description |
| --- | --- |
| beta | Beta |
## Semantic DOM
`
    const zh = `---
title: Root
---
## API
### RootChildB
| 参数 | 说明 |
| --- | --- |
| beta | 乙 |
### RootChildA
| 参数 | 说明 |
| --- | --- |
| alpha | 甲 |
## 语义化 DOM
`

    const result = extractLocalizedComponentApi(en, zh)

    expect(result.subComponents).toEqual(['RootChildA', 'RootChildB'])
    expect(result.subComponentProps.RootChildA.properties[0]).toEqual(expect.objectContaining({
      name: 'alpha',
      descriptionZh: '甲',
    }))
    expect(result.subComponentProps.RootChildB.properties[0]).toEqual(expect.objectContaining({
      name: 'beta',
      descriptionZh: '乙',
    }))
  })
})
