import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'changelog',
    description: 'Query changelog or compare API differences between versions',
  },
  run({ args }) {
    // TODO antd changelog [v1] [v2] [component]
    //  Changelog 条目、版本范围或跨版本 API 对比
    console.log('Parsed args:', args)
  },
})
