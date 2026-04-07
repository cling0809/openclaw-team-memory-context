# OpenClaw Public Build

这是一个可公开分发的 OpenClaw 完整仓库整理版。

它包含两层内容：

- 根目录：可直接安装和运行的 OpenClaw 主体包，保留上游 CLI 入口、dist、docs、assets 和 bundled skills。
- [workspace](workspace)：你的核心增强层，重点是上下文治理、结构化记忆、团队编排和可执行技能系统。

这个版本已经移除了任务、会话、日志、密钥、认证档案和其他私人运行态数据，适合直接放到 GitHub 做开源仓库。

## 仓库目标

相比只导出一小撮核心模块，这个仓库现在的目标是让别人 clone 下来后可以真正把它跑起来，同时还能看到你的关键增强。

保留的公开能力：

- OpenClaw 可运行包本体
- 自定义 workspace 增强层
- 结构化记忆与团队工作流代码
- 脱敏模板配置与本地初始化脚本

排除的私人内容：

- 会话记录、任务记录、日志、交付历史
- API keys、auth profiles、设备绑定信息
- 每日记忆、恢复快照、运行期 active 状态
- 任何直接暴露你真实工作内容的痕迹

## 快速开始

要求：Node 22.12+，推荐 Node 24。

```bash
git clone git@github.com:cling0809/openclaw-team-memory-context.git
cd openclaw-team-memory-context
pnpm install

pnpm public:setup
pnpm public:onboard
pnpm public:gateway
```

说明：

- `public:setup` 会在仓库根目录下创建 `.openclaw-public/` 本地状态目录，并生成脱敏后的 `openclaw.json`。
- `public:onboard` 会自动带上本地状态目录、模板配置和本仓库的 `workspace/` 路径。
- `public:gateway` 会用同一套本地配置启动 Gateway。

如果你只想直接体验 agent：

```bash
pnpm public:agent -- --message "hello"
```

## 公开版目录

- [package.json](package.json): OpenClaw 包定义和公开版快捷脚本
- [openclaw.mjs](openclaw.mjs): CLI 启动入口
- [dist](dist): 预编译运行时代码
- [docs](docs): 上游文档
- [skills](skills): bundled skills
- [workspace](workspace): 自定义增强层与公开版 workspace
- [templates/openclaw.public.template.json](templates/openclaw.public.template.json): 脱敏配置模板
- [scripts/setup-public-home.mjs](scripts/setup-public-home.mjs): 初始化本地状态目录
- [scripts/run-public.mjs](scripts/run-public.mjs): 公开版命令包装器
- [UPSTREAM_COMPARISON.md](UPSTREAM_COMPARISON.md): 上游对比和改进总结
- [PUBLISHING.md](PUBLISHING.md): 发布到 GitHub 前的检查项

## 你的增强主要放在哪

核心增强在 [workspace](workspace) 下，重点包括：

- [workspace/contextTracker.js](workspace/contextTracker.js): 上下文预算和压缩触发
- [workspace/extractMemories.js](workspace/extractMemories.js): 结构化记忆提取与路由
- [workspace/memory](workspace/memory): 记忆模型、TTL 和 schema
- [workspace/src](workspace/src): store、task persistence、tool partition、skill engine 等基础设施
- [workspace/scripts](workspace/scripts): 编排状态存储与辅助运行时
- [workspace/team-orchestration](workspace/team-orchestration): 团队对象 schema 与状态持久化
- [workspace/skills](workspace/skills): 自定义 workflow skills

## 你的改动的核心价值

相对上游，最强的差异点不是“新增了某一个功能”，而是把原本分散的能力推进成了更工程化的系统：

1. 上下文管理从经验式处理变成了显式预算和压缩治理。
2. 记忆从 Markdown 沉淀变成了结构化路由、去重、验证和 TTL 管理。
3. 多 agent 从简单分发变成了可恢复的团队编排状态机。
4. Skill 从静态文档变成了可执行模板与可观测基础设施。

更详细的表述见 [UPSTREAM_COMPARISON.md](UPSTREAM_COMPARISON.md)。

## 关于私有数据

这个仓库刻意没有包含任何私人运行态数据。日常使用时，新产生的本地状态会写入 `.openclaw-public/`，并且已经被 [.gitignore](.gitignore) 排除。

如果你继续在这个仓库上开发，建议把所有个人状态都留在 `.openclaw-public/` 下，不要写回仓库追踪文件。