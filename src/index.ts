import { createMain, defineCommand, renderUsage, showUsage } from 'citty'
import { createHelpBanner } from '@/utils/banner.ts'
import { description, name, version } from '../package.json' with { type: 'json' }

declare const __CLI_VERSION__: string
const CLI_VERSION = __CLI_VERSION__

const main = defineCommand({
    meta: {
        name,
        version,
        description,
    },

    setup() {
        console.log(createHelpBanner(CLI_VERSION))
    },
    args: {
        cwd: {
            type: 'string',
            description: 'Current working directory',
            alias: 'c',
            default: process.cwd(),
        },
    },
    subCommands: {
        // TODO
        'bug': () => import('./commands/bug.ts').then(r => r.default),
        'bug-cli': () => import('./commands/bug-cli.ts').then(r => r.default),
        'changelog': () => import('./commands/changelog.ts').then(r => r.default),
        'demo': () => import('./commands/demo.ts').then(r => r.default),
        'design': () => import('./commands/design.ts').then(r => r.default),
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
    },
    async run({ cmd }) {
        await showUsage(cmd)
    },
})

createMain(main)({
    async showUsage(cmd, parent) {
        console.log(createHelpBanner(CLI_VERSION))

        console.log(await renderUsage(cmd, parent))
    },
})
