# MemoryRecord Schema
# 用途：双轴记忆系统 MemoryRecord 统一数据模型
# 位置：~/.openclaw/workspace/memory/schema/MemoryRecord.md
# 版本：1.0.0 | 2026-04-04

---

## 概述

MemoryRecord 是双轴记忆系统的核心原子单元，分为两类主 Type：
- **SingleMemory**：传统记忆记录，对应 profile/project/programmatic 分层
- **RecoveryMemory**：会话恢复记忆，每次 compact 时从 boundary 快照生成

---

## MemoryRecord 完整字段定义

```js
/**
 * @typedef {Object} MemoryRecord
 *
 * @property {string}               id                    - 唯一标识，格式：mem:<type>:<scope>:<shortHash>
 * @property {'single'|'recovery'}  type                  - 记录类型
 * @property {'profile'|'project'|'programmatic'|'semantic'|'procedural'|'episodic'}  scope
 *                                                       - 记忆作用域，决定存储层级
 * @property {string}               title                 - 简短标题，≤ 60 字符，用于快速识别
 * @property {string|null}          summary               - 一句话摘要，≤ 240 字符，检索优先命中
 * @property {string|null}          detail                - 完整细节，可超长，支持 markdown/代码块
 * @property {string|null}          source                - 来源：session:<key> | file:<path> | user | system
 * @property {number}               confidence            - 可信度 0.0-1.0，影响检索权重
 * @property {'unverified'|'pending'|'verified'|'refuted'}  verificationState
 *                                                       - 验证状态，影响升级/降级策略
 * @property {'critical'|'high'|'medium'|'low'}          importance  - 重要程度，用于淘汰策略
 * @property {'public'|'private'|'sensitive'}            sensitivity - 敏感级别，控制传播范围
 * @property {string[]}             tags                  - 自由标签，用于语义检索
 * @property {string[]}             relatedTaskIds        - 关联的 task id 列表
 * @property {string[]}             relatedSessionKeys    - 关联的 session key 列表
 * @property {number}               createdAt             - 创建时间戳 ms
 * @property {number}               lastUsedAt            - 上次被命中时间戳 ms
 * @property {number}               useCount              - 累计被命中次数
 * @property {TtlPolicy}            ttlPolicy             - TTL 策略，决定多久后失效
 * @property {PromotionPolicy|null}  promotionPolicy       - 升级策略，满足条件时提升层级
 * @property {DemotionPolicy|null}  demotionPolicy        - 降级策略，满足条件时降级或淘汰
 */

/**
 * @typedef {Object} TtlPolicy
 * @property {'expire'|'archive'|'snapshot'}  action      - 到期行为
 * @property {number|null}                    maxAgeMs    - 最大存活时间 ms，null=永不过期
 * @property {number|null}                    maxUseCount  - 最大命中次数，null=不限
 */

/**
 * @typedef {Object} PromotionPolicy
 * @property {number}  minUseCount           - 最少命中次数触发升级
 * @property {number}  minConfidence         - 最低可信度门槛
 * @property {string[]} triggerStates        - 允许从哪些 verificationState 升级
 */

/**
 * @typedef {Object} DemotionPolicy
 * @property {number}  maxAgeDays             - 超此天数未命中则降级
 * @property {number}  decayIntervalDays       - 降级检查周期
 * @property {string}  demoteTo               - 降级目标 scope
 */

/**
 * @typedef {'unverified'|'pending'|'verified'|'refuted'} VerificationState
 */
```

---

## Type = 'single' 时各 scope 的默认 TtlPolicy

| scope        | maxAgeMs       | maxUseCount | action   | 说明                          |
|--------------|----------------|-------------|----------|-------------------------------|
| profile      | 365 × 24 × 3600 × 1000 | null | snapshot | 用户偏好/身份，几乎永不过期 |
| project      | 90 × 24 × 3600 × 1000   | null | snapshot | 项目上下文，季度审阅         |
| semantic     | 30 × 24 × 3600 × 1000   | 50   | archive  | 语义知识，中间层              |
| procedural   | 60 × 24 × 3600 × 1000   | 100  | archive  | 流程/方法论，中长期           |
| episodic     | 7 × 24 × 3600 × 1000    | 20   | expire   | 短期片段，快速淘汰            |

---

## Type = 'recovery' 时各 scope 的 TtlPolicy

| scope      | maxAgeMs       | maxUseCount | action  | 说明                         |
|------------|----------------|-------------|---------|------------------------------|
| episodic   | 14 × 24 × 3600 × 1000  | 5   | expire  | 恢复快照，短生命周期         |

---

## VerificationState 升级/降级规则

```
unverified
  ├── [confidence ≥ 0.7, useCount ≥ 2]  ──→  pending
  └── [数据源明确为 system/file]        ──→  verified（直接信任）

pending
  ├── [confidence ≥ 0.85, useCount ≥ 5]  ──→  verified
  └── [confidence < 0.4]                ──→  unverified（降级）

verified
  ├── [confidence ≥ 0.9, useCount ≥ 10] ──→  (稳定状态，不自动升级)
  └── [新证据矛盾且 confidence < 0.5]   ──→  refuted

refuted
  └── [用户/系统明确纠正]               ──→  verified（可重新激活）
```

**降级路径（自动）**：
- verified → pending：连续 30 天未命中
- pending → unverified：连续 14 天未命中且 confidence < 0.6
- unverified → (淘汰)：连续 60 天未命中

---

## SingleMemory 的 promotionPolicy 示例

```js
const defaultPromotionPolicy = {
  minUseCount: 5,
  minConfidence: 0.8,
  triggerStates: ['pending', 'verified']
};
```

---

## RecoveryMemoryRecord 扩展字段（继承 MemoryRecord + 扩展）

```js
/**
 * @typedef {MemoryRecord & RecoveryMemoryExtension} RecoveryMemoryRecord
 *
 * RecoveryMemory 在 compact 时自动生成，字段补充如下：
 * @property {BoundarySummary}  boundarySummary     - boundary 快照摘要
 * @property {HandoffPacket}   latestHandoffPacket - 最新交接包
 * @property {string|null}     openIssuesDigest    - 待办事项摘要
 * @property {string|null}     currentObjectiveDigest - 当前目标摘要
 * @property {TrancheState}    trancheState        - tranche 状态快照
 */

/**
 * @typedef {Object} BoundarySummary
 * @property {string}  boundaryId
 * @property {string}  sessionKey
 * @property {number}  createdAt
 * @property {string}  mode          - 'manual' | 'auto_soft' | 'auto_hard'
 * @property {number|null} preCompactTokens
 * @property {number|null} postCompactTokens
 * @property {string|null} summaryRef
 * @property {string|null} trancheId
 * @property {string|null} openIssuesDigest
 * @property {string|null} currentObjectiveDigest
 */

/**
 * @typedef {Object} HandoffPacket
 * @property {string|null}   currentObjective
 * @property {string|null}   currentTranche
 * @property {string|null}   currentStatus
 * @property {string|null}   openIssues
 * @property {BoundarySummary|null} recentBoundary
 * @property {string|null}   recentHandoffSummary
 * @property {string|null}   nextStep
 * @property {string[]}      artifactRefs
 */

/**
 * @typedef {Object} TrancheState
 * @property {string|null}  trancheId
 * @property {string|null}  objective
 * @property {string|null}  phase
 * @property {string[]}     openIssueIds
 * @property {number}       iterationCount
 * @property {string|null}  childSessionKey
 */
```

---

## 示例记录

```json
{
  "id": "mem:single:profile:m3x9k2",
  "type": "single",
  "scope": "profile",
  "title": "用户偏好中文回复",
  "summary": "用户明确要求所有回复使用中文，先结论后细节",
  "detail": "参考 SOUL.md 中的风格要求。优先结构化输出。",
  "source": "user",
  "confidence": 0.95,
  "verificationState": "verified",
  "importance": "high",
  "sensitivity": "private",
  "tags": ["偏好", "回复风格", "中文"],
  "relatedTaskIds": [],
  "relatedSessionKeys": [],
  "createdAt": 1743753600000,
  "lastUsedAt": 1743753600000,
  "useCount": 1,
  "ttlPolicy": { "action": "snapshot", "maxAgeMs": 31536000000, "maxUseCount": null },
  "promotionPolicy": null,
  "demotionPolicy": null
}
```
