import type { ResolvedVersion } from '@/types.ts'
import process from 'node:process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import toolsHandler from '@/mcp/handler.ts'
import { antdvMcpToolDefinitions, createAntdvToolHandler } from '@/mcp/tools.ts'
import { resolveVersion } from '@/utils/version.ts'

function createAntdvMcpServer(version: ResolvedVersion): McpServer {
  const server = new McpServer(
    {
      name: 'antdv-mcp',
      version: __CLI_VERSION__,
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: 'Use these tools to query Ant Design Vue Next component knowledge.',
    },
  )

  const handler = createAntdvToolHandler({ version }, toolsHandler)
  for (const tool of antdvMcpToolDefinitions) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      (params: Record<string, unknown>) => handler(tool.name, params),
    )
  }

  return server
}

export default defineCommand({
  meta: {
    name: 'mcp',
    description: 'Start MCP server for AI assistant integration',
  },
  args: defaultArgs,
  async run({ args }) {
    const config = resolveConfig(args)
    const version = await resolveVersion(config)
    try {
      const server = createAntdvMcpServer(version)
      const transport = new StdioServerTransport()

      process.once('SIGINT', async () => {
        await server.close()
        process.exit(0)
      })

      await server.connect(transport)
    }
    catch (error) {
      console.error('Failed to start antdv MCP server:', error)
      process.exitCode = 1
    }
  },
})
