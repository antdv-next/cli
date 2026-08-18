import { x } from 'tinyexec'

export const getPackageManagerVersion = async (cwd: string, manager: string): Promise<string> => {
  try {
    const { stdout } = await x(manager, ['-v'], {
      nodeOptions: {
        cwd,
        stdio: 'pipe',
      },
    })
    return stdout.trim()
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  catch (error) {
    return '0.0.0'
  }
}
