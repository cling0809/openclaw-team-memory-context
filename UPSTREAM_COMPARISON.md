# 上游对比与改进总结

这份总结的定位不是声称“上游没有这些能力”，而是明确说明：上游 OpenClaw 已经有 memory、多 agent 和 session 工具，但这里把它们推进成了更结构化、更可恢复、更适合复杂工程协作的一层。

## 总体判断

上游 OpenClaw 的强项在于平台广度：多入口、多模型、多会话、多插件。

这个导出层的强项在于工程化深度：

- 更明确的上下文治理
- 更结构化的记忆模型
- 更显式的团队协作状态机
- 更像基础设施而不是脚本拼接

## 模块级对比

| 领域 | 上游基线 | 这份导出层的增强 | 实际价值 |
|------|---------|------------------|----------|
| 上下文管理 | 主要依赖会话上下文、技能说明和人工控制 | contextTracker.js 显式估算 budget、定义分层压缩和 handoff | 长会话更稳定，减少“快溢出才救火” |
| 长期记忆 | MEMORY.md + daily memory + memory 搜索 | MemoryRecord schema、routing-rules、cursor、防重、verificationState、TTL/promotion/demotion | 记忆从“记笔记”变成“可路由的数据系统” |
| 记忆执行层 | 记忆提取偏向直接写入 | extractMemories.js v2 把 transcript 转成候选记录并分流到 profile/project/episodic/semantic/procedural/recovery | 可以精确控制哪些信息该沉淀到哪里 |
| 短中长期衰减 | 上游长期/每日记忆偏静态 | MemoryManager.ts 提供 short/work/long 三层抽象与过期衰减 | 既能保留连续性，也能避免长期污染 |
| 团队协作 | 上游已有 session spawn/send/list 等多 agent 能力 | TEAM_OBJECT_SCHEMA.js、teamObjectStore.js、teamTaskStore.js 把团队、子任务、状态回传和超时兜底持久化 | 从“能派工”提升到“能编排、能恢复、能追责” |
| 状态基础设施 | 会话与工具能力分散 | observable-store.ts、store-choke.ts、task-registry-persist.ts、session-store-index.ts | 更容易做统一观察、检查点恢复和索引加速 |
| Skill 系统 | 以 Markdown 技能和调用约定为主 | skill-engine.ts 支持条件、循环、变量、include、工具执行 | 技能从提示词文档升级为可执行模板 |
| 可靠性机制 | 以单点工具调用为主 | withRetry.ts、tool-hooks.ts、tool-partition.ts | 并发安全、错误恢复、插桩扩展能力更强 |

## 你这套代码最值得对外强调的点

如果要对外介绍“创新点”，建议重点讲下面四条，而不是泛泛地说“我做了很多增强”：

1. 记忆从文档沉淀升级为结构化路由系统。
2. 多 agent 从会话分发升级为显式团队编排状态机。
3. 上下文管理从经验式处理升级为可估算、可触发、可交接的治理层。
4. Skill 从静态说明升级为可执行模板与可观测基础设施。

## 对外表述建议

更稳妥的表述：

- “Built on top of OpenClaw's session and memory primitives.”
- “Adds structured memory routing, explicit team orchestration, and context governance.”
- “Focuses on engineering depth rather than broad platform surface.”

不建议的表述：

- “OpenClaw originally had no memory system.”
- “This replaces the upstream architecture entirely.”
- “Everything here is wholly independent from upstream.”

因为从代码事实看，你的工作更像是对上游能力的系统化深化，而不是完全另起炉灶。