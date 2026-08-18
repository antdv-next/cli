export const createHelpBanner = (version: string): string => {
  const label = `@antdv-next/cli v${version}`
  const divider = '─'.repeat(label.length)

  return `
${label}
${divider}
`
}
