import type { EnvResult } from '../src/commands/env'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectBuildTools,
  collectDependencies,
  collectEnvinfo,

  formatMarkdown,
  formatText,
  getInstalledPackageVersion,
  scanEcosystem,
} from '../src/commands/env'

const mocks = vi.hoisted(() => ({
  envinfoRun: vi.fn(),
  x: vi.fn(),
}))

vi.mock('envinfo', () => ({
  default: {
    run: mocks.envinfoRun,
  },
}))

vi.mock('tinyexec', () => ({
  x: mocks.x,
}))

let projectPath: string

async function writePackage(packageName: string, version?: string): Promise<void> {
  const packageDirectory = join(projectPath, 'node_modules', packageName)
  await fs.mkdir(packageDirectory, { recursive: true })
  await fs.writeFile(join(packageDirectory, 'package.json'), JSON.stringify({
    name: packageName,
    version,
  }))
}

async function writeProjectPackage(packageJson: Record<string, unknown>): Promise<void> {
  await fs.writeFile(join(projectPath, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    ...packageJson,
  }))
}

beforeEach(async () => {
  projectPath = await fs.mkdtemp(join(tmpdir(), 'antdv-cli-env-'))
  vi.clearAllMocks()
})

afterEach(async () => await fs.rm(projectPath, {
  recursive: true,
  force: true,
}))

describe('collectEnvinfo', () => {
  it('normalizes envinfo values and adds the project npm registry', async () => {
    mocks.envinfoRun.mockResolvedValueOnce(JSON.stringify({
      System: {
        OS: 'macOS 15.7.3',
        Numeric: 123,
        Empty: null,
        Node: { version: '26.0.0', path: '/usr/local/bin/node' },
      },
    }))
    mocks.x.mockResolvedValueOnce({
      stdout: 'https://registry.npmjs.org\n',
    })

    const result = await collectEnvinfo({
      cwd: projectPath,
      format: 'text',
    })

    expect(result).toEqual({
      System: {
        OS: 'macOS 15.7.3',
        Numeric: null,
        Empty: null,
        Node: { version: '26.0.0', path: '/usr/local/bin/node' },
      },
      Binaries: {
        Registry: 'https://registry.npmjs.org',
      },
    })
    expect(mocks.x).toHaveBeenCalledWith('npm', ['config', 'get', 'registry'], {
      timeout: 5000,
      nodeOptions: {
        cwd: projectPath,
        stdio: 'pipe',
      },
    })
  })

  it('sets Registry to null when npm config cannot be read', async () => {
    mocks.envinfoRun.mockResolvedValueOnce(JSON.stringify({
      Binaries: {
        Node: '26.0.0',
      },
    }))
    mocks.x.mockRejectedValueOnce(new Error('npm not found'))

    const result = await collectEnvinfo({
      cwd: projectPath,
      format: 'text',
    })

    expect(result.Binaries).toEqual({
      Node: '26.0.0',
      Registry: null,
    })
  })

  it('returns an empty object when envinfo collection fails', async () => {
    mocks.envinfoRun.mockRejectedValueOnce(new Error('envinfo failed'))

    const result = await collectEnvinfo({
      cwd: projectPath,
      format: 'text',
    })

    expect(result).toEqual({})
    expect(mocks.x).not.toHaveBeenCalled()
  })
})

describe('getInstalledPackageVersion', () => {
  it('reads the package version from the target project', async () => {
    await writePackage('antdv-next', '1.2.3')

    await expect(getInstalledPackageVersion(projectPath, 'antdv-next')).resolves.toBe('1.2.3')
  })

  it('returns null for a missing package or version', async () => {
    await writePackage('dayjs')

    await expect(getInstalledPackageVersion(projectPath, 'dayjs')).resolves.toBeNull()
    await expect(getInstalledPackageVersion(projectPath, 'not-installed')).resolves.toBeNull()
  })
})

describe('collectDependencies', () => {
  it('reports only the four antdv core dependencies and includes missing packages', async () => {
    await Promise.all([
      writePackage('antdv-next', '1.0.0'),
      writePackage('@antdv-next/cssinjs', '2.0.0'),
      writePackage('@antdv-next/icons', '3.0.0'),
      writePackage('unrelated-package', '9.0.0'),
    ])

    await expect(collectDependencies(projectPath)).resolves.toEqual({
      'antdv-next': '1.0.0',
      '@antdv-next/cssinjs': '2.0.0',
      '@antdv-next/icons': '3.0.0',
      'dayjs': null,
    })
  })
})

describe('scanEcosystem', () => {
  it('collects declared non-core @antdv-next and @v-c packages', async () => {
    await writeProjectPackage({
      dependencies: {
        '@antdv-next/cssinjs': '^2.0.0',
        'unrelated-package': '^9.0.0',
      },
      devDependencies: {
        '@v-c/dialog': '^5.0.0',
        '@v-c/no-version': '^1.0.0',
      },
      optionalDependencies: {
        '@v-c/optional': '^2.0.0',
      },
      peerDependencies: {
        '@antdv-next/icons': '^3.0.0',
        '@v-c/peer': '^4.0.0',
      },
    })
    await Promise.all([
      writePackage('@antdv-next/cssinjs', '2.0.0'),
      writePackage('@antdv-next/icons', '3.0.0'),
      writePackage('@v-c/dialog', '5.0.0'),
      writePackage('@v-c/no-version'),
      writePackage('@v-c/optional', '2.0.0'),
      writePackage('@v-c/peer', '4.0.0'),
      writePackage('@v-c/undeclared', '6.0.0'),
      writePackage('unrelated-package', '9.0.0'),
    ])

    await expect(scanEcosystem(projectPath)).resolves.toEqual({
      '@v-c/dialog': '5.0.0',
      '@v-c/optional': '2.0.0',
      '@v-c/peer': '4.0.0',
    })
  })

  it('returns an empty object when no ecosystem dependencies are declared', async () => {
    await writeProjectPackage({})

    await expect(scanEcosystem(projectPath)).resolves.toEqual({})
  })
})

describe('collectBuildTools', () => {
  it('reports only the requested installed build tools', async () => {
    const versions = {
      vue: '3.5.0',
      nuxt: '4.0.0',
      vite: '7.0.0',
      esbuild: '0.25.0',
      rollup: '4.0.0',
      tsdown: '0.15.0',
      typescript: '6.0.0',
      tailwindcss: '4.0.0',
    }
    await Promise.all([
      ...Object.entries(versions).map(([packageName, version]) => writePackage(packageName, version)),
      writePackage('webpack', '5.0.0'),
    ])

    await expect(collectBuildTools(projectPath)).resolves.toEqual(versions)
  })

  it('omits build tools that are not installed', async () => {
    await writePackage('vite', '7.0.0')

    await expect(collectBuildTools(projectPath)).resolves.toEqual({
      vite: '7.0.0',
    })
  })
})

describe('environment formatters', () => {
  const data: EnvResult = {
    envinfo: {
      System: {
        OS: 'macOS 15.7.3',
        CPU: null,
        Node: { version: '26.0.0', path: '/usr/local/bin/node' },
        Shell: { path: '/bin/zsh' },
      },
      Binaries: {
        Registry: 'https://registry.npmjs.org',
      },
    },
    dependencies: {
      'antdv-next': '1.0.0',
      '@antdv-next/cssinjs': null,
      '@antdv-next/icons': '2.0.0',
      'dayjs': null,
    },
    ecosystem: {
      '@v-c/dialog': '3.0.0',
    },
    buildTools: {
      vue: '3.5.0',
      vite: '7.0.0',
    },
  }

  it('formats readable text and hides unavailable envinfo values', () => {
    const result = formatText(data)

    expect(result).toContain('Environment')
    expect(result).toContain('  System:')
    expect(result).toContain('Node  26.0.0')
    expect(result).not.toContain('CPU')
    expect(result).not.toContain('Shell')
    expect(result).toContain('  Dependencies:')
    expect(result).toContain('@antdv-next/cssinjs  Not found')
    expect(result).toContain('  Ecosystem:')
    expect(result).toContain('@v-c/dialog  3.0.0')
    expect(result).toContain('  Build Tools:')
  })

  it('formats markdown tables and keeps missing core dependencies visible', () => {
    const result = formatMarkdown(data)

    expect(result).toContain('## Environment')
    expect(result).toContain('### System')
    expect(result).toContain('| Item | Version |')
    expect(result).toContain('| Node | 26.0.0 |')
    expect(result).not.toContain('| CPU |')
    expect(result).toContain('### Dependencies')
    expect(result).toContain('| @antdv-next/cssinjs | Not found |')
    expect(result).toContain('### Ecosystem')
    expect(result).toContain('### Build Tools')
  })
})
