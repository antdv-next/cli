import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'usage',
    description: 'Scan project for antd component/API usage statistics',
  },
  run({ args }) {
    // antd usage [dir]
    // 导入统计、子组件分布（Form.Item）、非组件导出
    console.log('Parsed args:', args)
  },
})
