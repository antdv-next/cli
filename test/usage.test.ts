import type { ComponentRecord } from '../src/types/components.ts'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseComponentTags, scanProjectUsage } from '../src/commands/usage.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

function component(name: string, subComponents: string[] = []): ComponentRecord {
  return { name, subComponents } as ComponentRecord
}

describe('usage command', () => {
  it('extracts component tags from Vue templates and TSX syntax with oxc-parser', () => {
    const vue = `
      <template>
        <AButton v-if="visible" @click="submit" />
        <AForm.Item><AInput /></AForm.Item>
        <div title="<AFake />"><!-- <ATable /> -->{{ '<ACard />' }}</div>
        <NotAntdv />
      </template>
      <script setup lang="ts">const example = '<AFake />'</script>
    `
    const tsx = 'export const View = () => <><AButton /><ATable.Column /><Other /></>'

    expect(parseComponentTags('Example.vue', vue)).toEqual(['AButton', 'AForm', 'AInput', 'NotAntdv'])
    expect(parseComponentTags('Example.tsx', tsx)).toEqual(['AButton', 'ATable', 'Other'])
  })

  it('supports A-prefixed tags, named imports, aliases, subcomponents, and namespace imports', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antdv-usage-'))
    temporaryDirectories.push(root)

    await Promise.all([
      mkdir(join(root, 'src', 'pages'), { recursive: true }),
      mkdir(join(root, 'src', 'node_modules', 'ignored'), { recursive: true }),
      mkdir(join(root, 'packages', 'feature', 'src'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(root, 'src', 'App.vue'), `
        <script setup lang="ts">
        import { Button as AntButton } from 'antdv-next'
        import { Button as LocalButton } from './button'
        </script>
        <template><AButton /><AntButton /><LocalButton /><AUnknown /></template>
      `),
      writeFile(join(root, 'src', 'pages', 'Table.tsx'), `
        import type { ButtonProps } from 'antdv-next'
        import { Alert, ConfigProvider as AntdConfigProvider, FormItem, LayoutContent } from 'antdv-next'
        import * as Antd from 'antdv-next'
        export const View = () => <><Alert /><AntdConfigProvider /><FormItem /><LayoutContent /><Antd.Table /><ButtonProps /></>
      `),
      writeFile(join(root, 'packages', 'feature', 'src', 'Input.vue'), '<template><AInput /></template>'),
      writeFile(join(root, 'src', 'node_modules', 'ignored', 'Index.vue'), '<template><AInput /></template>'),
      writeFile(join(root, 'src', 'ignored.jsx'), 'export const Input = () => <AInput />'),
    ])

    await expect(scanProjectUsage(root, [
      component('Alert'),
      component('Button'),
      component('ConfigProvider'),
      component('Form', ['FormItem']),
      component('Input'),
      component('Layout'),
      component('Table'),
    ])).resolves.toEqual([
      { component: 'Alert', count: 1, files: ['src/pages/Table.tsx'] },
      { component: 'Button', count: 2, files: ['src/App.vue'] },
      { component: 'ConfigProvider', count: 1, files: ['src/pages/Table.tsx'] },
      { component: 'Form', count: 1, files: ['src/pages/Table.tsx'] },
      { component: 'Input', count: 1, files: ['packages/feature/src/Input.vue'] },
      { component: 'Layout', count: 1, files: ['src/pages/Table.tsx'] },
      { component: 'Table', count: 1, files: ['src/pages/Table.tsx'] },
    ])
  })
})
