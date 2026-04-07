---
name: context-management
version: 1.0.0
updated: 2026-04-03
description: 管理上下文预算、压缩触发器和会话交接规则，避免长对话丢失关键状态。
---

# Context Management Skill

_系统上下文管理：防止溢出、保留关键、沉淀知识_

## 设计哲学

本技能的设计参考了 Claude Code 的对话压缩（Conversation Compaction）系统思想：

1. **保守压缩**：宁可少删，不可错删。关键决策、用户偏好、任务状态一旦丢失代价极高。
2. **层次分明**：不是把所有东西一视同仁压缩，而是按价值分层处理。
3. **可逆性优先**：压缩后的信息应该能通过摘要还原核心语义，而非彻底丢失。
4. **预防为主**：在接近上下文限制之前就采取行动，而不是等溢出了再救火。

---

## 1. 上下文分层标准

### Tier 1 — Must-Retain（必须保留）

**永不压缩、永不丢弃的内容。**

| 内容类型 | 保留理由 | 典型例子 |
|----------|----------|----------|
| 用户身份与偏好 | 重新学习成本极高，且影响后续所有交互 | `USER.md` 中的姓名、时区、语言偏好 |
| 当前任务的约束与决策 | 丢失会导致任务回滚或重复劳动 | 技术选型结论、API 边界条件、不可逆操作的确认 |
| 长期目标与项目背景 | 用户不会每次重复说 | 项目目的、团队结构、技术栈 |
| 已验证的 bug 根因 | 调试代价极高 | "这个问题是 Apple Silicon 的 GCC 兼容性问题" |
| 安全或隐私相关的上下文 | 泄露风险或合规要求 | 凭据位置、脱敏规则、访问边界 |

**判断标准**：如果这段信息丢失了，用户需要花超过 2 分钟重新解释或重新推理，则必须保留。

### Tier 2 — Compressible（可压缩）

**有价值的上下文，但可以通过摘要或精简格式保留。**

| 内容类型 | 压缩方式 | 压缩后保留什么 |
|----------|----------|----------------|
| 冗长的调试过程 | 保留结论 + 关键步骤 | "复现步骤：[步骤1-3]，最终用方案X解决" |
| 搜索/调研过程 | 保留来源 + 结论，丢弃中间页面内容 | "来源：AWS 官方文档 + StackOverflow，结论：推荐方案Y" |
| 代码 diff 大面积变更 | 保留变更意图，丢弃逐行 diff | "重构了认证层：从 session 迁移到 JWT，修改了 12 个文件" |
| 多轮澄清对话 | 合并为单一需求描述 | 将 5 轮 "你想要 A 还是 B" 压缩为 "用户确认需求为 X" |
| 工具输出（大量结果） | 保留摘要，丢弃完整 raw output | "搜索返回 50 条结果，关键匹配：foo, bar；其余略" |

**压缩原则**：将信息转化为"结论 + 索引"形式，而非彻底丢弃。

### Tier 3 — Discardable（可丢弃）

**可以毫不犹豫删除的内容。**

- 工具调用失败的重试记录（成功后只保留最终成功结果）
- 礼貌性/确认性对话："好的，我来帮你处理"
- 已过期的临时状态（如某个已被用户取消的任务步骤）
- 完全无关的岔题内容
- 重复出现的同质信息（用户说了两次相同的话）

---

## 2. 压缩触发条件

### 触发条件清单

使用 **OR** 逻辑：满足任一条件即触发压缩评估。

```
触发条件（任一满足即触发）：

[A] Token 阈值类
  ☐ 当前上下文超过 60% token 限制 → 轻度压缩（Tier 2）
  ☐ 当前上下文超过 80% token 限制 → 重度压缩（Tier 1 保护 + Tier 2 压缩）
  ☐ 当前上下文超过 90% token 限制 → 紧急压缩（仅保留 Tier 1 + 核心任务状态）

[B] 对话轮次类
  ☐ 单会话超过 30 轮对话 → 触发摘要压缩
  ☐ 单会话超过 50 轮对话 → 触发深度压缩

[C] 任务阶段类
  ☐ 任务从「探索阶段」进入「实现阶段」→ 丢弃探索阶段的探索性细节
  ☐ 任务完成，进入「收尾阶段」→ 压缩实现细节，保留最终结论
  ☐ 用户明确开始新任务 → 触发完整上下文重置评估

[D] 内容质量类
  ☐ 发现 Tier 3 内容占比超过 40% → 触发清理
  ☐ 上下文中有大段连续工具输出未被引用 → 触发精简
```

### 触发后行动模板

```
【压缩评估流程】

Step 1: 估算当前 token 使用量（如果无法精确估算，用对话轮次代替）
Step 2: 对照触发条件，判断压缩紧急程度（轻度/重度/紧急）
Step 3: 确认 Tier 1 内容（必须保护项）
Step 4: 选择压缩策略（见第 3 节）
Step 5: 执行压缩，更新上下文标记
Step 6: 验证压缩后上下文仍包含任务连续性所需的最小信息
```

---

## 3. 压缩算法

### 核心原则：Summary-First（摘要优先）

**不要逐段删除，而是用摘要替换。**

原始格式：
```
[大段原始内容] → [摘要 + 索引引用]
```

### 压缩操作清单

#### 3.1 大段工具输出压缩

**适用场景**：搜索结果、文件列表、API 返回等大段原始输出

**操作步骤**：
1. 识别输出中被后续对话引用到的关键信息
2. 将大段输出替换为：
   ```
   [工具输出摘要]
   - 来源：[工具名称]
   - 关键结果：[1-3 条关键信息]
   - 详情参考：[如需可重新获取的标注]
   ```
3. 保留完整的、不可重现的输出（如经过复杂计算的结果）

#### 3.2 多轮澄清压缩

**适用场景**：用户需求不明确时的多轮问答

**操作步骤**：
1. 提取最终确认的需求
2. 提取关键约束和边界条件
3. 丢弃中间所有试探性对话
4. 合并为：
   ```
   [需求摘要]
   目标：[最终确认的目标]
   约束：[约束条件列表]
   已排除：[明确排除的选项]
   ```

#### 3.3 代码 diff 压缩

**适用场景**：大量文件变更的描述

**操作步骤**：
1. 保留变更的文件列表
2. 保留变更意图和方向
3. 丢弃逐行 diff
4. 合并为：
   ```
   [变更摘要]
   涉及文件：[文件列表]
   变更类型：[重构/新增/删除/迁移]
   主要变更：[1-2 句核心描述]
   破坏性变更：[列出可能影响其他部分的内容]
   ```

#### 3.4 调试过程压缩

**适用场景**：长串调试尝试（尝试 → 失败 → 尝试 → 失败 → 成功）

**操作步骤**：
1. 保留最终成功方案
2. 保留关键失败教训（如果对后续有影响）
3. 丢弃中间所有失败的尝试路径
4. 合并为：
   ```
   [调试摘要]
   根因：[最终确定的根本原因]
   解决方方：[解决方案]
   关键教训：[如果有的话，1句话]
   ```

### 压缩质量检查清单

压缩完成后，逐项确认：

```
☐ 压缩后的上下文仍然能回答"这个任务的目标是什么"
☐ 压缩后的上下文仍然包含所有已做的重要决策
☐ 压缩后的上下文仍然包含用户提供的关键约束
☐ 没有任何 Tier 1 内容在压缩中丢失
☐ 任务连续性没有明显断层
```

---

## 4. 长期记忆 vs 短期上下文

### 沉淀到 MEMORY.md 的标准

**满足以下任一条件时，将信息写入 `MEMORY.md` 或 `memory/YYYY-MM-DD.md`**：

| 条件 | 写入位置 | 内容格式 |
|------|----------|----------|
| 用户明确提供了自己的偏好/习惯 | `MEMORY.md` | `用户偏好：[具体内容]` |
| 项目中做出了技术决策且该决策可能影响后续 | `memory/项目名.md` | `技术决策：[决策内容]，理由：[理由]` |
| 发现了一个重要的系统性问题或 bug | `MEMORY.md` | `已知问题：[问题描述]，状态：[未解决/已解决/workaround]` |
| 用户的身份信息（姓名、时区等） | `USER.md` | 更新 USER.md |
| 完成了重要的阶段性里程碑 | `memory/YYYY-MM-DD.md` | `里程碑：[描述]，产出：[产出列表]` |
| 获得了外部知识且该知识可能对用户有价值 | `MEMORY.md` | `知识：[主题]：[摘要]` |

### 留在对话上下文的内容

以下内容**不应该**写入 MEMORY.md，保留在对话上下文中：

- 当前任务的中间状态和步骤
- 尚未确认的用户意图（仍处于澄清阶段）
- 临时的、一次性的查询结果
- 工具调用的中间过程（成功后）

### MEMORY.md 写入操作模板

```
格式：[类别] 主题 | 内容 | 来源 | 日期

示例：
[偏好] 代码风格 | 用户偏好使用 if err != nil 提前返回 | 本次对话 | 2026-04-03
[决策] 认证方案 | 选用 JWT而非 session，原因是无状态扩展 | 本次对话 | 2026-04-03
[知识] macOS 调试 | Docker Desktop 在 Apple Silicon 上存在已知网络bug | AWS论坛 | 2026-04-03
```

---

## 5. 跨会话上下文连续性

### 核心原则：Session-Start Checklist

每次新会话开始时，按以下顺序确认上下文：

```
【新会话启动清单】

Step 1: 读取 MEMORY.md（如果存在）
  ☐ 是否有与当前任务相关的用户偏好？
  ☐ 是否有未完成的历史任务？
  ☐ 是否有已知的技术约束或 bug？

Step 2: 读取 memory/ 最近 7 天（如果存在）
  ☐ 是否有与当前任务相关的近期决策？
  ☐ 是否有未完成的任务遗留？

Step 3: 读取 USER.md
  ☐ 用户身份信息是否完整？

Step 4: 读取 SOUL.md / AGENTS.md（首次或需要时）
  ☐ 确认当前角色定义

Step 5: 用户确认（如果上下文存在断档）
  向用户确认："上次我们讨论到XXX，是否需要我先回顾一下上下文？"
```

### 跨会话信息传递策略

当需要将长任务状态传递给下一会话时，使用 **Session Handoff Note**：

```
格式：
---
【会话交接备忘录】创建于 YYYY-MM-DD HH:MM
任务：[任务名称/描述]
当前状态：[阶段 + 关键进展]
最后动作：[刚刚完成或正在进行的动作]
下一步：[待用户确认或自动继续]
关键上下文：[Tier 1 内容摘要]
遗留问题：[如果有的话]
---
```

这份备忘录应写入 `memory/YYYY-MM-DD.md`，并在新会话开始时优先读取。

### 多任务并发时的上下文隔离

当用户同时进行多个任务线时：

```
策略：为每条任务线维护独立的上下文标记

格式：
[TASK-A] ...（任务A相关内容）
[TASK-B] ...（任务B相关内容）

压缩时：
  - 同一任务线内的压缩要保守（保持任务连续性）
  - 不同任务线之间，可以更激进地丢弃已完成任务线的细节
  - 明确完成的任务线可以完全压缩为"结论备忘录"
```

---

## 6. 上下文溢出预防

### 预防为主：日常维护习惯

```
【日常预防清单】

☐ 每完成一个工具调用，检查输出是否被完整使用，未使用的输出立即摘要
☐ 每完成一个任务阶段（探索→实现→验证），触发一次阶段压缩
☐ 发现 Tier 3 内容超过 3 段时，立即清理
☐ 对话超过 20 轮时，主动评估是否需要压缩
☐ 写入 MEMORY.md 的时机：一旦确认，立即写入，不等待会话结束
```

### 溢出前的紧急处理流程

当检测到即将接近 token 限制但还有重要工作时：

```
【紧急压缩流程】

触发条件：上下文超过 85% 且仍有工作要进行

Step 1（30秒内完成）:
  立即将当前任务状态写入 Session Handoff Note（见上文格式）
  写入位置：memory/YYYY-MM-DD.md

Step 2（2分钟内完成）:
  紧急压缩 Tier 2 内容，保留所有 Tier 1
  优先压缩：调试历史 > 工具输出 > 澄清对话

Step 3:
  向用户说明情况："上下文即将达到限制，我已经保存了任务状态。
  接下来我会重新读取上下文继续工作。"

Step 4:
  如果可能，在压缩后的上下文中保留：
  - 当前任务的目标
  - 最后一次工具调用的输入/输出
  - 下一步待确认的具体问题
```

### 预防性压缩触发器（早期预警）

不要等到 80% 才行动。以下是**早期干预**的触发条件：

```
上下文超过 50% 且满足以下任一条件时，开始轻度预防性压缩：
  ☐ 接下来有明确的复杂任务要进行（如重构、多文件修改）
  ☐ 用户要求处理的是一个新话题（意味着后续还会有新上下文）
  ☐ 当前任务包含大量工具调用（工具输出会快速积累）

预防性压缩原则：
  - 只压缩明确的 Tier 3
  - 不要为了"腾空间"而压缩有价值的内容
  - 压缩后明确告诉用户："已清理旧上下文，当前任务不受影响"
```

---

## 7. Claude Code 对话压缩设计哲学（参考）

以下是从 Claude Code 公开设计文档中提取的核心思想，用于指导本技能的实践：

### 7.1 增量压缩 vs 整体压缩

Claude Code 采用**增量压缩**而非整体压缩：
- 不是等到上下文满了再一次性压缩
- 而是在对话过程中持续识别和压缩可压缩内容
- **本技能采用相同策略**：以"日常预防"为主，而非"紧急救火"

### 7.2 语义压缩 vs 截断

Claude Code 的压缩是**语义压缩**：
- 不是简单地截断前 N 条消息
- 而是对每条消息进行价值评估，保留高价值内容
- **本技能采用 Tier 框架**：确保 Tier 1 永不丢失，Tier 2 转为摘要，Tier 3 丢弃

### 7.3 压缩可逆性

Claude Code 保证压缩后的信息仍可被理解和延续：
- 压缩不是删除，而是用更少的 token 表达相同的语义
- **本技能采用 Summary-First 算法**：用"结论+索引"替代原始内容

### 7.4 任务状态优先

Claude Code 在压缩时优先保护当前任务的连续性：
- 已完成的任务细节可以丢弃
- 当前任务的状态必须完整保留
- **本技能采用 Task-Aware 压缩**：按任务线分别处理，完成的任务线可大胆压缩

---

## 8. 完整操作流程速查

### 压缩操作完整流程

```
[检测到触发条件]
      ↓
[判断压缩紧急程度：轻度/重度/紧急]
      ↓
[列出 Tier 1 内容（必须保护）]
      ↓
[对 Tier 2 内容应用压缩算法]
      ↓
[丢弃所有 Tier 3 内容]
      ↓
[执行压缩质量检查]
      ↓
[更新上下文（内存中的上下文描述）]
      ↓
[如需要，同步更新 MEMORY.md]
```

### Session Handoff 完整流程

```
[当前会话即将结束，还有未完成的工作]
      ↓
[创建 Session Handoff Note]
      ↓
[写入 memory/YYYY-MM-DD.md]
      ↓
[确认下一会话需要读取该文件]
      ↓
[当前会话正常结束]
```

### 新会话启动完整流程

```
[新会话开始]
      ↓
[读取 MEMORY.md]
      ↓
[读取 memory/ 最近 7 天]
      ↓
[读取 USER.md]
      ↓
[检查是否有 Session Handoff Note]
      ↓
[如有，向用户确认是否需要恢复上下文]
      ↓
[开始工作]
```

---

## 9. 常见场景处理对照

| 场景 | 正确操作 |
|------|----------|
| 用户发了一个 500 行的日志文件 | 读取关键行，压缩为"ERROR 在第 X 行，原因是 Y"，原始日志不保留 |
| 搜索返回 100 条结果 | 保留前 10 条关键匹配 + 结论摘要，其余丢弃 |
| 用户让我等一下（长时间停顿） | 压缩当前任务状态为 Session Handoff Note，释放上下文 |
| 调试了 10 轮终于找到 bug | 保留根因和方案，丢弃 9 轮失败尝试的中间过程 |
| 用户切换到完全不相关的任务 | 评估旧任务是否需要 Session Handoff Note，然后开始新任务上下文 |
| 发现之前写入 MEMORY.md 的信息有误 | 立即更新 MEMORY.md，并在下一条消息中告知用户修正内容 |
| 工具调用超时/失败后成功重试 | 只保留最终成功结果，失败记录丢弃 |

---

## 10. 实践检查清单

### 每次压缩前

```
☐ 确认 Tier 1 内容完整
☐ 确认压缩目标（精简多少？为什么？）
☐ 确认压缩后的上下文能回答当前任务的核心问题
```

### 每次压缩后

```
☐ 上下文仍然连贯吗？
☐ 用户的原始需求是否仍然清晰？
☐ 重要的技术决策是否仍然可查？
☐ 是否有任何"我刚才还记得这个"的信息消失了？（如有，立即回滚）
```

### 每天结束时（如有未完成任务）

```
☐ 创建 Session Handoff Note
☐ 写入正确的 memory/YYYY-MM-DD.md
☐ 检查 MEMORY.md 是否有需要更新的内容
```

### 每周定期

```
☐ 检查 memory/ 目录，清理已过期的临时记录
☐ 检查 MEMORY.md，合并重复条目
☐ 检查是否有长期任务需要创建独立的 memory/项目.md
```

---

## 附：可运行的 contextTracker.js 模块

> 以下代码可直接保存为 `$OPENCLAW_WORKSPACE/contextTracker.js` 并在 OpenClaw workspace 中使用。

```javascript
/**
 * contextTracker.js — 小龙虾上下文追踪器
 * 参照 Claude Code 的 context.ts + compact.ts 设计
 * 
 * Claude Code 关键发现：
 * - System prompt: 4200 tokens（固定）
 * - MEMORY.md: 前200行或25KB（取较小者）≈ 680 tokens
 * - Skill descriptions: ~450 tokens（只有一行描述，不加载正文）
 * - MCP tools: ~120 tokens（deferred，按需加载）
 * - Project CLAUDE.md: ~1800 tokens
 */

const CONTEXT_BUDGET = {
  SYSTEM_PROMPT: 4200,
  MEMORY_MD: 680,
  MCP_TOOLS: 120,
  SKILL_DESCRIPTIONS: 450,
  PROJECT_CLAUDE: 1800,
  ENVIRONMENT_INFO: 280,
  RESERVED_OUTPUT: 2000,  // 预留输出空间
};

// 压缩触发阈值
const TRIGGERS = {
  MICRO: { turns: 30, description: '30轮对话后微压缩' },
  AUTO: { tokens: 80000, description: '80K tokens时自动压缩' },
  WARNING: { tokens: 65000, description: '65K tokens时警告' },
};

// 估算消息token（混合语言混合估算）
function estimateTokens(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;
  return Math.ceil(chineseChars * 2 + englishWords * 1.3 + otherChars * 1);
}

// 计算当前上下文总量
function calculateContextUsage(messages, options = {}) {
  const {
    includeSystemPrompt = true,
    includeMemory = true,
    includeSkills = true,
    includeProjectClaueMd = false,
  } = options;

  let total = 0;
  const breakdown = {};

  if (includeSystemPrompt) {
    breakdown.systemPrompt = CONTEXT_BUDGET.SYSTEM_PROMPT;
    total += breakdown.systemPrompt;
  }

  if (includeMemory) {
    breakdown.memoryMd = CONTEXT_BUDGET.MEMORY_MD;
    total += breakdown.memoryMd;
  }

  if (includeSkills) {
    breakdown.skillDescriptions = CONTEXT_BUDGET.SKILL_DESCRIPTIONS;
    total += breakdown.skillDescriptions;
  }

  breakdown.mcpTools = CONTEXT_BUDGET.MCP_TOOLS;
  total += breakdown.mcpTools;

  breakdown.environmentInfo = CONTEXT_BUDGET.ENVIRONMENT_INFO;
  total += breakdown.environmentInfo;

  breakdown.messages = messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content) + estimateTokens(msg.name || '');
  }, 0);

  total += breakdown.messages;

  const effectiveWindow = 200000 - CONTEXT_BUDGET.RESERVED_OUTPUT;
  const percentUsed = ((total / effectiveWindow) * 100).toFixed(1);

  return {
    total: Math.round(total),
    percentUsed,
    breakdown,
    effectiveWindow,
    triggers: {
      micro: total > effectiveWindow - (effectiveWindow * 0.1),
      auto: total > TRIGGERS.AUTO.tokens,
      warning: total > TRIGGERS.WARNING.tokens,
    },
  };
}

// 生成上下文状态报告
function getContextStatus(messages, options) {
  const usage = calculateContextUsage(messages, options);
  
  const status = {
    level: 'NORMAL',
    color: '🟢',
    actions: [],
  };

  if (usage.triggers.warning) {
    status.level = 'WARNING';
    status.color = '🟡';
    status.actions.push('考虑使用 /compact 命令');
  }

  if (usage.triggers.auto) {
    status.level = 'CRITICAL';
    status.color = '🔴';
    status.actions.push('立即触发 autoCompact！');
    status.actions.push('调用 microCompact() 或 autoCompact()');
  }

  return {
    ...status,
    ...usage,
    recommendation: status.actions.length > 0 
      ? status.actions.join(', ')
      : '上下文使用正常',
  };
}

// 判断是否需要压缩
function shouldCompact(messages, threshold = TRIGGERS.AUTO.tokens) {
  const usage = calculateContextUsage(messages);
  return usage.total > threshold;
}

// 压缩策略选择
function chooseCompactStrategy(messages) {
  const usage = calculateContextUsage(messages);
  
  if (usage.total > TRIGGERS.AUTO.tokens) {
    return 'autoCompact';  // 完整LLM摘要
  }
  if (usage.breakdown.messages > CONTEXT_BUDGET.SYSTEM_PROMPT * 5) {
    return 'microCompact';  // 清除工具输出
  }
  return null;  // 不需要压缩
}

module.exports = {
  CONTEXT_BUDGET,
  TRIGGERS,
  estimateTokens,
  calculateContextUsage,
  getContextStatus,
  shouldCompact,
  chooseCompactStrategy,
};
```

### 使用方法

```javascript
// 在对话中调用
const tracker = require('./contextTracker');

const status = getContextStatus(conversationMessages);
console.log(`${status.color} ${status.level}: ${status.total} tokens (${status.percentUsed}%)`);
console.log(`建议: ${status.recommendation}`);
```

---

## 附：microCompact 集成说明

microCompact.js 已经实现。与 contextTracker 集成的方式：

```javascript
const { microCompact, autoCompact, checkNeedsCompact } = require('./microcompact');
const { chooseCompactStrategy, getContextStatus } = require('./contextTracker');

// 在每个用户消息后检查
function onUserMessage(messages) {
  const status = getContextStatus(messages);
  
  if (status.level === 'CRITICAL') {
    const strategy = chooseCompactStrategy(messages);
    if (strategy === 'autoCompact') {
      return autoCompact(messages);
    } else if (strategy === 'microCompact') {
      return microCompact(messages);
    }
  }
  
  return null; // 不需要压缩
}
```

---

## Claude Code 源码对照表

| 功能 | Claude Code 源码文件 | 本实现 |
|------|------|------|
| Token 估算 | `utils/tokens.ts` | `estimateTokens()` |
| Context 计算 | `context.ts` | `calculateContextUsage()` |
| 压缩触发 | `services/compact/autoCompact.ts` | `TRIGGERS` 配置 |
| 微压缩 | `services/compact/microCompact.ts` | `microcompact.js` |
| 摘要压缩 | `services/compact/autoCompact.ts` | `autoCompact()` |
| 规则加载 | `context.ts` | `rules.js` (见 RULES_SYSTEM.md) |
