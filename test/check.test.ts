import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLatestVersion } from '../src/utils/check'

const URLS = [
  'https://registry.npmjs.org/@antdv-next/cli/latest',
  'https://registry.npmmirror.com/@antdv-next/cli/latest',
  'https://unpkg.com/@antdv-next/cli@latest/package.json',
] as const

interface Deferred<T> {
  promise: Promise<T>
  reject: (reason?: unknown) => void
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getLatestVersion', () => {
  it('returns the fastest valid version and aborts the slower requests', async () => {
    vi.useFakeTimers()
    const responses = URLS.map(() => createDeferred<Response>())
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const index = URLS.indexOf(String(input) as typeof URLS[number])
      const signal = init?.signal as AbortSignal
      signals[index] = signal
      signal.addEventListener('abort', () => responses[index]!.reject(signal.reason), { once: true })
      return responses[index]!.promise
    })
    vi.stubGlobal('fetch', fetchMock)

    const latestVersion = getLatestVersion()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    responses[0]!.resolve(Response.json({ version: '' }))
    responses[2]!.resolve(Response.json({ version: '2.1.0' }))

    await expect(latestVersion).resolves.toBe('2.1.0')
    expect(signals[0]!.aborted).toBe(true)
    expect(signals[1]!.aborted).toBe(true)
    expect(signals[2]!.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves every source error when all registries fail', async () => {
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = String(input)

      if (url === URLS[0]) {
        return Promise.reject(new Error('network unavailable'))
      }
      if (url === URLS[1]) {
        return Promise.resolve(new Response(null, { status: 503 }))
      }

      return Promise.resolve(Response.json({ name: '@antdv-next/cli' }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const error: unknown = await getLatestVersion().catch(error => error)

    expect(error).toBeInstanceOf(AggregateError)
    expect(error).toMatchObject({
      message: 'All promises were rejected',
      errors: [
        expect.objectContaining({ message: 'network unavailable' }),
        expect.objectContaining({ message: `Request to ${URLS[1]} failed with status 503` }),
        expect.objectContaining({ message: `Request to ${URLS[2]} returned an invalid version` }),
      ],
    })
  })

  it('returns 0.0.0 and aborts the remaining requests when the package is not found', async () => {
    vi.useFakeTimers()
    const responses = URLS.map(() => createDeferred<Response>())
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const index = URLS.indexOf(String(input) as typeof URLS[number])
      const signal = init?.signal as AbortSignal
      signals[index] = signal
      signal.addEventListener('abort', () => responses[index]!.reject(signal.reason), { once: true })
      return responses[index]!.promise
    })
    vi.stubGlobal('fetch', fetchMock)

    const latestVersion = getLatestVersion()
    responses[0]!.resolve(new Response(null, { status: 404 }))

    await expect(latestVersion).resolves.toBe('0.0.0')
    expect(signals[0]!.aborted).toBe(false)
    expect(signals[1]!.aborted).toBe(true)
    expect(signals[2]!.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out and aborts all requests when no source responds', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const fetchMock = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal
      signals.push(signal)

      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = getLatestVersion().catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(5_000)
    const error = await result

    expect(error).toBeInstanceOf(AggregateError)
    expect(error).toMatchObject({
      message: 'All promises were rejected',
      errors: URLS.map(url => expect.objectContaining({
        message: `Request to ${url} timed out after 5000ms`,
      })),
    })
    expect(signals).toHaveLength(3)
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
