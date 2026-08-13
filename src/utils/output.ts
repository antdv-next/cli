import type { OutputFormat } from '@/args/default.ts'
import type { ResolvedContent } from '@/types.ts'

export const output = (content: ResolvedContent, type: OutputFormat): string => {
    switch (type) {
        case 'json':
            console.log(JSON.stringify(content.json, null, 2))
            return ''
        case 'markdown':
            console.log(content.markdown)
            return ''
        case 'text':
        default:
            console.log(content.text)
            return ''
    }
}
