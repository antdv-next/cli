
> [!IMPORTANT]
> This project is still in development. Not yet usable.

<div align="center">

<br>

<img src="https://www.antdv-next.com/assets/antdv-next-Cum7m2ZU.svg" alt="Antdv Next" width="72">

<h1>Antdv Next CLI</h1>

**命令行上的 Antdv Next。**<br>
查询组件知识、分析项目用量、指导版本迁移 — 完全离线。

</div>

<br>

## 🤔 为什么

Code Agent（Claude Code、Codex、Gemini CLI）在拥有即时 API 数据访问能力时，能写出更好的 antdv next 代码。这个 CLI
正是为此而生 — antdv next 的每个 Prop、Token、Demo 和 Changelog 条目，本地打包，毫秒级查询。

```bash
npx skills add @antdv-next/cli # install as an agent skill
```

<br>

## ✨ 亮点

- 📦 **完全离线** — 所有元数据随包安装，无需网络请求，无延迟，无 API Key。
- 🎯 **版本精确** — 查询 antdv-next@x.y.z 的精确 API，而非仅 "latest"。
- 🤖 **Agent 优化** — 所有命令支持 `--format json`。结构化错误码与修复建议。stdout/stderr 严格分离。
- 🔮 **智能纠错** — 输入 `Buttn`？CLI 基于 Levenshtein 距离建议 `Button`，优先匹配首字母相同的候选。
- 🔌 **MCP 服务** — `antdv mcp` 启动 stdio 服务，原生集成 Claude Desktop、Cursor 等 IDE。

## 📦 安装

```bash
npm install -g @antdv-next/cli
```

<details>
<summary>其他包管理器</summary>

```bash
pnpm add -g @antdv-next/cli
bun add -g @antdv-next/cli
```

</details>

<br>

## 🤖 Agent 集成

CLI 内置 [Skill 文件](./skills/antdv-next/SKILL.md)，指导 Code Agent 在正确的时机调用正确的命令：

```bash
npx skills add antdv-next/cli
```

或者直接告诉你的 Code Agent：

> 安装 `@antdv-next/cli` 和 `antdv-next/cli` 的 antdv next skill

Agent 会自动完成 `npm install`、`npx skills add`，并开始使用 CLI。

### MCP 服务

支持 [Model Context Protocol](https://modelcontextprotocol.io) 的 IDE 可直接将 CLI 作为 MCP 服务使用：

```json
{
  "mcpServers": {
    "antd": {
      "command": "antdv",
      "args": ["mcp"]
    }
  }
}
```

如需固定 antdv-next 版本，在 `args` 数组中添加 `"--ver", "1.5.1"`。

提供 8 个工具（`antdv_list`、`antdv_info`、`antdv_doc`、`antdv_demo`、`antdv_token`、`antdv_design_md`、`antdv_semantic`、`antdv_changelog`）和 2 个提示词（`antdv-expert`、`antdv-page-generator`）。

支持 [Claude Code](https://claude.ai/code)、[Cursor](https://cursor.sh)、[Codex](https://openai.com/codex)、[Gemini CLI](https://github.com/google-gemini/gemini-cli) 等所有兼容 [skills](https://github.com/nicepkg/agent-skills) 协议的 Agent。

<br>

## 🚀 快速开始

```bash
antdv list                                   # 所有组件及版本信息
antdv info Button                            # 组件 Props、类型、默认值
antdv doc Button                             # 完整 Markdown 文档
antdv demo Select basic                      # 可运行的 Demo 源码
antdv token DatePicker                       # Design Token 值（v5+）
antdv design.md                              # 设计语言文档（design.md）
antdv semantic Table                         # classNames / styles 结构
antdv changelog 1.0.5 1.5.2 Select           # 跨版本 API 差异对比
antdv doctor                                 # 诊断项目配置问题
antdv env                                    # 收集环境信息用于 Bug 报告
antdv usage ./src                            # 分析项目中的 antd 导入
antdv lint ./src                             # 检查废弃 API 和最佳实践
antdv migrate 1.0.0 1.5.1 --apply ./src      # 生成 Agent 迁移提示
antdv mcp                                    # 启动 MCP 服务，供 IDE 集成
antdv setup --client claude                  # 为 AI Agent 接入 MCP/Skill
antdv upgrade                                # 升级 CLI 到最新版本
```


## 📄 开源协议

[MIT](./LICENSE) © [Antv Next](https://antdv-next.com)
