import { createMain, defineCommand, renderUsage, showUsage } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { createHelpBanner } from '@/utils/banner.ts'
import { description, name, version } from '../package.json' with { type: 'json' }

const CLI_VERSION = __CLI_VERSION__

const subCommands = {
    'bug': () => import('./commands/bug.ts').then(r => r.default),
    'bug-cli': () => import('./commands/bug-cli.ts').then(r => r.default),
    'changelog': () => import('./commands/changelog.ts').then(r => r.default),
    'demo': () => import('./commands/demo.ts').then(r => r.default),
    'design.md': () => import('./commands/design.ts').then(r => r.default),
    'doc': () => import('./commands/doc.ts').then(r => r.default),
    'doctor': () => import('./commands/doctor.ts').then(r => r.default),
    'env': () => import('./commands/env.ts').then(r => r.default),
    'info': () => import('./commands/info.ts').then(r => r.default),
    'lint': () => import('./commands/lint.ts').then(r => r.default),
    'list': () => import('./commands/list.ts').then(r => r.default),
    'mcp': () => import('./commands/mcp.ts').then(r => r.default),
    'migrate': () => import('./commands/migrate.ts').then(r => r.default),
    'semantic': () => import('./commands/semantic.ts').then(r => r.default),
    'setup': () => import('./commands/setup.ts').then(r => r.default),
    'token': () => import('./commands/token.ts').then(r => r.default),
    'upgrade': () => import('./commands/upgrade.ts').then(r => r.default),
    'usage': () => import('./commands/usage.ts').then(r => r.default),
    'check': () => import('./commands/check.ts').then(r => r.default),
}

const main = defineCommand({
    meta: {
        name,
        version,
        description,
    },
    setup() {
    },
    args: defaultArgs,
    subCommands,
    async run(ctx) {
        if (ctx.rawArgs.length >= 1 && Object.keys(subCommands).includes(ctx.rawArgs[0]!)) {
            return ''
        }

        console.log(createHelpBanner(CLI_VERSION))

        await showUsage(ctx.cmd)
    },
})

createMain(main)({
    async showUsage(cmd, parent) {
        console.log(createHelpBanner(CLI_VERSION))

        console.log(await renderUsage(cmd, parent))
    },
})
