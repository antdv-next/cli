import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'migrate',
    description: 'Version migration guide with optional auto-fix',
  },
  run({ args }) {
    // TODO antd migrate <from> <to>
    // 迁移清单，区分自动修复/手动处理，--apply 生成 Agent 提示
    console.log('Parsed args:', args)
  },
})
