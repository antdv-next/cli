import type { OptionsArgs } from '../src/args/args'
import type { OutputFormat } from '../src/args/default'
import type { ResolvedConfig } from '../src/types'
import { parseArgs } from 'citty'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { defaultArgs, OUTPUT_FORMATS } from '../src/args/default'

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

    it('preserves the format union in parsed options and resolved config', () => {
        expectTypeOf<OptionsArgs['format']>().toEqualTypeOf<OutputFormat>()
        expectTypeOf<ResolvedConfig['format']>().toEqualTypeOf<OutputFormat>()
    })
})
