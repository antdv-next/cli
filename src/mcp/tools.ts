import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ResolvedVersion } from '@/types.ts'
import * as z from 'zod'

export interface handlerContext {
  version: ResolvedVersion
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

export const antdvMcpToolDefinitions = [
  {
    name: 'antdv_list',
    description: 'List all available antd components with names, categories, and descriptions',
    inputSchema: z.object({}).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_info',
    description: 'Get component API information including props, events, slots, methods, and other API information for a component.',
    inputSchema: z.object({
      component: z.string().trim().describe('Component name (e.g. Button, Table)'),
    }).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_doc',
    description: 'Get the full markdown documentation for a component',
    inputSchema: z.object({
      component: z.string().trim().describe('Component name (e.g. Button, Table)'),
    }).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_demo',
    description: 'Get demo source code for a component. Without a name, lists all demos; with a name, returns specific demo code',
    inputSchema: z.object({
      component: z.string().trim().describe('Component name (e.g. Button, Table)'),
      name: z.string().trim().optional().describe('Demo name to get specific demo code'),
    }).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_token',
    description: 'Query design tokens. Without a component, returns global tokens; with a component, returns component-level tokens.',
    inputSchema: z.object({
      component: z.string().trim().describe('Component name (e.g. Button, Table)'),
    }).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_semantic',
    description: 'Query the semantic customization structure of a component.',
    inputSchema: z.object({
      component: z.string()
        .trim()
        .describe('Component name (e.g. Button, Table)'),
    }).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_design_md',
    description: 'Obtain the design language document (design.md) of the target main version: It includes the complete color, font, rounded corners, spacing and component token values for the default light theme, as well as explanations about the design principles. It can be used to understand the overall design language of the component library, or as input data for AI design tools (such as Figma Make, Stitch, etc.).',
    inputSchema: z.object({}).strict(),
    annotations: readOnlyAnnotations,
  },
  {
    name: 'antdv_changelog',
    description: 'Obtain the changelog of the target main version',
    inputSchema: z.object({
      from: z.string().trim().describe('Source antdv-next version (e.g. 1.0.5)'),
      to: z.string().trim().describe('Target antdv-next version (e.g. 1.5.2)'),
      component: z.string().optional().describe('Component name (e.g. Button, Table)'),
    }).strict(),
    annotations: readOnlyAnnotations,
  },
] as const

export type AntdvMcpToolName = typeof antdvMcpToolDefinitions[number]['name']
export type AntdvToolStrategy = (ctx: Readonly<handlerContext>, params: Record<string, any>) => Promise<any>
export type AntdvToolStrategyRegistry = Record<AntdvMcpToolName, AntdvToolStrategy>

const toolNames = new Set<AntdvMcpToolName>(
  antdvMcpToolDefinitions.map(tool => tool.name),
)

function isAntdvMcpToolName(name: string): name is AntdvMcpToolName {
  return toolNames.has(name as AntdvMcpToolName)
}

const transferToolResult = (data: any): CallToolResult => {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data) ?? '',
      },
    ],
  }
}

export const createAntdvToolHandler = (ctx: handlerContext, strategies: AntdvToolStrategyRegistry) => {
  return async (name: string, params: Record<string, any>): Promise<CallToolResult> => {
    if (!isAntdvMcpToolName(name)) {
      throw new Error(`Unknown antdv MCP tool: ${name}`)
    }

    const data = await strategies[name](ctx, params)
    return transferToolResult(data)
  }
}
