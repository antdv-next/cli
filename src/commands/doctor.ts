import { defineCommand } from 'citty'

export default defineCommand({
  meta: {
    name: 'doctor',
    description: 'Diagnose project-level antd configuration issues',
  },
  run({ args }) {
    // TODO antd doctor 10 项诊断检查：兼容性、重复安装、peer 依赖、SSR、babel 插件
    console.log('Parsed args:', args)
  },
})
