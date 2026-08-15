import process from 'node:process'
import { defineCommand } from 'citty'
import semver from 'semver'
import { getLatestVersion } from '@/utils/check.ts'

export default defineCommand({
    meta: {
        name: 'upgrade',
        description: 'Upgrade the CLI to the latest version',
    },
    async run({ args }) {
        console.log('Parsed args:', args)

        // 获取最新的版本
        const latestVersion = await getLatestVersion()

        if (!semver.gt(latestVersion, __CLI_VERSION__)) {
            // TODO 提示当前版本已是最新版本
            console.log(`已是最新版本: v${__CLI_VERSION__}`)
            process.exit(1)
        }

        // 执行相关的升级步骤
        // step 2: 获取当前用户下的 pm，默认 npm
        // step 3: 根据 pm 进行运行安装 ANTDV_NEXT_CLI
    },
})
