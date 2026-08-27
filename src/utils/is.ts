import { x } from 'tinyexec'

export const isUrl = (link: string): boolean => {
  return /^(https?):\/\/[^ \t\r\n\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]{2,}$/.test(link)
}

export async function hasGhAvailable(): Promise<boolean> {
  try {
    const result = await x('gh', ['--version'], {
      nodeOptions: {
        cwd: process.cwd(),
        stdio: 'pipe',
      },
    })

    return result.stdout.trim().length > 0
  }
  catch (e) {
    return false
  }
}
