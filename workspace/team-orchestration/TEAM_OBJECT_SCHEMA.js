'use strict';

/**
 * Team Orchestration Object Schema
 * 定义团队协作对象的类型、状态机、接口和工厂函数
 */

// ─── 状态枚举 ───────────────────────────────────────────────────────────────

/** @type {Object.<string, string>} */
const TeamObjectStatus = Object.freeze({
  QUEUED:     'queued',
  RUNNING:    'running',
  DONE:       'done',
  FAILED:     'failed',
  TIMED_OUT:  'timed_out',
  ABORTED:    'aborted',
});

// ─── 阶段枚举 ────────────────────────────────────────────────────────────────

/** @type {Object.<string, string>} */
const TeamObjectPhase = Object.freeze({
  PLANNING:   'planning',
  EXECUTING:  'executing',
  VERIFYING:  'verifying',
  REVIEWING:  'reviewing',
  COMPLETING: 'completing',
  BLOCKED:    'blocked',
});

// ─── 角色枚举 ────────────────────────────────────────────────────────────────

/** @type {Object.<string, string>} */
const TeamChildRole = Object.freeze({
  LEAD:    'lead',
  SUPPORT: 'support',
  VERIFY:  'verify',
  REVIEW:  'review',
});

// ─── TeamChild 接口 ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} TeamChild
 * @property {string}            agentId        - 子智能体的唯一标识
 * @property {string}            sessionKey     - 子智能体的会话 key
 * @property {string}            role           - 角色：lead/support/verify/review
 * @property {string}            status         - 当前状态：queued/running/done/failed/timed_out/aborted
 * @property {string|null}       taskSummary    - 任务摘要（描述）
 * @property {string|null}       summary        - 执行摘要（完成后填入）
 * @property {string|null}       resultDigest   - 结果摘要的 hash/digest（用于幂等校验）
 * @property {number}            lastActivityAt - 上次活动时间（Unix ms）
 * @property {string|null}       error          - 错误信息（如有）
 */

// ─── TeamObject 接口 ─────────────────────────────────────────────────────────

/**
 * @typedef {Object} TeamObject
 * @property {string}              objective      - 团队目标描述
 * @property {string}             [phase]         - 当前阶段
 * @property {string}             [status]        - 当前状态
 * @property {string|null}        [lead]          - 主责智能体 agentId
 * @property {string[]}           [support]       - 支持智能体列表
 * @property {string[]}           [verify]        - 验证智能体列表
 * @property {string[]}           [review]        - 审查智能体列表
 * @property {string|null}        [currentWorker] - 当前执行中的 worker agentId
 * @property {string|null}        [nextWorker]    - 下一个待调度的 worker agentId
 * @property {TeamChild[]}        [children]      - 子任务/子智能体列表
 * @property {string|null}        [lastProgress]  - 上次进度描述
 * @property {number}             [lastSyncAt]    - 上次同步时间戳（Unix ms）
 * @property {number}             [createdAt]     - 创建时间戳
 * @property {number}             [updatedAt]     - 更新时间戳
 */

// ─── 工厂函数 ────────────────────────────────────────────────────────────────

const _now = () => Date.now();

/**
 * 创建新的 TeamObject
 * @param {Partial<TeamObject> & { objective: string }} opts
 * @returns {TeamObject}
 */
function createTeamObject(opts) {
  if (!opts || !opts.objective) {
    throw new Error('createTeamObject: objective is required');
  }
  return {
    objective:      opts.objective,
    phase:          opts.phase          ?? TeamObjectPhase.PLANNING,
    status:         opts.status         ?? TeamObjectStatus.QUEUED,
    lead:           opts.lead           ?? null,
    support:        opts.support        ?? [],
    verify:         opts.verify         ?? [],
    review:         opts.review         ?? [],
    currentWorker:  opts.currentWorker  ?? null,
    nextWorker:     opts.nextWorker     ?? null,
    children:       opts.children       ?? [],
    lastProgress:   opts.lastProgress   ?? null,
    lastSyncAt:     opts.lastSyncAt     ?? _now(),
    createdAt:      opts.createdAt      ?? _now(),
    updatedAt:      opts.updatedAt      ?? _now(),
  };
}

/**
 * 从纯对象恢复 TeamObject（用于反序列化后校验）
 * @param {Partial<TeamObject>} obj
 * @returns {TeamObject}
 */
function hydrateTeamObject(obj) {
  return {
    objective:     obj.objective     ?? '',
    phase:         obj.phase         ?? TeamObjectPhase.PLANNING,
    status:        obj.status        ?? TeamObjectStatus.QUEUED,
    lead:          obj.lead          ?? null,
    support:       obj.support       ?? [],
    verify:        obj.verify        ?? [],
    review:        obj.review        ?? [],
    currentWorker: obj.currentWorker ?? null,
    nextWorker:    obj.nextWorker    ?? null,
    children:      obj.children      ?? [],
    lastProgress:  obj.lastProgress  ?? null,
    lastSyncAt:    obj.lastSyncAt    ?? _now(),
    createdAt:     obj.createdAt     ?? _now(),
    updatedAt:     obj.updatedAt     ?? _now(),
  };
}

/**
 * 获取 TeamObject（从 store 中读取并校验）
 * @param {Record<string, TeamObject>} store
 * @param {string} id
 * @returns {TeamObject|null}
 */
function getTeamObject(store, id) {
  const obj = store[id];
  if (!obj) return null;
  return hydrateTeamObject(obj);
}

/**
 * 更新 TeamObject（完整替换 children 以外字段）
 * @param {Record<string, TeamObject>} store
 * @param {string} id
 * @param {Partial<TeamObject>} patch
 * @returns {TeamObject}
 */
function updateTeamObject(store, id, patch) {
  const existing = getTeamObject(store, id);
  if (!existing) throw new Error(`updateTeamObject: id "${id}" not found`);
  const updated = { ...existing, ...patch, updatedAt: _now(), lastSyncAt: _now() };
  store[id] = updated;
  return updated;
}

/**
 * 打补丁子智能体（按 agentId 匹配）
 * @param {Record<string, TeamObject>} store
 * @param {string} teamId
 * @param {string} agentId
 * @param {Partial<TeamChild>} patch
 * @returns {TeamChild}
 */
function patchChild(store, teamId, agentId, patch) {
  const team = getTeamObject(store, teamId);
  if (!team) throw new Error(`patchChild: team "${teamId}" not found`);
  const idx = team.children.findIndex(c => c.agentId === agentId);
  if (idx === -1) throw new Error(`patchChild: child agentId "${agentId}" not found in team "${teamId}"`);
  team.children[idx] = { ...team.children[idx], ...patch, lastActivityAt: _now() };
  team.updatedAt = _now();
  team.lastSyncAt = _now();
  store[teamId] = team;
  return team.children[idx];
}

/**
 * 添加子智能体
 * @param {Record<string, TeamObject>} store
 * @param {string} teamId
 * @param {TeamChild} child
 * @returns {TeamChild}
 */
function addChild(store, teamId, child) {
  const team = getTeamObject(store, teamId);
  if (!team) throw new Error(`addChild: team "${teamId}" not found`);
  const exists = team.children.some(c => c.agentId === child.agentId);
  if (exists) throw new Error(`addChild: child agentId "${child.agentId}" already exists`);
  team.children.push({ ...child, lastActivityAt: _now() });
  team.updatedAt = _now();
  team.lastSyncAt = _now();
  store[teamId] = team;
  return child;
}

/**
 * 移除子智能体
 * @param {Record<string, TeamObject>} store
 * @param {string} teamId
 * @param {string} agentId
 * @returns {boolean} 是否移除成功
 */
function removeChild(store, teamId, agentId) {
  const team = getTeamObject(store, teamId);
  if (!team) throw new Error(`removeChild: team "${teamId}" not found`);
  const before = team.children.length;
  team.children = team.children.filter(c => c.agentId !== agentId);
  if (team.children.length === before) return false;
  team.updatedAt = _now();
  team.lastSyncAt = _now();
  store[teamId] = team;
  return true;
}

module.exports = {
  TeamObjectStatus,
  TeamObjectPhase,
  TeamChildRole,
  createTeamObject,
  getTeamObject,
  updateTeamObject,
  patchChild,
  addChild,
  removeChild,
  hydrateTeamObject,
};
