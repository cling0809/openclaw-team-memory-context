# Publishing Checklist

把这个仓库推到 GitHub 前，建议按下面顺序做最后检查。

## 1. 元数据

- 更新 [package.json](package.json) 里的 `repository`、`homepage`、`bugs` 字段。
- 如果你计划发布 npm 包，再决定是否保留包名 `openclaw`。

## 2. 私有数据检查

重点确认以下内容没有进入 git：

- `.openclaw-public/`
- 会话、任务、日志、记忆快照
- auth profiles、tokens、API keys
- 本机账号名、真实项目路径、私人工作内容

## 3. 最小可运行验证

```bash
pnpm install
pnpm public:setup
pnpm public:doctor
pnpm public:onboard
```

如果只想验证 CLI 包装层是否正常，至少跑到 `public:setup` 和 `public:doctor`。

## 4. 推送示例

```bash
git add .
git commit -m "Prepare sanitized public OpenClaw build"
git remote add origin git@github.com:cling0809/openclaw-team-memory-context.git
git push -u origin main
```

## 5. 对外介绍建议

推荐强调：

- 基于 OpenClaw 上游能力做了工程化深化
- 核心增强在 context governance、memory routing、team orchestration
- 仓库不包含任何私人运行态数据

不建议强调：

- “完全替代上游”
- “与上游无关”
- “上游原本没有 memory / multi-agent”