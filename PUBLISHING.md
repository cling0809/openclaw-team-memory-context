# Publishing Checklist

把这个仓库推到 GitHub 前，建议按下面顺序做最后检查。

## 1. 元数据

- 更新 [package.json](package.json) 里的 `repository`、`homepage`、`bugs` 字段。
- 如果你计划发布 npm 包，再决定是否保留包名 `openclaw`。

## 2. 私有数据检查

先跑自动审计，不要只靠肉眼：

```bash
pnpm public:audit
pnpm public:audit:strict
```

说明：

- `public:audit` 会扫描整个工作树，不要求文件已经 `git add`。
- `public:audit:strict` 会额外检查 `dist/` 里的文本产物，适合正式推送前最后一轮把关。
- 如果某个预编译上游 bundle 含有已确认的第三方公开常量，必须只用“精确文件 + 精确字面量”的窄白名单放行，不能做整类忽略。

重点确认以下内容没有进入 git：

- `.openclaw-public/`
- 会话、任务、日志、记忆快照
- auth profiles、tokens、API keys
- 本机账号名、真实项目路径、私人工作内容

## 3. 最小可运行验证

```bash
pnpm install
pnpm public:entrypoints
pnpm public:smoke
pnpm pack --dry-run
pnpm public:setup
pnpm public:doctor
pnpm public:onboard
```

如果只想验证 CLI 包装层是否正常，至少跑到 `pnpm public:entrypoints`、`pnpm pack --dry-run`、`public:setup` 和 `public:doctor`。

## 4. 推送示例

```bash
git checkout -b codex/public-sanitized-release
git add .
git commit -m "Prepare sanitized public OpenClaw build"
git push -u origin codex/public-sanitized-release
```

建议先推分支，再从 GitHub 上检查文件列表、README 展示和 release assets，确认没有误收私人内容后再合并到 `main`。

## 5. 对外介绍建议

推荐强调：

- 基于 OpenClaw 上游能力做了工程化深化
- 核心增强在 context governance、memory routing、team orchestration
- 仓库不包含任何私人运行态数据

不建议强调：

- “完全替代上游”
- “与上游无关”
- “上游原本没有 memory / multi-agent”
