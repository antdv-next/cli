import type { ResolvedVersion } from '@/types.ts'
import process from 'node:process'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js'
import { defineCommand } from 'citty'
import { defaultArgs } from '@/args/default.ts'
import { resolveConfig } from '@/config.ts'
import toolsHandler from '@/mcp/handler.ts'
import { antdvMcpToolDefinitions, createAntdvToolHandler } from '@/mcp/tools.ts'
import { resolveVersion } from '@/utils/version.ts'

function createAntdvMcpServer(version: ResolvedVersion): Server {
  const server = new Server(
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

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: antdvMcpToolDefinitions,
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: params } = request.params
    const handler = createAntdvToolHandler({ version }, toolsHandler)

    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`)
    }

    return await handler(name, params ?? {})
  })

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
