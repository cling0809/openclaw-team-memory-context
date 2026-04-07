# Team Memory Scope 边界规则
## 双轴记忆系统 · 注入边界定义

**文件路径：** `memory/schema/team-memory-scope.md`
**版本：** 1.0
**最后更新：** 2026-04-04

---

## 背景

小龙虾（OpenClaw）多智能体系统中，每次启动子智能体（subagent）时，需要向其注入适当的上下文记忆。

**核心问题：** 应该注入多少记忆？注入哪些？由谁决定？

Team Memory Scope 定义了四层记忆边界，以及每层的注入规则。

---

## 四层记忆边界

### L1 · Shared Team Memory（团队共享层）

**定义：** 当前项目内，所有角色都需要知道的上下文。

**包含内容：**

| 字段 | 来源 | 说明 |
|------|------|------|
| `sharedObjective` | rootTask.objective | 当前项目目标 |
| `sharedCurrentTranche` | rootTask.currentTrancheId + tranche.objective | 当前正在执行的 tranche |
| `sharedOpenIssues` | rootTask.issues（status != resolved/closed） | 未关闭问题列表 |
| `sharedLatestBoundary` | rootTask.latestBoundary | 最新 boundary 快照 ID |
| `sharedLatestHandoff` | rootTask.latestHandoffPacket | 最新交接包摘要 |
| `sharedIteration` | rootTask.iteration | 当前迭代轮次 |

**注入规则：**
- ✅ **自动注入** — 所有子智能体启动时必须注入
- ✅ **同步更新** — rootTask 状态变化时，Shared 层同步刷新
- ✅ **来自 ProjectMemory** — 读取 `memory/projects/<rootTaskId>.md` section 9

---

### L2 · Role Memory（角色经验层）

**定义：** 各角色（coder/qa/reviewer/frontend）在项目中积累的专业经验。

**按角色分类：**

#### Coder Memory
```
- 实现经验：哪些方案在项目中已经失败过
- 技术选型结论：为什么选 A 而非 B
- 代码规范：该项目的特殊约定
- 依赖版本：该项目的关键包版本约束
```

#### QA Memory
```
- 失败模式：该项目常见的失败类型
- 回归检查清单：每次必须验证的点
- 测试偏好：该项目的测试框架/工具选择
- 已知敏感点：哪些改动容易引发问题
```

#### Reviewer Memory
```
- 审查标准：该项目的通过条件
- 必查项：每次 review 必须确认的点
- 常见问题：该项目 reviewer 常见的要求
- 质量门槛：accept/reject 的判断标准
```

#### Frontend Memory
```
- 设计偏好：该项目的 UI/UX 约定
- 技术栈约束：该项目的渲染层限制
- 组件规范：该项目的前端代码风格
- 可用性标准：该项目对交互体验的要求
```

**注入规则：**
- ✅ **按 role 选择性注入** — 只注入与当前任务 role 匹配的 memory
- ✅ **可追加** — 各角色可以在执行过程中追加自己的 role memory
- ✅ **写入 ProjectMemory** — QA failure → ProjectMemory section 2，不是 user preference
- ❌ **不注入到其他 role** — reviewer 不需要 coder 的实现经验

---

### L3 · Personalized Memory（个性化记忆层）

**定义：** 关于用户个人的偏好和习惯。

**包含内容：**
```
- 沟通偏好：用户喜欢用什么方式接收信息
- 时间习惯：时区、工作时段
- 工作风格：喜欢详细还是简洁的报告
- 特定指示：该任务中的特殊要求
```

**注入规则：**
- ✅ **需要时读取** — 不自动注入，由 agent 按需从 `memory/schema/MemoryRecord.md` (scope: profile) 获取
- ❌ **不全量注入** — 不在 subagent 启动时自动带入，避免干扰任务专注度
- ❌ **QA failure 不是 user preference** — 失败教训记入 ProjectMemory role memory，不记入 Personalized Memory

---

### L4 · Execution Memory（执行层）

**定义：** 当前这一次 run 的临时状态。

**包含内容：**
```
- 当前会话的中间变量
- 正在处理的子任务队列
- 本次临时决策（未固化的）
- 调试用的临时状态
```

**注入规则：**
- ✅ **只在当前 run 内共享** — 通过 task-registry 的 `history` 字段和 in-memory 状态传递
- ❌ **不写入 ProjectMemory** — 执行层的临时状态不进入长期记忆
- ❌ **不进入 MemoryRecord** — Execution 层不产生 MemoryRecord
- ❌ **Session 结束后清除** — 随 session compact 而清除

---

## 注入规则总结

| 事件 | Shared L1 | Role L2 | Personalized L3 | Execution L4 |
|------|-----------|---------|-----------------|--------------|
| 子 agent 启动 | ✅ 自动注入 | ✅ 按 role 注入 | ❌ 按需读取 | ❌ 不注入 |
| Tranche 完成 | ✅ 刷新 | ✅ 追加 role 经验 | ❌ | ❌ |
| QA failure | ❌ | ✅ 追加 QA failure mode | ❌ | ❌ |
| Reviewer 打回 | ✅ 刷新 open issues | ✅ 追加审查标准 | ❌ | ❌ |
| extractMemories 产出 | ✅ routing → L1 | ✅ routing → L2 | ✅ routing → L3 | ❌ |
| Session compact | 保留 | 保留 | 保留 | ❌ 清除 |

---

## 子智能体启动时的注入清单

启动任何一个子智能体（`sessions_spawn`）时，必须注入：

```javascript
// 1. 从 ProjectMemory 读取 L1 + relevant L2
const projectMemory = readProjectMemory(rootTaskId);
const roleMemory = projectMemory.teamMemoryScope.roleMemory[currentRole];

// 2. 构造 system prompt 注入块
const scopeBlock = `
=== TEAM MEMORY SCOPE ===
项目目标：${projectMemory.objective}
当前 tranche：${projectMemory.teamMemoryScope.sharedCurrentTranche}
Open issues：${projectMemory.teamMemoryScope.openIssueCount} 条
最新 boundary：${projectMemory.teamMemoryScope.sharedLatestBoundary}
${roleMemory ? `【${currentRole}】经验：${roleMemory}` : ''}
=== END TEAM MEMORY SCOPE ===
`;

// 3. 追加到子 agent system prompt
```

**禁止在注入块中出现：**
- 完整的用户 profile（personalized L3 全量）
- 其他 role 的 role memory
- 执行层的临时变量
- 超出 project 范围的历史项目信息

---

## QA Issue 写入规则（防止误入 Personalized Memory）

```
QA failure 发生
  → 记录到 task-registry.issues（rootTask）
  → ProjectMemory section 2（关键决策）追加："⚠️ [失败教训] · reason: ..."
  → ProjectMemory section 8（Open Issues）追加 IssueEntry
  → ProjectMemory L2（Role Memory - QA）追加 failure mode
  → NOT写入 MemoryRecord (scope: profile)
```

**判断标准：**
- 如果是**项目特定**的失败教训 → ProjectMemory L2（Role Memory）
- 如果是**用户偏好**相关（如用户讨厌某种交互方式）→ Personalized Memory (L3)
- 如果是**普遍经验**（任何项目都适用）→ extractMemories → `memory/schema/MemoryRecord.md` (scope: semantic)

---

## 与 extractMemories 的 routing output 对接

`extractMemories.js` 已在处理 `type='project'` 的 candidate 时产出 routing 信息。ProjectMemory 写入器消费该 routing：

```javascript
// extractMemories 返回值中新增 routing 字段
const result = await extractMemories(transcript, {
  // ... existing options
  // 新增：是否输出 routing
  outputRouting: true,
});

// result.routing 示例：
// [
//   { type: 'project', target: 'root-123', section: '2', patch: { decisions: [{...}] } },
//   { type: 'project', target: 'root-123', section: '8', patch: { issues: [{...}] } },
//   { type: 'feedback', target: 'coder', section: 'role-memory', patch: {...} },
// ]

// ProjectMemory 写入器
for (const route of result.routing) {
  if (route.type === 'project') {
    await mergeProjectMemory(route.target, route.section, route.patch);
  }
}
```

**接驳点（Tranche 2 × Tranche 3）：**

| extractMemories 产出 | routing type | ProjectMemory 写入目标 |
|---------------------|--------------|----------------------|
| project 决策 | `project` | section 2（关键决策） |
| project tranche 完成 | `project` | section 4, 7 |
| feedback 教训 | `feedback` | L2 Role Memory (QA) |
| user preference | `user` | L3 Personalized Memory |

---

## 文件位置

```
memory/
├── schema/
│   ├── MemoryRecord.md          # 原子记忆单元 schema（已有）
│   └── team-memory-scope.md    # 本文件（L1-L4 边界规则）
└── projects/
    └── <rootTaskId>.md         # 各 rootTask 的 project memory 文件
```

---

## 修订历史

| 版本 | 日期 | 修订内容 |
|------|------|----------|
| 1.0 | 2026-04-04 | 初始版本，四层边界定义 |
