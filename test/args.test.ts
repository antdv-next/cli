import type { CommandArgs, OutputFormat } from '../src/args'
import type { ResolvedConfig } from '../src/types'
import { parseArgs } from 'citty'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { defaultArgs, OUTPUT_FORMATS } from '../src/args'

describe('defaultArgs format', () => {
    it('accepts text, markdown, and json', () => {
        expect(OUTPUT_FORMATS).toEqual(['text', 'markdown', 'json'])

        for (const format of OUTPUT_FORMATS) {
            const args = parseArgs<typeof defaultArgs>(['--format', format], defaultArgs)
            expect(args.format).toBe(format)
        }
    })

    it('defaults to text', () => {
        const args = parseArgs<typeof defaultArgs>([], defaultArgs)

        expect(args.format).toBe('text')
    })

    it('rejects unsupported formats', () => {
        expect(() => parseArgs<typeof defaultArgs>(['--format', 'yaml'], defaultArgs))
            .toThrow(/Expected one of:.*text.*markdown.*json/)
    })

    it('preserves the format union in command and config declarations', () => {
        expectTypeOf<CommandArgs['format']>().toEqualTypeOf<OutputFormat>()
        expectTypeOf<ResolvedConfig['format']>().toEqualTypeOf<OutputFormat>()
    })
})
