# Routing Rules — 记忆路由规则表
# 版本：1.0.0 | 2026-04-04
# 用途：将 MemoryRecord Candidate 路由到正确的存储落点

---

## 路由矩阵

| type        | scope        | 落点文件                        | 验证要求                          |
|-------------|--------------|--------------------------------|----------------------------------|
| profile     | profile      | `MEMORY.md` Profile 区块        | confidence ≥ 0.85 **且** 已重复验证 |
| project     | project      | `memory/projects/<id>.md`      | 需 task 绑定（relatedTaskIds 非空） |
| episodic    | episodic     | `memory/YYYY-MM-DD.md`         | 默认 `pending`，7-14 天 TTL        |
| semantic    | semantic     | `memory/cards/<id>.md`         | 需一次复用验证（useCount ≥ 1）      |
| procedural  | procedural   | `memory/procedures/<id>.md`    | 稳定后进 skill（TTL 内不升级）      |
| recovery    | recovery     | `memory/recovery/current-recovery.json` | 直接写入，系统生成          |

---

## 各路由详细规则

### 1. profile → MEMORY.md Profile 区块

**落点**：`MEMORY.md` 内 `## Profile` 区块

**写入前最低条件**：
- `confidence ≥ 0.85`
- `verificationState === 'verified'`（不能是 pending）
- 触发过重复验证（relatedSessionKeys.length ≥ 2 **或** useCount ≥ 2）

**Promotion 触发条件**：
- `pending → verified`：confidence ≥ 0.85 **且** useCount ≥ 5
- `unverified → pending`：confidence ≥ 0.7 **且** useCount ≥ 2

**Demotion 触发条件**：
- 连续 90 天未命中 → 检查是否过时

**与其他层去重**：
- 基于 `id` 全局唯一
- 基于 `title` 精确匹配（profile 类型 title 相同则合并）

---

### 2. project → memory/projects/<id>.md

**落点**：`memory/projects/<id>.md`（id 取 relatedTaskIds[0] 或 hash(title)）

**写入前最低条件**：
- `relatedTaskIds.length > 0`（必须有 task 绑定）
- `confidence ≥ 0.7`
- `verificationState !== 'refuted'`

**Promotion 触发条件**：
- 季度审阅时，useCount ≥ 20 且 confidence ≥ 0.8 → 可升级到 MEMORY.md

**Demotion 触发条件**：
- 超过 90 天无关联 task → 降级到 episodic

**与其他层去重**：
- 基于 `relatedTaskIds[0]` 路由到固定文件
- 同一 task 的多条记录追加到同一文件

---

### 3. episodic → memory/YYYY-MM-DD.md

**落点**：`memory/YYYY-MM-DD.md`（按日期组织）

**写入前最低条件**：
- `confidence ≥ 0.6`（最低容忍度）
- `verificationState` 初始为 `pending`（不是 verified）

**Promotion 触发条件**：
- `pending → verified`：30 天内 useCount ≥ 3 且 confidence ≥ 0.8
- 升级后移动到 `memory/cards/`（semantic 层）

**Demotion 触发条件**：
- 超过 14 天未命中 → 直接 expire（淘汰）

**与其他层去重**：
- 基于 `source`（session:<key>）+ `summary` 的 hash 查重
- 若存在相同 source+summary 的 pending 记录，跳过写入

---

### 4. semantic → memory/cards/<id>.md

**落点**：`memory/cards/<id>.md`（id = hash(title) 前 8 位）

**写入前最低条件**：
- 必须先经过 episodic 层的 pending 状态
- **或** 直接来源为 file:<path> / system（高可信度来源）

**Promotion 触发条件**：
- useCount ≥ 5 且 confidence ≥ 0.85 → 可进入 MEMORY.md

**Demotion 触发条件**：
- 超过 30 天 useCount < 3 → 降级回 episodic

**与其他层去重**：
- 基于 `title` hash 精确匹配
- 若已存在 semantic 记录，更新而非新建

---

### 5. procedural → memory/procedures/<id>.md

**落点**：`memory/procedures/<id>.md`（id = hash(title) 前 8 位）

**写入前最低条件**：
- 需通过至少 2 次独立场景验证（relatedSessionKeys.length ≥ 2）
- `confidence ≥ 0.8`
- `importance` 为 `high` 或 `critical`

**Promotion 触发条件**：
- 稳定 90 天 → 写入 skill 文件（`~/.openclaw/workspace/skills/`）
- 触发方式：生成对应 SKILL.md 片段

**Demotion 触发条件**：
- 连续 30 天 useCount = 0 → 降级到 semantic

**与其他层去重**：
- 基于 `title` + `detail`（含关键步骤）双重 hash
- 流程变更时更新而非新建

---

### 6. recovery → memory/recovery/current-recovery.json

**落点**：`memory/recovery/current-recovery.json`（直接覆盖）

**写入前最低条件**：
- 仅限 compact-boundary 触发后写入
- 来源必须是 `session:<key>` 且 mode 已知

**Promotion / Demotion**：
- 不参与升级降级，SOP 内固定写入

**与其他层去重**：
- recovery 是独立体系，不与 single 记忆共用去重逻辑

---

## 全局查重策略

三级查重（由 `checkDeduplication()` 实现）：

| 级别 | 依据 | 匹配时动作 |
|------|------|-----------|
| L1   | `id` 完全相等 | 跳过（已有记录） |
| L2   | `title` hash 相等 + scope 相等 | 合并到已有记录（追加 detail） |
| L3   | `source + summary` hash 相等 + scope 相等 | 跳过（episodic pending 防重） |

---

## Cursor 持久化

**`.memory_cursor` 文件**：记录当前 session 已处理的最末消息 uuid

- 路径：`~/.openclaw/workspace/.memory_cursor`
- 格式：`{ "lastMemoryMessageUuid": "msg-xxx", "lastMemoryTimestamp": 1743753600000 }`
- 写入时机：每次 `extractMemories` 完成写入后同步更新
- 读取时机：`extractMemories` 启动时读取，跳过已处理消息

---

## schemaVersion

所有 MemoryRecord 必须携带：

```js
schemaVersion: "1.0.0"   // 兼容未来字段迁移
```

路由层不处理 schema 迁移，但写入时保留原始 schemaVersion 便于后续审计。
