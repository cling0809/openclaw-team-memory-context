---
name: memory-keeper
version: 1.1.0
updated: 2026-04-04
description: 维护 MEMORY.md、每日记忆和经验沉淀，让小龙虾跨会话更连贯、更少重复问同样的问题。支持分层存储、写入审核、防抖、配置锁定和记忆提取。
---

# Memory Keeper

> 记忆不是把所有东西都存起来，而是把以后真的还会用到的东西留下来。

## 适用场景

- 用户明确说“记一下”“以后都这样”
- 做完任务后出现了可复用的方法、坑点、结论
- 配置、路径、工具、工作流已经被确认
- 长会话快结束了，需要把经验沉淀到长期存储
- 跨会话任务需要保持连续性，避免下一次又从头解释

---

## 核心目标

`memory-keeper` 负责 4 件事：

1. **判断值不值得记**
2. **决定记到哪一层**
3. **把一次性经验提炼成长期可复用知识**
4. **让后续会话能真正读得回来、用得上**

---

## 记忆分层

### Tier 1 — `MEMORY.md`

位置：
`$OPENCLAW_WORKSPACE/MEMORY.md`

适合写入：

- 长期有效的用户偏好
- 项目级关键结论
- 稳定的工具路径和环境事实
- 已确认的工作流和规则
- 高价值坑点和修法

特点：

- 生命周期最长
- 检索优先级最高
- 写入必须最克制

### Tier 2 — 每日日志

位置：
`$OPENCLAW_WORKSPACE/memory/YYYY-MM-DD.md`

适合写入：

- 今天做了什么
- 尝试了哪些方案
- 暂时性的结论或阻塞
- 需要明天继续推进的内容

特点：

- 用来保留“近期上下文”
- 可在 1 到 7 天后提炼进 `MEMORY.md`
- 允许信息更细，但仍要去噪

### Tier 3 — 临时防抖缓存

位置：
- 运行时内部状态
- 不直接暴露给用户

适合放：

- 一天内反复出现但还没到值得沉淀的事实
- 尚未被确认的偏好
- 需要二次验证的经验

特点：

- 先观察，不立刻写长期记忆
- 防止“一句话就被永久记住”

---

## 写入审核层（Choke Point）

任何记忆写入前，都先过这 4 个问题：

1. 这条信息 3 天后还可能有用吗？
2. 用户或小龙下次真的会想找回它吗？
3. 这是不是已经在代码、文档或配置里稳定存在了？
4. 写进去会让检索更清晰，还是更嘈杂？

判断规则：

- 4 个里至少 3 个答案是“是”，才考虑写 `MEMORY.md`
- 如果只有短期价值，就写到每日记忆
- 如果只是情绪、寒暄、一次性路径、未确认猜测，就不要写

---

## 应该记住的内容

- 用户明确确认过的偏好
- 已验证有效的解决方案
- 重复出现的稳定工作流
- 本机环境中的特殊事实
- 项目的关键边界、约束、决策
- 失败后总结出的教训

## 不应该记住的内容

- 敏感密钥全文
- 随口一提的偏好
- 还没验证的猜测
- 可以直接从代码或配置重新推导出的事实
- 冗长工具输出原文
- 单纯寒暄和情绪表达

---

## 防抖策略

不要因为用户提了一次，就立刻永久写入。

### 立即写入

- 明确的用户指令：`记一下`
- 明确的长期偏好：`以后都用中文`
- 已经验证的关键修法
- 高价值项目决策

### 延迟观察

以下内容先进入防抖观察，而不是立即写长期记忆：

- 模糊偏好
- 临时工作方式
- 一天内只出现一次的小结论

建议阈值：

- 同一事实在较长时间跨度内重复出现 2 到 3 次
- 或者它影响了多个任务
- 再升级为长期记忆

---

## Latch 机制

一些事实一旦确认，后续默认视为“锁定”，直到出现明确反证。

适合 Latch 的内容：

- 默认模型或主要工作模型
- 默认 shell / 工具路径
- 默认沟通语言
- 复杂任务默认分工方式
- 明确的审批或安全偏好

推翻条件：

- 用户明确说“改了”
- 系统检测到旧配置失效
- 新配置连续稳定出现，不像临时状态

---

## 提取流程

`memory-keeper` 的理想流程是：

```text
对话发生
  -> 识别候选记忆
  -> 通过 choke point 审核
  -> 决定写入层级
  -> 写入每日记忆或 MEMORY.md
  -> 更新索引与后续检索可见性
```

### v2.0 路由架构

**extractMemories.js v2.0** 改造后，路由层替代了旧的直接写入逻辑：

```
transcript
  -> identifyMemoryCandidates()   // 候选识别
  -> buildMemoryRecord()           // 转为 MemoryRecord 结构
  -> checkDeduplication(record)   // 三级查重（L1:id / L2:titleHash / L3:source+summary）
  -> routeRecord(record)          // 按 routing-rules 路由到正确落点
  -> updateCursor()               // 写入 .memory_cursor（跨 session 持久化）
```

**落点路由表**（详见 `memory/schema/routing-rules.md`）：

| scope | 落点 | 初始验证状态 |
|-------|------|------------|
| profile | MEMORY.md Profile 区块 | verified（需 confidence ≥ 0.85） |
| project | memory/projects/<id>.md | pending（需 task 绑定） |
| episodic | memory/YYYY-MM-DD.md | **pending**（默认） |
| semantic | memory/cards/<id>.md | pending（需一次复用验证） |
| procedural | memory/procedures/<id>.md | pending（稳定后进 skill） |
| recovery | memory/recovery/current-recovery.json | verified（系统直接写入） |

**重要约束**：
- episodic 默认 `pending`，不是直接 `verified`
- profile **不直接写 MEMORY.md**，除非 verificationState === 'verified'
- 新增 `schemaVersion: "1.0.0"` 字段，兼容未来迁移

## Every Session 启动

每次会话启动时，按以下顺序执行记忆初始化：

**Step 1：读取 Cursor（跳过已处理消息）**

读取 `~/.openclaw/workspace/.memory_cursor`：
```js
const cursor = JSON.parse(fs.readFileSync('.memory_cursor', 'utf8'));
// cursor.lastMemoryMessageUuid 之前的消息已处理，跳过
```

**Step 2：组装当前会话记忆包**

调用 `buildMemoryRetrievalBundle(sessionKey)` 组装当前会话可用的所有记忆：
```js
/**
 * buildMemoryRetrievalBundle — 组装当前会话记忆包
 * @param {string} sessionKey
 * @returns {Object} 包含 profile/episodic/semantic/procedural 四个分区的记忆集合
 */
function buildMemoryRetrievalBundle(sessionKey) {
  return {
    profile:    readMemoryProfile(),       // MEMORY.md Profile 区块
    episodic:   readRecentEpisodic(7),     // 7 天内 daily md
    semantic:   readSemanticCards(),       // 所有 semantic cards
    procedural: readProcedures(),          // 所有 procedural
    recovery:   readCurrentRecovery(),     // 当前 recovery JSON
  };
}
```

**Step 3：检索策略**

- profile 记忆：**始终**注入上下文（无条件）
- episodic 记忆：注入最近 7 天相关记忆
- semantic 记忆：基于当前任务主题检索（title/summary 命中）
- procedural 记忆：基于当前任务类型检索（tags 命中）
- recovery 记忆：compact 后立即可用，启动会话时优先读取

当前已接入的相关能力：

- 运行时命令：`/memories extract`
- 底层模块：`extractMemories.js`

也就是说，`memory-keeper` 现在不只是原则说明，它已经对应到真实的记忆提取模块。

---

## 和记忆提取模块的关系

`extractMemories.js` 负责：

- 扫描最近消息
- 识别值得记住的候选
- 做 cursor 防重
- 写入每日记忆
- 更新 `MEMORY.md`

`memory-keeper` 负责：

- 告诉系统“什么值得提取”
- 定义分层和审核策略
- 约束写入边界
- 避免垃圾记忆进入长期索引

换句话说：

- `extractMemories.js` 是执行器
- `memory-keeper` 是策略层

---

## 和记能自改进的关系

技能改进系统会往各个 skill 的 `quality_notes` 写入观察结果。

`memory-keeper` 应该把以下内容视为“可能值得沉淀”的候选：

- 反复出现的失败模式
- 稳定有效的协作模式
- 新发现的需求类型
- 明确的流程改进建议

但注意：

- `quality_notes` 不应该原文整段塞进 `MEMORY.md`
- 必须先提炼成“以后会复用的规则或教训”

---

## 输出规范

当你决定写入记忆时，优先用下面这种短格式：

```text
类型：用户偏好 / 项目决策 / 工具事实 / 教训 / 工作流
主题：一句话主题
内容：只保留以后真正会回看的信息
来源：本次对话 / 代码 / 配置 / 验证结果
日期：YYYY-MM-DD
```

示例：

```text
[用户偏好] 回复风格 | 先给结论再给细节 | 本次对话 | 2026-04-03
[工具事实] OpenClaw 工作目录 | $OPENCLAW_WORKSPACE | 环境配置 | 2026-04-03
[教训] Codex CLI | 长静默任务不能用 30s watchdog，否则会误杀 | 运行验证 | 2026-04-03
```

---

## 协作原则

- 不要把 `MEMORY.md` 当聊天记录副本
- 不要把一次性会话噪声升级成长期知识
- 记忆写入要比普通回复更保守
- 一旦写入，要尽量结构化、可检索、可复用
- 长期记忆宁少勿杂

---

## 快速清单

遇到一条“似乎值得记”的信息时，按这个顺序判断：

- 这是长期有价值，还是短期上下文？
- 这是确认过的事实，还是还在变化？
- 以后会复用，还是只此一次？
- 写进去会更清楚，还是更吵？

只有答案足够明确时，才真正写入长期记忆。

---

# MemoryManager — 三层记忆 TTL 衰减系统（v2.0）

> **背景**：2026-04-05 升级，原 memory-keeper 策略层保持不变，新增 MemoryManager 执行层，
> 提供三层抽象 + TTL 衰减机制，补齐"分层但不过期"的短板。

## 三层记忆架构

| 层 | 目录 | TTL | 典型内容 | 晋升路径 |
|----|------|-----|---------|---------|
| 短期 (short) | memory/short/ | 24h | 原始会话流水、临时结论 | short -> work (promote) |
| 工作 (work)  | memory/work/  | 7d  | 提炼的关键信息、待确认偏好 | work -> long (promote) |
| 长期 (long)  | memory/*.md / MEMORY.md | 永久 | 精选沉淀、用户偏好、坑点修法 | — |

## 文件格式

所有记忆文件使用 YAML front-matter + body 格式。content 永远在 front-matter 之后，
这样内容包含 `---` 不会破坏解析。

## MemoryManager API

```js
const { MemoryManager } = require('./memory/MemoryManager.js');
const m = new MemoryManager(workspaceDir);

await m.add({ scope: 'short', title: '...', content: '...' });
await m.search({ query: '关键词', scope: 'short' });
await m.promote(recordId, 'work');   // short -> work
await m.decay({ dryRun: false });   // 删除过期文件
await m.getStats();
```

## TTL 衰减（decay）

- 短期（short）：24h 后自动过期
- 工作（work）：7d 后自动过期
- 长期（long）：无 TTL

```bash
# 完整扫描 + 删除
node memory/decay.js --workspace=$OPENCLAW_WORKSPACE

# 只报告，不删除
node memory/decay.js --dry-run --verbose

# 只清理 short 层
node memory/decay.js --scope=short
```

建议每天运行一次（cron 或 launchd）。

## 与现有系统共存

- 原有 extractMemories.js 继续正常工作
- MemoryManager 只处理新的 TTL 层（short/ 和 work/）
- 原有 episodic/semantic/procedural 路径不变

## 文件列表

```
memory/
├── MemoryManager.ts    # TypeScript 源码（类型完整）
├── MemoryManager.js    # 直接可运行的 JS 版本
├── decay.ts           # TypeScript 后台清理脚本
├── decay.js           # 直接可运行的 JS 版本
├── short/             # 短期记忆（24h TTL）
└── work/              # 工作记忆（7d TTL）
```

*v2.0 — 2026-04-05 core enhancement snapshot*
