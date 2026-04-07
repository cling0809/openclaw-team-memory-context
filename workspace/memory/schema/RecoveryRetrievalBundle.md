# RecoveryRetrievalBundle Schema
# 用途：Recovery 会话恢复时的记忆包组装规范
# 位置：~/.openclaw/workspace/memory/schema/RecoveryRetrievalBundle.md
# 版本：1.0.0 | 2026-04-04

---

## 概述

RecoveryRetrievalBundle 是恢复会话时从各层记忆提取数据、组装成一个完整上下文的输出格式。

恢复流程：
```
session 启动
  → 读取 current-recovery.json
  → 加载 recovery slice（最新 RecoveryMemory 记录）
  → 按优先级加载 semantic/procedural/episodic slice
  → 组装 tokenBudget + generatedAt 元信息
  → 输出完整 bundle 给恢复会话
```

---

## Bundle 结构

```js
/**
 * @typedef {Object} RecoveryRetrievalBundle
 *
 * @property {ProfileSlice}       profileSlice     - profile 层级记忆
 * @property {ProjectSlice}        projectSlice     - project 层级记忆
 * @property {RecoverySlice}       recoverySlice     - recovery 恢复记录
 * @property {SemanticSlice}       semanticSlice     - 语义知识记忆
 * @property {ProceduralSlice}     proceduralSlice   - 流程方法记忆
 * @property {EpisodicSlice}       episodicSlice     - 短期片段记忆
 * @property {TokenBudget}         tokenBudget       - token 预算信息
 * @property {number}              generatedAt       - bundle 生成时间戳 ms
 */

/**
 * @typedef {Object} ProfileSlice
 * @property {MemoryRecord[]}  records             - scope=profile 的 MemoryRecord 数组
 * @property {string}          sourceNote          - 数据来源说明
 */

/**
 * @typedef {Object} ProjectSlice
 * @property {MemoryRecord[]}  records             - scope=project 的 MemoryRecord 数组
 * @property {string|null}     activeProjectId     - 当前活跃项目 ID
 * @property {string}          sourceNote
 */

/**
 * @typedef {Object} RecoverySlice
 * @property {RecoveryMemoryRecord[]}  records     - 所有 RecoveryMemoryRecord（按 createdAt 降序）
 * @property {RecoveryMemoryRecord|null}  latest    - 最新一条 recovery 记录
 * @property {BoundarySummary|null}     latestBoundary - 最新 boundary 快照
 * @property {HandoffPacket|null}      latestHandoffPacket - 最新交接包
 * @property {TrancheState|null}       currentTrancheState - 当前 tranche 状态
 * @property {string}                  sourceNote
 */

/**
 * @typedef {Object} SemanticSlice
 * @property {MemoryRecord[]}  records             - scope=semantic 的 MemoryRecord 数组
 * @property {number}          totalTokens         - 估算 token 数
 * @property {string}          sourceNote
 */

/**
 * @typedef {Object} ProceduralSlice
 * @property {MemoryRecord[]}  records             - scope=procedural 的 MemoryRecord 数组
 * @property {number}          totalTokens
 * @property {string}          sourceNote
 */

/**
 * @typedef {Object} EpisodicSlice
 * @property {MemoryRecord[]}  records             - scope=episodic 的 MemoryRecord 数组（最近 7 天）
 * @property {number}          totalTokens
 * @property {string}          sourceNote
 */

/**
 * @typedef {Object} TokenBudget
 * @property {number}  contextLimit               - 当前 context 限制 token 数
 * @property {number}  estimatedUsed               - 估算已用 token 数
 * @property {number}  budgetRemaining             - 剩余可用 token 数
 * @property {number}  recoveryAllocation          - 建议分配给 recovery slice 的 token 上限
 */
```

---

## 各 Slice 内容来源

| Slice          | 来源文件/路径                                       | 过滤条件                            |
|----------------|-----------------------------------------------------|-------------------------------------|
| profileSlice   | `memory/` 下 scope=profile 的记录                    | verificationState != 'refuted'       |
| projectSlice   | `memory/` 下 scope=project 的记录                    | verificationState != 'refuted'       |
| recoverySlice  | `memory/recovery/current-recovery.json`             | 最新 boundary 的 recovery 记录       |
| semanticSlice  | `memory/` 下 scope=semantic 的记录                   | lastUsedAt 最近优先，confidence ≥ 0.5 |
| proceduralSlice | `memory/` 下 scope=procedural 的记录                 | lastUsedAt 最近优先                  |
| episodicSlice  | `memory/` 下 scope=episodic 的记录                   | createdAt 在 7 天内                  |

---

## Bundle 组装函数签名

```js
/**
 * 组装完整的 RecoveryRetrievalBundle
 *
 * @param {Object} params
 * @param {string}  params.sessionKey                  - 当前 session key
 * @param {number}  params.contextLimit                 - context token 上限
 * @param {string}  [params.activeProjectId]            - 当前活跃项目 ID（可选）
 * @param {string}  [params.recoveryFilePath]           - recovery json 路径，默认 memory/recovery/current-recovery.json
 * @param {string}  [params.memoryDir]                  - memory 根目录，默认 ~/.openclaw/workspace/memory
 * @param {number}  [params.maxSemanticTokens]          - semantic slice 最大 token 预算，默认 4000
 * @param {number}  [params.maxProceduralTokens]        - procedural slice 最大 token 预算，默认 3000
 * @param {number}  [params.maxEpisodicTokens]          - episodic slice 最大 token 预算，默认 2000
 *
 * @returns {RecoveryRetrievalBundle}
 */
function assembleRecoveryRetrievalBundle(params) {
  // 1. 读取 current-recovery.json → recoverySlice
  // 2. 扫描 memory/ 目录 → 按 scope 分类 → 各 slice
  // 3. 按 tokenBudget 裁剪 semantic/procedural/episodic slice
  // 4. 附加 generatedAt = Date.now()
  // 5. 返回完整 bundle
}

/**
 * 按 token 预算裁剪 slice 记录
 *
 * @param {MemoryRecord[]} records
 * @param {number} maxTokens
 * @param {string} [priorityField='lastUsedAt']
 * @returns {{ records: MemoryRecord[], estimatedTokens: number }}
 */
function pruneSliceByTokenBudget(records, maxTokens, priorityField = 'lastUsedAt') {
  // 按 priorityField 降序排列
  // 从头取，直到 estimatedTokens ≤ maxTokens
  // 估算：每字符 ≈ 0.25 token，summary + detail 计入
}
```

---

## recoverySlice 详细结构（当有 current-recovery.json 时）

```js
/**
 * current-recovery.json 的实际结构：
 * {
 *   "version": 1,
 *   "generatedAt": 1743753600000,
 *   "sessionKey": "main",
 *   "recoveryRecords": [ ...RecoveryMemoryRecord ],
 *   "latestBoundary": { ...BoundarySummary },
 *   "latestHandoffPacket": { ...HandoffPacket },
 *   "trancheState": { ...TrancheState }
 * }
 */
```

---

## Token 分配建议

| Slice             | 默认 maxTokens | 说明                         |
|-------------------|---------------|------------------------------|
| profileSlice      | 2000          | profile 记忆通常精简         |
| projectSlice      | 4000          | 项目上下文可稍多              |
| recoverySlice     | 3000          | boundary + handoff 摘要      |
| semanticSlice     | 4000          | 语义知识                     |
| proceduralSlice   | 3000          | 流程方法                     |
| episodicSlice     | 2000          | 短期片段，越少越好            |
| **总计上限**       | **18000**     | bundle 应尽量控制在 20k 内   |

---

## 使用示例

```js
const bundle = await assembleRecoveryRetrievalBundle({
  sessionKey: "main",
  contextLimit: 200000,
  activeProjectId: "research-2026"
});

// bundle.recoverySlice.latest 包含最新一次 compact 的恢复信息
// bundle.recoverySlice.latest.latestHandoffPacket 包含完整的 resume context
// bundle.tokenBudget.recoveryAllocation 告知本次恢复用了多少 token
```
