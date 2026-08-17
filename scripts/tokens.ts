import { statSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { x } from 'tinyexec'

export interface TokenData {
    name: string
    type: string
    default?: string
    description?: string
    descriptionZh?: string
}

export async function fetchTokens(version: string): Promise<TokenData[] | unknown[]> {
    try {
        const tmpDir = join(process.cwd(), '.tmp-npm-pack')
        await mkdir(tmpDir, {
            recursive: true,
        })

        console.log(`Fetch token metadata from antdv-next@${version}`)

        await x('npm', ['pack', `antdv-next@${version}`, '--quiet'], {
            nodeOptions: {
                cwd: tmpDir,
                stdio: 'pipe',
            },
        })

        const tempVersionDir = join(tmpDir, `antdv-next-${version}`)
        await mkdir(tempVersionDir, {
            recursive: true,
        })
        console.log(tempVersionDir)

        await x('tar', [
            '-xzf',
            resolve(tmpDir, `antdv-next-${version}.tgz`),
            '-C',
            tempVersionDir,
        ], {
            nodeOptions: {
                cwd: tmpDir,
                stdio: 'pipe',
            },
        })

        const contentPath = join(tempVersionDir, 'package', 'dist', 'version', 'token-meta.json')
        if (!statSync(contentPath).isFile()) {
            return []
        }
        const content = JSON.parse(await readFile(contentPath, 'utf-8'))
        return Object.entries(content.global).map(([key, g]: [string, any]) => ({
            name: key,
            type: g.type,
            default: '',
            description: g.descEn,
            descriptionZh: g.desc,
        })) as TokenData[]
    }
    // eslint-disable-next-line unused-imports/no-unused-vars
    catch (error) {
        return []
    }
}

console.log(await fetchTokens('1.5.1'))
