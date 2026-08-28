import type { AntdvToolStrategyRegistry, handlerContext } from '@/mcp/tools.ts'
import process from 'node:process'
import { getComponentDemo } from '@/commands/demo.ts'
import { getDesignMarkdown } from '@/commands/design.ts'
import { getComponentDocument } from '@/commands/doc.ts'
import { getComponentInfo } from '@/commands/info.ts'
import { outputJson as outputComponentListJson } from '@/commands/list.ts'
import { getComponentSemantic } from '@/commands/semantic.ts'
import { getComponentToken } from '@/commands/token.ts'
import { diffComponent } from '@/utils/api-diff.ts'
import { loadVersionMetaData } from '@/utils/loader.ts'
import { resolveVersion } from '@/utils/version.ts'

const antdvListHandler = async (ctx: Readonly<handlerContext>, params: Record<string, unknown>): Promise<any> => {
  const metaData = await loadVersionMetaData(ctx.version)
  return outputComponentListJson(metaData.components)
}

const antdvInfoHandler = async (ctx: Readonly<handlerContext>, params: Record<'component', string>): Promise<any> => {
  return await getComponentInfo(params.component, ctx.version)
}

const antdvDemoHandler = async (ctx: Readonly<handlerContext>, params: {
  component: string
  name?: string
}): Promise<any> => {
  const demo = await getComponentDemo(params.component, ctx.version)
  return {
    component: params.component,
    demo: params.name ? demo[params.name] : demo,
  }
}

const antdvTokenHandler = async (ctx: Readonly<handlerContext>, params: Record<'component', string>): Promise<any> => {
  return {
    tokens: await getComponentToken(params.component, ctx.version),
  }
}

const antdvSemanticHandler = async (ctx: Readonly<handlerContext>, params: Record<'component', string>): Promise<any> => {
  return {
    component: params.component,
    semanticStructure: await getComponentSemantic(params.component, ctx.version),
  }
}

const antdvDocHandler = async (ctx: Readonly<handlerContext>, params: Record<'component', string>): Promise<any> => {
  return {
    component: params.component,
    doc: await getComponentDocument(params.component, ctx.version).then(r => r.doc),
  }
}

const antdvDesignMdHandler = async (ctx: Readonly<handlerContext>, params: Record<'component', string>): Promise<any> => {
  return {
    doc: await getDesignMarkdown(),
  }
}

const antdvChangelogHandler = async (ctx: Readonly<handlerContext>, params: Record<string, string>): Promise<any> => {
  const v1 = await resolveVersion({
    cwd: process.cwd(),
    format: 'json',
    component: params.component || '',
    version: params.from || '',
  })
  const v2 = await resolveVersion({
    cwd: process.cwd(),
    format: 'json',
    component: params.component || '',
    version: params.to || '',
  })

  return await diffComponent(v1, v2, params.component)
}

export default {
  antdv_list: antdvListHandler,
  antdv_info: antdvInfoHandler,
  antdv_demo: antdvDemoHandler,
  antdv_token: antdvTokenHandler,
  antdv_semantic: antdvSemanticHandler,
  antdv_doc: antdvDocHandler,
  antdv_design_md: antdvDesignMdHandler,
  antdv_changelog: antdvChangelogHandler,
} as AntdvToolStrategyRegistry
