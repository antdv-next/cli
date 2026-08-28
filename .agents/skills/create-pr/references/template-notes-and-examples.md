## PR 类型建议

优先选择最贴近整条分支主结果的一个 type：

- 新增 CLI、Agent、MCP 或集成能力：`feat`
- 修复错误行为：`fix`
- 只修改文档或 skill：`docs`
- 主要修改测试：`test`
- 无外部行为变化的整理：`refactor`
- 性能优化：`perf`
- 构建或打包配置：`build`
- GitHub Actions / CI：`ci`
- 依赖或内部维护：`chore`
- 版本发布：`release`

## 类型判断补充说明

不要因为 diff 里包含逻辑代码就直接判成 `fix`，先看最终结果。

优先判断：

1. `feat` 只用于对外新增能力，不是“代码变多了”
2. `fix` 用于修复真实错误行为
3. 文档、skill、构建和 CI 改动优先使用各自 type
4. 以用户、CLI 调用方或维护者最终感知到的结果为准

示例：

- 新增 MCP 查询工具 -> `feat(mcp): ...`
- 修复版本 fallback 逻辑 -> `fix(version): ...`
- 更新 agent skill -> `docs(skills): ...`
- 调整 tsdown 配置 -> `build(config): ...`
- 修改 PR title workflow -> `ci: ...`

## Related Issues 写法

有明确 issue 时：

- `Closes #123`
- `Fixes #123`
- `Refs #123`

没有可靠关联时可以不写，或写 `None`。不要编造 issue 编号。

## Summary 写法

推荐使用 2 至 4 个要点，回答：

1. 原先有什么问题，或为什么需要新能力
2. 这次改变了什么
3. 是否影响 CLI 参数、输出格式、配置、MCP API 或包内容
4. 是否有破坏性变化或迁移要求

英文示例：

```markdown
## Summary

- keep changelog version resolution inside the diff utility
- simplify the command layer to pass resolved versions
- preserve existing CLI output with no public API changes
```

中文示例：

```markdown
## Summary

- 将 changelog 版本解析收敛到 diff 工具内部
- 简化命令层，只传递已解析版本
- 保持现有 CLI 输出，不涉及公开 API 变化
```

## Testing 写法

Testing 只记录实际执行并通过的命令，不要根据代码改动猜测结果。

常见验证：

- 所有 PR：`pnpm lint`
- 修改 `src/**` 或 `test/**`：`pnpm build`、`pnpm test`
- CLI、MCP、setup、打包或跨模块集成：考虑 `pnpm test:all`
- 通用检查：`git diff --check`

示例：

```markdown
## Testing

- `pnpm lint`
- `pnpm build`
- `pnpm test`
- `git diff --check`
```

未执行时：

```markdown
## Testing

- Not run (documentation-only change)
```

若测试失败，要写明失败命令和原因，不能写成通过。

## 基线分支判断建议

目标是尽量推断“当前分支实际从哪里切出来”，而不是拍脑袋默认 `main`。

建议顺序：

1. 用户明确指定了 `base branch` -> 直接使用
2. 查看当前分支是否能从 `reflog` 看出 checkout 来源
3. 查看 `git branch -vv` 的 tracking / upstream 作为辅助线索
4. 必要时结合 `merge-base` 比较候选分支
5. 若仍无法确定，再退回远端默认分支或仓库默认分支

建议命令：

```bash
git branch --show-current
git branch -vv
git reflog show --date=local $(git branch --show-current)
git remote show origin
git merge-base HEAD <candidate-branch>
```

注意：

- upstream 不是绝对父分支，只是候选线索
- `reflog` 最接近真实答案，但不一定一直存在
- 不确定时要明确告诉用户“这是推断值”

## 创建 PR 前确认话术建议

在真正执行 `git push` 或 `gh pr create` 前，先给用户确认版草稿：

```markdown
我先整理了一版待提交的 PR 草稿，请你确认：

- Target repository: `antdv-next/cli`
- Base branch: `main`
- Head branch: `refactor/changelog-version-loading`
- PR title: `refactor(changelog): move version loading into diff utility`
- Testing: `pnpm lint`, `pnpm test`

如果没问题，我再继续推送并创建 PR；如果你想改 title、base、正文或 Draft 状态，我先更新草稿。
```

## PR 标题示例

`antdv-next/cli` 的 PR 标题使用英文，并遵循：

- `<type>: <subject>`
- `<type>(<scope>): <subject>`

subject 必须以小写字符开头，以通过 `.github/workflows/validate-pr-title.yml`。

推荐示例：

- `feat(mcp): add component changelog query tool`
- `fix(version): resolve missing patch versions with fallback`
- `docs(skills): clarify CLI usage for agents`
- `refactor(changelog): move metadata loading into diff utility`
- `build(config): optimize tsdown bundle output`
- `ci: validate pull request title format`
- `chore(package): include skills in published files`

不要这样写：

- `修复版本解析问题`
- `Update version resolver`
- `fix issues`
- `some improvements`
