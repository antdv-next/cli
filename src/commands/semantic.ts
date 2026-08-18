import { defineCommand } from 'citty'

export default defineCommand({
    meta: {
        name: 'semantic',
        description: 'Query the semantic customization structure of a component',
    },
    run({ args }) {
        // antd semantic <Component>
        // 语义化 classNames / styles 结构及用法示例
        console.log('Parsed args:', args)
    },
})
