import type { OptionsArgs } from '@/args/args'

export function logErrorComponent(args: OptionsArgs): void {
  console.log(`Error: Component '${args.component}' not found ${args.ver ? `for antdv-next v${args.ver}` : ''}`)
}
