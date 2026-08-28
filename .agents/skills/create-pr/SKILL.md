---
name: antdv-next-cli-create-pr
description: Create pull requests for antdv-next/cli using the repository's PR conventions. Use this skill when the user asks to create/open a PR, draft PR title/body, summarize branch changes for a PR, or otherwise prepare PR content. Judge by intent rather than fixed phrases; short colloquial requests still count if they are about creating a PR rather than discussing PR concepts.
---

# Antdv Next CLI PR 创建规范

## 目标

一、基于当前分支相对基线分支的全部改动生成 PR，不只看最后一个 commit。

二、优先使用仓库自带 PR 模板；当前没有模板时，使用本 skill 约定的 `Summary` / `Testing` 结构。

三、PR 正文默认使用英文，用户明确要求中文时可使用中文；PR 标题始终使用英文，并遵循本文档约定的命名格式。

四、真正执行 `gh pr create` 之前，必须先把 `base`、`title`、`body` 给用户确认，确认后才能创建 PR。

## 基本规则

### 一、按意图触发，不按短语触发

只要能判断用户是在请求创建 PR，或为创建 PR 做准备，就应使用本 skill。

不要把触发限制成固定说法。即使用户表达很短、很口语，或要求不完整，只要不是在单纯讨论 PR 概念，也应进入本 skill 的工作流。

### 二、正文结构以仓库约定为准

当前仓库没有 `.github/PULL_REQUEST_TEMPLATE*`。默认使用：

- `## Summary`
- `## Testing`

如果仓库之后新增 PR 模板，必须先读取并使用模板，不要自行改 section 名称或删除主结构。

### 三、正文默认英文，但标题固定英文

现有 PR 正文以英文为主，因此默认使用英文正文。用户明确要求中文时可以使用中文正文。

无论正文使用哪种语言：

- `PR title` 都必须是英文
- `PR title` 必须符合 Conventional Commits 格式
- 标题 subject 必须以小写字符开头，以通过 `.github/workflows/validate-pr-title.yml`

### 四、先分析分支，再写 PR

创建 PR 前，必须先看：

- 当前分支名
- 基线分支
- 当前分支相对基线分支的 commit 列表
- `base...HEAD` 的完整 diff

不要只根据工作区未提交内容写 PR，也不要只根据最近一个 commit 写 PR。

### 五、先给草稿，后创建 PR

无论用户是否说“直接帮我创建 PR”，都要先完成以下步骤：

1. 生成 `base`、`title`、`body` 草稿
2. 明确告诉用户：这是准备提交的 PR 内容
3. 让用户确认是否继续创建，或先修改
4. 只有用户明确确认后，才能真正执行 `gh pr create`

若用户中途要求修改标题、类型、测试说明、目标分支等，应先更新草稿，再次确认。

### 六、标题和正文要分工明确

- PR 标题：用英文一句话概括本分支最主要的变动
- PR 正文：说明主要结果、关键方案、关联 issue 和实际验证结果

正文不是逐文件流水账。要归纳“为什么改”和“改完后对开发者/用户有什么影响”。

### 七、信息不足时不要硬写

若以下内容缺失且无法从分支改动中可靠推断：

- 基线分支
- 关联 issue
- 变动性质
- 测试或验证方式

可以先给出草稿，并把无法确认的地方保留为待补充项；若用户要求直接创建 PR，也必须先说明缺失项并等待确认。

## 执行步骤

### 1. 检查仓库和 PR 环境

建议先确认：

```bash
git status --short
git branch --show-current
git remote -v
gh auth status
```

若 `gh` 不可用、未登录、当前不在 git 仓库、或当前分支不适合提 PR，应先说明问题，不要继续伪造结果。

### 2. 确定基线分支

不要未经分析就直接使用 `main`。按以下顺序判断：

1. 用户明确指定了 `base branch` -> 直接使用
2. 若当前分支存在可用的“来源线索”，优先根据真实 Git 信息推断：
   - `git branch -vv` 查看 tracking / upstream
   - `git reflog show <current-branch>` 查看是否能看出“从哪条分支 checkout 出来”
   - 必要时结合 `git merge-base HEAD <candidate-branch>` 比较分叉点
3. 若能较可靠判断“当前分支是从某条分支切出来的”，优先使用该分支作为 `base`
4. 若无法可靠推断，再退回远端默认分支或仓库默认分支

建议查看：

```bash
git branch --show-current
git branch -vv
git reflog show --date=local $(git branch --show-current)
git remote show origin
```

注意：

- tracking / upstream 只能作为线索，不等于绝对正确的“父分支”
- `reflog` 若已清理，可能无法得到结果
- 若推断结果不够确定，要在草稿中明确标注为“推断值”

#### 新功能分支说明

本仓库的新功能 PR 通常也提交到 `main`。只有用户明确要求 stacked PR，或 Git 历史能可靠证明当前分支基于另一功能分支时，才使用非 `main` 的 base；不要仅因类型为 `feat` 擅自改 base。

### 3. 收集本分支全部改动

至少查看：

```bash
git log --oneline <base>..HEAD
git diff --stat <base>...HEAD
git diff <base>...HEAD
```

必要时再看：

```bash
git diff --name-only <base>...HEAD
```

归纳时要覆盖该分支会进入 PR 的全部提交，而不是只写最后一次改动。

### 4. 确定正文结构和语言

先检查是否存在 `.github/PULL_REQUEST_TEMPLATE*`：

- 存在：读取并使用仓库模板
- 不存在：使用 `Summary` / `Testing` 结构

正文默认使用英文；用户明确要求中文时再使用中文。

### 5. 判断 PR 类型

必须根据整条分支的“主结果”判断，不要被单个文件或 commit 干扰。

优先判断：

1. 新增 CLI、Agent、MCP 或集成方可用能力 -> `feat`
2. 修复错误行为 -> `fix`
3. 只修改文档或 skill -> `docs`
4. 主要修改构建、打包配置 -> `build`
5. 主要修改 workflow / CI -> `ci`
6. 主要修改测试 -> `test`
7. 无外部行为变化的代码整理 -> `refactor`
8. 性能优化 -> `perf`
9. 依赖或内部维护 -> `chore`
10. 版本发布 -> `release`

例如：

- 新增 MCP tool -> `feat(mcp)`
- 修复 changelog 版本解析 -> `fix(changelog)`
- 更新 agent skill 说明 -> `docs(skills)`
- 调整 tsdown 打包配置 -> `build(config)`
- 修改 PR 校验 workflow -> `ci`

### 6. 归纳 PR 的核心信息

至少整理出：

- 主要结果：本分支解决什么问题或新增什么能力
- Related Issues：有可靠关联时填写 issue 链接或 `Closes #xxxx` / `Fixes #xxxx`
- Summary：归纳用户影响、关键方案和重要约束
- Testing：只列出本次实际执行并通过的命令
- 兼容性：说明是否有 CLI 参数、输出格式、配置、MCP API 或打包产物变化

### 7. 处理 Testing

根据改动范围选择验证：

- 所有 PR：`pnpm lint`
- 修改 `src/**` 或 `test/**`：`pnpm build` 和 `pnpm test`
- 涉及 CLI 执行、MCP、setup、打包或跨模块集成：考虑 `pnpm test:all`
- 通用补充检查：`git diff --check`

只写实际执行且通过的命令。未执行时写 `Not run (reason)`；失败时如实说明失败命令，不要写成通过。

### 8. 生成 PR 标题

标题要求：

- 按下方“写法要求 -> 标题”生成
- 覆盖整条分支的主要目标
- 不要照搬单个 commit message
- `type` 要与第 5 步判断一致

### 9. 按约定产出 PR 正文草稿

没有仓库模板时使用：

```markdown
## Summary

- <主要结果或用户影响>
- <关键方案或重要约束>

## Testing

- `<实际通过的命令>`
```

填写时遵守：

- Summary 通常使用 2 至 4 个要点
- Testing 只列实际结果
- 有可靠关联 issue 时加入 `Closes #xxxx`、`Fixes #xxxx` 或链接
- 涉及命令输出或交互变化时，提醒补充必要的终端输出、截图或示例
- 有破坏性变化、迁移要求或公开行为变化时明确写出
- 信息尚未确认时显式标注，不要假装确定

### 10. 先给用户确认

输出时至少包含：

- `Base branch`
- `PR title`
- `PR body`
- 实际执行的测试及结果
- 需要用户补充或确认的点

明确询问用户是否：

- 直接创建 PR
- 先修改后再创建

没有明确确认前，不得执行 `gh pr create`。

### 11. 创建 PR

只有在用户明确确认后，才执行。

执行前再次检查：

```bash
git status --short
git branch -vv
git remote -v
gh repo view --json nameWithOwner,defaultBranchRef
```

要求：

1. 确认当前分支的 tracking remote 和远端分支正确
2. 确认 PR 的目标仓库是 `antdv-next/cli`，不要依赖 `gh` 默认推断
3. 若 tracking remote 缺失、指向不明确、或不是预期 fork，先向用户确认，不要默认推送
4. 只有在推送目标 remote 明确无误时，才推送当前分支
5. 使用已确认过的标题和正文执行 `gh pr create`
6. 只有用户明确要求 Draft PR 时才使用 `--draft`
7. 相同 head/base 已存在 PR 时，返回现有 PR，不要重复创建

若需要推送，优先使用明确的远端与分支名：

```bash
git push -u <remote> HEAD
```

正文较长时写入安全的临时文件，并使用：

```bash
gh pr create \
  --repo antdv-next/cli \
  --base <base> \
  --head <owner>:<branch> \
  --title "<title>" \
  --body-file <body-file>
```

同仓库分支可以只传 `<branch>`；fork 分支使用 `<owner>:<branch>`。创建成功后返回 PR 链接。

## 写法要求

### 标题

- 必须是英文
- 默认先判断 `type`，再决定是否需要 `scope`
- 优先使用 `type: subject` 或 `type(scope): subject`
- 优先写结果，不写过程
- 避免 `update`, `fix issues`, `misc changes` 这类空话
- 若分支包含多类小改动，提炼一个更高层概括

常用 `type` 参考：

- `feat`：新增能力
- `fix`：修复问题
- `docs`：文档或 skill
- `refactor`：重构
- `test`：测试改动
- `build`：构建或打包
- `ci`：CI 或 workflow
- `chore`：杂项维护
- `perf`：性能优化
- `release`：版本发布

`scope` 使用规则：

- 改动集中在单个功能边界时再加，如 `refactor(changelog): ...`
- 常见 scope 包括 `cli`、`mcp`、`changelog`、`version`、`bug`、`setup`、`skills`、`package`
- 若没有明显聚焦对象，就不要硬加 `scope`
- 不要把目录名机械塞进 `scope`

### Summary

- 先写本分支解决的问题或新增的能力
- 再写关键方案和重要约束
- 若涉及 CLI 参数、输出格式、配置、MCP API 或打包产物变化，点明外部可感知差异
- 不要写逐文件流水账

### Testing

- 只列本次实际执行并通过的命令
- 未运行时写 `Not run (reason)`
- 失败时如实说明，不要伪造通过结果
- 根据改动范围参考 `pnpm lint`、`pnpm build`、`pnpm test`、`pnpm test:all` 和 `git diff --check`

## 参考

更多类型判断、基线分支建议、确认话术与标题示例见 `references/template-notes-and-examples.md`。
