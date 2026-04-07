# OpenClaw Team Memory Context

一个可公开分发的 OpenClaw 完整整理版，重点增强上下文治理、结构化记忆和多智能体团队协作。

它包含两层内容：

- 根目录：可直接安装和运行的 OpenClaw 主体包，保留上游 CLI 入口、dist、docs、assets 和 bundled skills。
- [workspace](workspace)：你的核心增强层，重点是上下文治理、结构化记忆、团队编排和可执行技能系统。

这个版本已经移除了任务、会话、日志、密钥、认证档案和其他私人运行态数据，适合直接作为公开仓库持续维护。

## 项目定位

这不是只展示几个核心文件的代码样例仓库，而是一个可以实际安装、初始化和运行的 OpenClaw 公开版。目标是让别人既能直接把项目跑起来，也能看见这套增强层真正解决了什么问题。

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

## 亮点

- 显式的上下文预算、压缩触发和会话交接机制
- 结构化记忆提取、路由、去重、验证和 TTL 分层
- 团队派工、任务状态持久化和多角色协作编排
- 可执行 skill 模板、工具 hook 和重试基础设施
- 不良人总谱风格的 Control UI 扩展和智能体身份体系

## 快速开始

要求：Node 22.12+，推荐 Node 24。

```bash
git clone git@github.com:cling0809/openclaw-team-memory-context.git
cd openclaw-team-memory-context
pnpm install

pnpm public:setup
pnpm public:onboard
pnpm public:gateway
# 新开一个终端查看 dashboard 地址
pnpm public:dashboard -- --no-open
```

说明：

- `public:setup` 会在仓库根目录下创建 `.openclaw-public/` 本地状态目录，并生成脱敏后的 `openclaw.json`。
- `public:onboard` 会自动带上本地状态目录、模板配置和本仓库的 `workspace/` 路径。
- `public:gateway` 会用同一套本地配置启动 Gateway。
- `public:dashboard` 会打印当前公开版实例的 dashboard URL。
- `public:token` 会打印当前公开版实例使用的 gateway token，便于首次连接 Control UI。

是否可以直接用：

- 可以，但前提是先安装依赖。
- 仓库已经包含可直接运行的 OpenClaw CLI 入口和预编译 `dist/`，不需要你先自己构建 TypeScript 输出。
- clone 下来后，按上面的步骤执行 `pnpm install`、`pnpm public:setup`，再进入 `pnpm public:onboard` 或 `pnpm public:gateway` 即可开始使用。
- 公开版初始化会自动补齐 `gateway.mode=local` 和本地 token 认证，避免不同机器上出现未配置网关或首次连接无法鉴权的问题。
- 本仓库默认把本地运行态写入 `.openclaw-public/`，不会污染版本库。

如果你只想直接体验 agent：

```bash
pnpm public:agent -- --message "hello"
```

## 不良人 UI 与身份

公开版现在已经包含你本地那套不良人主题控制台扩展，加载入口在 [dist/control-ui/index.html](dist/control-ui/index.html)，核心文件包括：

- [dist/control-ui/assets/teamTaskStore.js](dist/control-ui/assets/teamTaskStore.js): 不良人总谱状态仓、席位映射和 companion sprite 状态
- [dist/control-ui/assets/buli-team-panel.js](dist/control-ui/assets/buli-team-panel.js): 右侧不良人总谱面板、天罡 roster、驿报和案卷视图
- [dist/control-ui/assets/panel-layout-overrides.css](dist/control-ui/assets/panel-layout-overrides.css): 古风三栏布局、状态条和暗桩台视觉覆盖

公开模板里的智能体身份也已经切换为不良人设定，详细列表见 [AGENT_IDENTITIES.md](AGENT_IDENTITIES.md)。

如果你之前已经生成过本地 `.openclaw-public/openclaw.json`，想把 agent 身份一起刷新到新版模板，可执行：

```bash
pnpm public:setup -- --force
```

## 常见问题

### `gateway token mismatch` / `device token mismatch`

这类报错通常不是 Gateway 没起来，而是浏览器里的 Control UI 还保留着旧 token 或旧设备令牌。

推荐按这个顺序处理：

```bash
pnpm public:gateway
pnpm public:dashboard -- --no-open
pnpm public:token
```

- 打开 `public:dashboard` 打印出来的 URL。
- 如果 Control UI 要求认证，把 `public:token` 打印出的 token 粘贴到设置里。
- 如果仍然出现 `device token mismatch`，清掉 `127.0.0.1:18789` 或 `localhost:18789` 的站点数据后重开，或者直接用无痕窗口再试一次。
- 如果是旧版本仓库首次生成的 `.openclaw-public/openclaw.json`，现在的包装脚本会在下一次运行时自动补齐缺失的 `gateway.mode` 和 `gateway.auth.token`，不需要手工重建整个仓库。

## Showcase

### 暗色主题主界面

![OpenClaw dark home](docs/assets/showcase/openclaw-home-dark.png)

### 浅色主题主界面

![OpenClaw light home](docs/assets/showcase/openclaw-home-light.png)

### 团队派工与任务进展

![OpenClaw team spawn](docs/assets/showcase/openclaw-team-spawn.png)

### 分析报告视图

![OpenClaw analysis report](docs/assets/showcase/openclaw-analysis-report.png)

## 仓库结构

- [package.json](package.json): OpenClaw 包定义和公开版快捷脚本
- [openclaw.mjs](openclaw.mjs): CLI 启动入口
- [dist](dist): 预编译运行时代码
- [dist/control-ui/index.html](dist/control-ui/index.html): Control UI 入口，现已自动加载不良人面板扩展
- [docs](docs): 上游文档
- [skills](skills): bundled skills
- [workspace](workspace): 自定义增强层与公开版 workspace
- [templates/openclaw.public.template.json](templates/openclaw.public.template.json): 脱敏配置模板
- [scripts/setup-public-home.mjs](scripts/setup-public-home.mjs): 初始化本地状态目录
- [scripts/run-public.mjs](scripts/run-public.mjs): 公开版命令包装器
- [AGENT_IDENTITIES.md](AGENT_IDENTITIES.md): 默认公开版智能体身份与角色说明
- [UPSTREAM_COMPARISON.md](UPSTREAM_COMPARISON.md): 上游对比和改进总结
- [PUBLISHING.md](PUBLISHING.md): 发布到 GitHub 前的检查项

## 核心模块

核心增强在 [workspace](workspace) 下，重点包括：

- [workspace/contextTracker.js](workspace/contextTracker.js): 上下文预算和压缩触发
- [workspace/extractMemories.js](workspace/extractMemories.js): 结构化记忆提取与路由
- [workspace/memory](workspace/memory): 记忆模型、TTL 和 schema
- [workspace/src](workspace/src): store、task persistence、tool partition、skill engine 等基础设施
- [workspace/scripts](workspace/scripts): 编排状态存储与辅助运行时
- [workspace/team-orchestration](workspace/team-orchestration): 团队对象 schema 与状态持久化
- [workspace/skills](workspace/skills): 自定义 workflow skills

## 为什么这个仓库值得看

相对上游，最核心的价值不是“多了某一个点状功能”，而是把原本分散的能力推进成了更工程化的一层：

1. 上下文管理从经验式处理变成了显式预算和压缩治理。
2. 记忆从 Markdown 沉淀变成了结构化路由、去重、验证和 TTL 管理。
3. 多 agent 从简单分发变成了可恢复的团队编排状态机。
4. Skill 从静态文档变成了可执行模板与可观测基础设施。

更详细的表述见 [UPSTREAM_COMPARISON.md](UPSTREAM_COMPARISON.md)。

## 开源边界

这个仓库刻意没有包含任何私人运行态数据。日常使用时，新产生的本地状态会写入 `.openclaw-public/`，并且已经被 [.gitignore](.gitignore) 排除。

如果你继续在这个仓库上开发，建议把所有个人状态都留在 `.openclaw-public/` 下，不要写回仓库追踪文件。