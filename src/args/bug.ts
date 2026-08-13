import type { ArgsDef } from 'citty'
import { defaultArgs } from '@/args/default.ts'

export const bugArgs = {
    ...defaultArgs,
    // 问题标题
    title: {
        type: 'string',
        description: 'Issue title',
        required: true,
        alias: 't',
    },
    // 重现链接
    reproduction: {
        type: 'string',
        description: 'Reproduction link',
        default: '',
    },
    // 重现步骤
    steps: {
        type: 'string',
        description: 'Steps to reproduce',
        default: '',
    },
    // 期望的结果是什么？
    expected: {
        type: 'string',
        description: 'Expected behavior',
        default: '',
    },
    // 实际的结果是什么?
    actual: {
        type: 'string',
        description: 'Actual behavior',
        default: '',
    },
    // 补充说明
    extra: {
        type: 'string',
        description: 'Additional comments',
        default: '',
    },
    // 是否 cli 创建 issues
    submit: {
        type: 'boolean',
        description: 'Submit via gh CLI instead of previewing',
        default: false,
    },
} satisfies ArgsDef
