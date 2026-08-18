import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'info',
    description: 'Query component API: props, type definitions, default values',
  },
  run({ args }) {
    // TODO antd info <Component>
    // Props 表格，含类型、默认值、引入版本和废弃状态
    console.log('Parsed args:', args)
  },
})
