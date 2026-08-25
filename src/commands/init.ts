import { resolve } from 'node:path'
import { box, intro, outro } from '@clack/prompts'
import { defineCommand } from 'citty'
import { downloadTemplate } from 'giget'
import { cyan, green } from 'picocolors'
import { x } from 'tinyexec'
import { defaultArgs } from '@/args/default.ts'
import { initArgs } from '@/args/init.ts'
import { resolveConfig } from '@/config.ts'

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a fresh project',
  },
  args: {
    ...defaultArgs,
    ...initArgs,
  },
  async run({ args }) {
    intro('Welcome to Antdv!')

    const config = resolveConfig(args)

    const dir = resolve(config.cwd, args.name)
    const template = `https://codeload.github.com/antdv-next/${args.nuxt ? 'nuxt-template' : 'starter-template'}/tar.gz/refs/heads/main`

    await downloadTemplate(template, {
      cwd: config.cwd,
      dir,
      force: true,
      forceClean: true,
    })

    if (args.git) {
      await x('git', ['init'], {
        nodeOptions: {
          cwd: dir,
          stdio: 'pipe',
        },
      })
    }

    outro(`🚀  Successfully created project ${green(args.name)}`)

    const nextStep = [
      `cd ${args.name}`,
      'pnpm install',
      'pnpm run dev',
    ]

    box(`\n${nextStep.map(step => ` › ${cyan(step)}`).join('\n')}\n`, ' 👉 Next steps ', {
      contentAlign: 'left',
      titleAlign: 'left',
      width: 'auto',
      rounded: true,
      titlePadding: 2,
      contentPadding: 2,
      withGuide: false,
    })
  },
})
