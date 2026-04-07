---
name: team-router
version: 1.0.0
updated: 2026-04-03
description: |
  把任务路由给最合适的专职 agent：coder、research、frontend、qa、reviewer，让主小龙负责分派而不是包打天下。支持 Fork/Spawn/Teammate 三种派工模式。
---

# Team Router

## 核心借鉴（Claude Code Multi-Worker 协调模式）

- **任务分叉与汇聚**：Claude Code 在复杂任务中并行派工多个子任务，主控管道等待所有 Worker 结果后再汇合。本 skill 的 Coordinator Mode 直接对应此模式。
- **Worker 结果聚合**：Claude Code 的结果通过统一管道回传，本 skill 的 `<task-notification>` 格式参考了 Claude Code 的结果序列化方式。
- **工具限制传达**：Claude Code 的 Worker 通过 `ASYNC_AGENT_ALLOWED_TOOLS` 限制可用工具，子 agent 知道自己能用什么不能用什么。派工时明确告知对方可用/禁用工具集。
- **Fork 子 Agent**：Claude Code 的 Fork 机制继承父上下文而非从头开始，本 skill 的子 agent 复用主小龙的上下文，减少重复工作。

适用场景

- 用户要同时推进多个任务
- 用户明确说「让某条龙处理」
- 任务明显属于代码、研究、前端、测试、审查中的某一类
- 主会话需要保持流畅，不适合自己长时间阻塞

角色映射

- `coder`：实现功能、修 bug、重构、后端设计、工程落地
- `research`：搜集资料、比较来源、整理结论、产出文档
- `frontend`：前端页面、组件、交互、视觉层级、审美与 polish
- `qa`：复现问题、设计测试、回归验证、边界条件检查
- `reviewer`：代码审查、风险排查、缺失测试、上线前把关

默认路由规则

1. 写代码、改代码、修 bug：优先 `coder`
2. 查资料、做综述、整理报告：优先 `research`
3. UI 改版、页面质感、设计实现：优先 `frontend`
4. 测试、回归、复现、验证：优先 `qa`
5. review、找风险、挑 bug：优先 `reviewer`

## 派工命令格式

```
/fork [任务]           -- 子agent继承当前上下文（轻量级摘要）
/fork-detailed [任务]   -- 子agent继承完整上下文+工具池定义
/spawn [任务]          -- 子agent独立启动（当前默认模式，空白messages）
/teammate [角色] [任务] -- 派给指定专职角色（参考角色映射表）
```

### 命令语义对比

| 命令 | 上下文继承 | 工具池 | 适用场景 |
|------|-----------|--------|---------|
| `/spawn` | 无 | 需手动声明 | 独立任务、不需要上下文 |
| `/fork` | 摘要注入 | 需手动声明 | 关联任务、需要知道背景 |
| `/fork-detailed` | 摘要+完整上下文 | 完整工具池 | 复杂协作、深度接棒 |
| `/teammate` | 按角色默认 | 按角色默认 | 明确指派某一专职 |

## Fork 模式详解

### 什么时候用 Fork

当你需要子 agent 「知道当前在发生什么」，而不是从零开始：
- 主小龙正在处理一个复杂任务，需要拆分出子任务给其他人接棒
- 用户需求已经经过几轮讨论，子 agent 需要知道讨论结果
- 当前任务有上下文依赖（前置决策、已尝试的方案、不想重复的工作）

Spawn 模式（独立启动）适用于：一次性独立任务，不需要知道任何前置上下文。

### Fork 的注入内容（来自 Claude Code Forked Agent 研究）

Claude Code 的 Fork 机制向子 agent 注入以下内容：

1. **父的 system prompt 关键片段**：不是完整复制，而是提取与当前任务相关的角色定义、工作原则、约束条件
2. **最近 N 轮对话摘要**：用户说了什么、确认了什么、否决了什么、当前卡在哪里
3. **当前任务目标**：子 agent 需要完成的具体任务描述
4. **工具池定义**：子 agent 可以使用哪些工具（可选，取决于 /fork 还是 /fork-detailed）

### buildForkSystemPrompt 函数

```javascript
/**
 * 构建 Fork 模式下的 system prompt 片段
 * 
 * @param {Object} conversationSummary - 对话摘要对象
 * @param {string} conversationSummary.userPreferences - 用户偏好（语言风格、交付要求等）
 * @param {string} conversationSummary.projectState - 项目当前状态（哪个文件、在做什么）
 * @param {string} conversationSummary.completedSteps - 已完成的步骤列表
 * @param {string} conversationSummary.currentBlocker - 当前卡点/问题
 * @param {string} conversationSummary.rejectedOptions - 用户已否决的方案
 * @param {string} task - 任务描述
 * @param {Object} options - 可选配置
 * @param {string[]} options.availableTools - 可用工具列表
 * @param {string[]} options.disabledTools - 禁用工具列表
 * @param {number} options.recentTurnsCount - 继承最近N轮对话，默认5
 * @returns {string} 注入给子agent的system prompt片段
 */
function buildForkSystemPrompt(conversationSummary, task, options = {}) {
  const {
    availableTools = [],
    disabledTools = [],
    recentTurnsCount = 5
  } = options;

  const sections = [];

  // 1. 角色继承说明
  sections.push(`[上下文继承 - Fork模式]
你是一个被主小龙（Coordinator）派工的专职子agent。
主小龙没有从头启动你，而是把当前任务的上下文摘要注入给你，
这样你可以直接接棒，而不需要从头了解背景。`);

  // 2. 用户偏好
  if (conversationSummary.userPreferences) {
    sections.push(`【用户偏好】
${conversationSummary.userPreferences}`);
  }

  // 3. 项目状态
  if (conversationSummary.projectState) {
    sections.push(`【项目当前状态】
${conversationSummary.projectState}`);
  }

  // 4. 已完成步骤
  if (conversationSummary.completedSteps && conversationSummary.completedSteps.length > 0) {
    sections.push(`【已完成步骤】
${conversationSummary.completedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }

  // 5. 当前卡点
  if (conversationSummary.currentBlocker) {
    sections.push(`【当前卡点】
${conversationSummary.currentBlocker}`);
  }

  // 6. 已否决的方案（避免重复踩坑）
  if (conversationSummary.rejectedOptions && conversationSummary.rejectedOptions.length > 0) {
    sections.push(`【已否决的方案】（不要重复尝试）
${conversationSummary.rejectedOptions.map(o => `- ${o}`).join('\n')}`);
  }

  // 7. 工具池（fork-detailed 模式）
  if (availableTools.length > 0 || disabledTools.length > 0) {
    const toolSections = [];
    if (availableTools.length > 0) {
      toolSections.push(`【可用工具】\n${availableTools.join(', ')}`);
    }
    if (disabledTools.length > 0) {
      toolSections.push(`【禁用工具】（不要使用）\n${disabledTools.join(', ')}`);
    }
    sections.push(toolSections.join('\n'));
  }

  // 8. 当前任务
  sections.push(`【当前任务】
${task}

请基于以上上下文执行任务。完成后通过 <task-notification> 格式回传结果。`);

  return sections.join('\n\n');
}
```

### 使用示例

```javascript
// /fork 实现这个模块的重构
const summary = {
  userPreferences: '中文优先，喜欢直接交付不废话',
  projectState: '在 /workspace/projectA 目录下，有一个 auth 模块正在重构',
  completedSteps: ['分析现有auth代码结构', '确认了三种登录方式', '设计了新接口'],
  currentBlocker: 'Session管理部分的设计还没定',
  rejectedOptions: ['不要用 JWT', '不要引入新的ORM']
};

const task = '实现 User Session 管理模块，包括创建/刷新/失效逻辑';

const systemPrompt = buildForkSystemPrompt(summary, task, {
  availableTools: ['read', 'write', 'exec'],
  disabledTools: ['browser', 'voice_call']
});
```

## 协调者模式（Coordinator Mode）

主小龙负责理解需求 → 并行派工 → 异步聚合结果，不自己逐个执行。

**工作流：**
1. **理解**：先全面理解任务，判断是否需要多角色协作
2. **拆分**：把任务拆成 3~7 个子任务，每个子任务指派最合适的角色
3. **派工**：并行派给多个专职 agent，明确告知可用/禁用工具集
4. **等待**：专职 agent 在后台执行，主小龙等待结果
5. **聚合**：所有 Worker 结果通过 `<task-notification>` 格式回传，主小龙负责合成最终产出

**失败策略（3级）：**
- **可恢复**（网络抖动/超时）：自动重试 1~2 次
- **资源失败**（子 agent 崩溃）：降级到其他 agent 或主小龙自己执行
- **不可恢复**（权限拒绝/任务错误）：立即升级，告知用户具体问题

## 并发分区原则

路由任务时，不仅指派「谁来做」，还要考虑「怎么做」：

1. **只读任务可并行**：查资料、读文件、搜索、grep/glob/web_search 这类不修改状态的操作，可以同时派给多个 agent
2. **写任务串行执行**：写文件、改代码、执行命令等有副作用的操作，默认串行；同一文件的操作绝对串行
3. **关键操作单独确认**：上线、删除、强制推送等高风险操作，不静默自动执行，必须逐个确认
4. **派工时明确执行顺序**：告诉子 agent 哪些可以并行，哪些必须等前一个完成

## 协作原则

- 主小龙负责拆任务、指定角色、收结果、做最终汇总
- 专职 agent 负责深入执行，不要求它们各自包揽全部职能
- 一个任务需要多种能力时，先让最核心的 agent 主做，再视情况追加其他 agent
- 复杂任务不要只「口头分工」然后仍然单线程自己做完
- 如果当前还没有真实派工，要明确告诉用户「尚未派工」，并给出最小可执行的派工动作
- 默认把 `qa` 和 `reviewer` 放进研究、建模、重构、系统排障这类高要求任务流程里

## 派工执行 Checklist

每次派工前快速确认：

- [ ] 任务描述清晰（不是泛泛的「帮我看看」）
- [ ] 知道这个任务给谁（参考角色映射）
- [ ] 确认了工具池（可用/禁用）
- [ ] 告知了上下文继承方式（fork / spawn / teammate）
- [ ] 有明确回传格式（`<task-notification>`）

输出风格

- 先说明你准备交给谁
- 再说明为什么
- 最后给出最小可执行的下一步
- 如果任务明显复杂，额外显式给出：
  - `统筹`
  - `主责`
  - `协作`
  - `验证`
  - `把关`
  - `当前阶段`
  - `下一棒`
- 如果已经存在真实子智能体，还要显式同步：
  - `执行中角色`
  - `已完成角色`
  - `等待回传`

---

### Coordinator 编排模式（高级）

当主小龙（Coordinator）需要同时管理多个并行的 worker 子任务时，使用此模式。

#### 核心原则

1. **Coordinator 只做分解和合成，不自己执行具体任务**
2. **Worker 通过工具执行任务，通过 `<task-notification>` 回传结果**
3. **team.json 持久化协作状态，支持进程重启后恢复**

#### Coordinator 工作流

```
用户输入
  ↓
主小龙（Coordinator）分析任务
  ↓
拆分为 N 个子任务（并行/串行）
  ↓
并行派工给 Worker 1..N
  ↓
等待 Worker 们完成
  ↓
Coordinator 聚合结果，合成最终产出
  ↓
回传用户
```

#### 派工格式（Coordinator Mode）

使用 `/fork-detailed` 命令派工时，附带 team.json 协作信息：

```
/fork-detailed [任务描述]

团队信息：
- 团队名：default
- 你的角色：worker
- 你的 ID：worker-1
- 主小龙（Coordinator）ID：main
- 其他 worker：无
- 当前任务：<具体任务>

工具池：read, write, exec, web_search, sessions_send
禁用工具：browser, voice_call
```

#### `<task-notification>` 格式（Worker 回传）

Worker 完成任务后，在最后一条消息中输出：

```
<task-notification>
<task-id>worker-1</task-id>
<status>done</status>  <!-- done | failed | killed -->
<output>
[任务执行摘要，简洁的结论和关键产出]
</output>
<artifacts>
- /workspace/file1.ts  (关键产物）
- /workspace/output.json
</artifacts>
<error>（如果有）错误信息</error>
</task-notification>
```

#### Coordinator 接收结果

主小龙在解析到 `<task-notification>` 后：
1. 更新 team.json 中对应任务状态
2. 收集所有 Worker 的 `<output>`
3. 合成最终结论
4. 删除或归档已完成的任务记录

#### team.json 结构

```json
{
  "leadAgentId": "main",
  "teamAllowedPaths": ["$OPENCLAW_WORKSPACE"],
  "members": {
    "main": { "sessionKey": "agent:main:main", "role": "coordinator", "status": "active", "lastSeenAt": 1234567890 },
    "worker-1": { "sessionKey": "...", "role": "worker", "status": "active", "lastSeenAt": 1234567890 }
  },
  "tasks": {
    "t1": { "type": "research", "status": "done", "assignedTo": "worker-1", "createdAt": 1234567890, "completedAt": 1234568000 }
  },
  "updatedAt": 1234567890
}
```

#### 实施检查清单

在一次 Coordinator 任务中，每次派工前确认：
- [ ] 已将 team.json 状态更新为 `pending`
- [ ] 派工时告知 worker：`team.json` 中的任务 ID
- [ ] 告知 worker：`<task-notification>` 格式和回传位置
- [ ] Coordinator 等待所有 Worker 通知后再合成交付
- [ ] 任务完成后更新 team.json 状态为 `done`/`failed`

#### 失败处理

- **Worker 超时**：Coordinator 从 team.json 查到 `status=pending` 且 `createdAt` 过早的任务，主动重派或降级执行
- **Worker 失联**：Coordinator 5 分钟未收到 `<task-notification>`，主动检查并重新派工
- **部分失败**：其他 Worker 成功时，Coordinator 合成可用结果，并注明失败部分

---

### QA/Reviewer 闭环（实现 → 测试 → 打回 → 修复 → 复测 → 通过）

#### 核心原则

Reviewer 角色不再只输出"文字意见"，而是输出**结构化打回标签**，让 Coordinator 能自动解析并触发重新派工。

#### Reviewer 必须输出的格式

每次 Review 完成后，在回复末尾输出：

```
[REVIEW_RESULT]
status: sent_back | approved
task_id: <任务的 taskId（来自派工时告知）>
reason: <具体问题，一句话>
suggestion: <修复建议>
iteration: <当前第几次尝试>
[/REVIEW_RESULT]
```

**示例（打回）：**
```
[REVIEW_RESULT]
status: sent_back
task_id: task-123
reason: 边界条件未处理，数组越界会 panic
suggestion: 在索引访问前加 bounds check
iteration: 2
[/REVIEW_RESULT]
```

**示例（通过）：**
```
[REVIEW_RESULT]
status: approved
task_id: task-123
reason: 通过所有检查项
suggestion: 无
iteration: 2
[/REVIEW_RESULT]
```

#### Coordinator 解析流程

1. 识别 `<task_id>` + `<status>` 标签
2. 如果 `status === 'sent_back'`：
   - 调用 `sentBackTask(task_id, 'reviewer', reason)` 重置任务（iteration+1，状态→pending）
   - 重新派给原执行者，明确告知 `iteration=N+1` 和 `reason`
3. 如果 `status === 'approved'` 或 `iteration >= 2` 且最近状态为 done：
   - 任务交付完成
   - 更新 team.json 状态为 `done`

#### 迭代次数保护

- 最多打回 5 次（`iteration > 5` 时任务自动标记为 `failed`，不再重派）
- 第 3 次打回时，Coordinator 自动告知用户"任务已重试 3 次仍未通过"
- `isTaskApproved(taskId)` 函数：status=DONE 且 iteration≥2 时返回 true

#### TaskRegistry 事件回调

```javascript
// 派工时注册完成回调：
onTaskComplete(taskId, (result) => {
  // 任务完成，等待 Reviewer 审查
});

// 打回后重新派工时：
sentBackTask(taskId, 'reviewer', '边界条件未处理');
// → task.iteration += 1，status 重置为 pending
```

#### 打通闭环的最小检查清单

- [ ] Reviewer 每次回复必须包含 `[REVIEW_RESULT]` 标签
- [ ] Coordinator 解析到 `sent_back` 时必须触发 `sentBackTask`
- [ ] 重新派工时必须告知执行者：iteration 次数 + 打回原因
- [ ] iteration >= 5 时任务不再自动重派，通知用户人工介入
