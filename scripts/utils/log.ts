export function logStep(scope: string, message: string): void {
  console.log(`[${scope}] ${message}`)
}

export function logSection(title: string): void {
  console.log(`\n=== ${title} ===\n`)
}

export function formatDuration(startedAt: number): string {
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`
}
