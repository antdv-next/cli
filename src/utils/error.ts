import type { OptionsArgs } from '@/args/args'
import type { OutputFormat } from '@/args/default.ts'
import type { CliError } from '@/types.ts'

export function logErrorComponent(args: OptionsArgs): void {
  console.log(`Error: Component '${args.component}' not found ${args.ver ? `for antdv-next v${args.ver}` : ''}`)
}

export function logError(error: CliError, format: OutputFormat): void {
  if (format === 'json') {
    console.log(JSON.stringify(error, null, 2))
  }
  else {
    console.error(`Error: ${error.message}`)
    if (error.suggestion) {
      console.error(`Suggestion: ${error.suggestion}`)
    }
  }
}
