export interface AstNode {
  type?: string
  name?: string | AstNode
  object?: AstNode
  property?: AstNode
  imported?: AstNode
  local?: AstNode
  source?: AstNode
  specifiers?: AstNode[]
  value?: unknown
  importKind?: string
  start?: number
  [key: string]: unknown
}

export interface ParsedSourceUsage {
  tags: string[]
  namedImports: Map<string, string>
  namespaceImports: Set<string>
}

export interface ComponentUsage {
  component: string
  count: number
  files: string[]
}
