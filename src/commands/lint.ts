import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'lint',
    description: 'Check antdv-next usage against best practices',
  },
  run({ args }) {
    // TODO antd lint [target]
    // 废弃 API、无障碍缺陷、性能问题、最佳实践
    console.log('Parsed args:', args)
  },
})
