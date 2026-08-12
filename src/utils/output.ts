import type { OutputFormat } from '@/args.ts'
import type { ResolvedContent } from '@/types.ts'

export const output = (content: ResolvedContent, type: OutputFormat): string => {
    switch (type) {
        case 'json':
            return JSON.stringify(content.json, null, 2)
        case 'markdown':
        case 'text':
        default:
            return content.text
    }
}
