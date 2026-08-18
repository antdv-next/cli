import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'demo',
    description: 'Get demo source code for a component',
  },
  run({ args }) {
    // TODO antd demo <Component> [name
    // 可运行的 Demo 源码（TSX）
    console.log('Parsed args:', args)
  },
})
