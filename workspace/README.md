# Public Workspace Layer

这里是公开版仓库里的自定义 workspace。

它承载的是你相对上游 OpenClaw 的核心增强，而不是私人运行态数据。可以把它理解成“公开版工作区模板 + 核心实现层”。

主要内容：

- `contextTracker.js`: 上下文预算估算和压缩触发
- `extractMemories.js`: 结构化记忆提取与路由
- `memory/`: MemoryRecord schema、TTL 和检索设计
- `src/`: store、task persistence、tool partition、skill engine 等基础设施
- `scripts/`: 团队编排与状态存储辅助模块
- `team-orchestration/`: 团队对象 schema 与状态管理
- `skills/`: 自定义技能和工作流规则

这层代码已经去掉了本机绝对路径、质量日志和明显的私人任务痕迹。

运行时产生的新状态默认应进入仓库根目录下的 `.openclaw-public/`，不要写回当前目录的追踪文件。