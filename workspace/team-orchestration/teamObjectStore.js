'use strict';

const fs   = require('fs');
const path = require('path');

const {
  TeamObjectStatus,
  TeamObjectPhase,
  createTeamObject,
  getTeamObject,
  updateTeamObject,
  patchChild,
  addChild,
  removeChild,
  hydrateTeamObject,
} = require('./TEAM_OBJECT_SCHEMA');

// ─── 持久化路径 ─────────────────────────────────────────────────────────────

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw');
const STORE_DIR  = process.env.OPENCLAW_TEAM_STATE_DIR || path.join(OPENCLAW_HOME, 'team-orchestrations');
const STORE_FILE = path.join(STORE_DIR, 'active.json');

// ─── 内存状态 ───────────────────────────────────────────────────────────────

/** @type {Record<string, import('./TEAM_OBJECT_SCHEMA').TeamObject>} */
let _store = {};

let _dirty = false;

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function _load() {
  if (!fs.existsSync(STORE_FILE)) {
    _store = {};
    return;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    // 反序列化：每个 value 用 hydrateTeamObject 补全
    _store = Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k, hydrateTeamObject(v)])
    );
  } catch (err) {
    console.error('[teamObjectStore] load failed, starting fresh:', err.message);
    _store = {};
  }
}

function _save() {
  if (!_dirty) return;
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(_store, null, 2), 'utf8');
    _dirty = false;
  } catch (err) {
    console.error('[teamObjectStore] save failed:', err.message);
    throw err;
  }
}

function _mark() { _dirty = true; }

// ─── 初始化 ─────────────────────────────────────────────────────────────────

/**
 * 初始化 store（幂等，可多次调用）
 * @returns {void}
 */
function init() {
  _load();
  // 每次 init 都顺手 persist，防止空文件干扰
  _save();
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

/**
 * 列出所有 team id
 * @returns {string[]}
 */
function listTeamIds() {
  return Object.keys(_store);
}

/**
 * 根据 id 获取 team object
 * @param {string} id
 * @returns {import('./TEAM_OBJECT_SCHEMA').TeamObject|null}
 */
function get(id) {
  return getTeamObject(_store, id);
}

/**
 * 创建新 team object
 * @param {string} id
 * @param {string} objective
 * @param {Partial<import('./TEAM_OBJECT_SCHEMA').TeamObject>} [extra]
 * @returns {import('./TEAM_OBJECT_SCHEMA').TeamObject}
 */
function create(id, objective, extra = {}) {
  if (_store[id]) throw new Error(`teamObjectStore.create: id "${id}" already exists`);
  const obj = createTeamObject({ objective, ...extra });
  _store[id] = obj;
  _mark();
  _save();
  return obj;
}

/**
 * 原子更新 team object 字段
 * @param {string} id
 * @param {Partial<import('./TEAM_OBJECT_SCHEMA').TeamObject>} patch
 * @returns {import('./TEAM_OBJECT_SCHEMA').TeamObject}
 */
function update(id, patch) {
  const result = updateTeamObject(_store, id, patch);
  _mark();
  _save();
  return result;
}

/**
 * 删除 team object
 * @param {string} id
 * @returns {boolean} 是否删除成功
 */
function remove(id) {
  if (!_store[id]) return false;
  delete _store[id];
  _mark();
  _save();
  return true;
}

// ─── Child 操作 ─────────────────────────────────────────────────────────────

/**
 * 为指定 team 添加子智能体
 * @param {string} teamId
 * @param {import('./TEAM_OBJECT_SCHEMA').TeamChild} child
 * @returns {import('./TEAM_OBJECT_SCHEMA').TeamChild}
 */
function addChildToTeam(teamId, child) {
  const result = addChild(_store, teamId, child);
  _mark();
  _save();
  return result;
}

/**
 * 为指定 team 打补丁子智能体
 * @param {string} teamId
 * @param {string} agentId
 * @param {Partial<import('./TEAM_OBJECT_SCHEMA').TeamChild>} patch
 * @returns {import('./TEAM_OBJECT_SCHEMA').TeamChild}
 */
function patchChildInTeam(teamId, agentId, patch) {
  const result = patchChild(_store, teamId, agentId, patch);
  _mark();
  _save();
  return result;
}

/**
 * 为指定 team 移除子智能体
 * @param {string} teamId
 * @param {string} agentId
 * @returns {boolean}
 */
function removeChildFromTeam(teamId, agentId) {
  const result = removeChild(_store, teamId, agentId);
  _mark();
  _save();
  return result;
}

/**
 * 列出指定 team 的所有子智能体
 * @param {string} teamId
 * @returns {import('./TEAM_OBJECT_SCHEMA').TeamChild[]}
 */
function listChildren(teamId) {
  const team = getTeamObject(_store, teamId);
  return team ? team.children : [];
}

// ─── 批量 / 原子事务 ────────────────────────────────────────────────────────

/**
 * 批量更新（在 fn 内可多次调用 update/addChild 等，最后统一 save）
 * @param {() => void} fn
 */
function transaction(fn) {
  _dirty = false; // 暂缓写入，由 fn 内的操作触发 _mark/_save
  try {
    fn();
    if (_dirty) _save();
  } catch (err) {
    // transaction 失败不保存
    throw err;
  }
}

// ─── 状态查询便捷方法 ───────────────────────────────────────────────────────

/**
 * 返回所有处于指定状态的 team id
 * @param {string} status
 * @returns {string[]}
 */
function findByStatus(status) {
  return Object.entries(_store)
    .filter(([, v]) => v.status === status)
    .map(([k]) => k);
}

/**
 * 返回所有处于指定阶段的 team id
 * @param {string} phase
 * @returns {string[]}
 */
function findByPhase(phase) {
  return Object.entries(_store)
    .filter(([, v]) => v.phase === phase)
    .map(([k]) => k);
}

/**
 * 返回所有过期的（lastSyncAt 超过 maxAgeMs）team id
 * @param {number} maxAgeMs
 * @returns {string[]}
 */
function findStale(maxAgeMs) {
  const cutoff = Date.now() - maxAgeMs;
  return Object.entries(_store)
    .filter(([, v]) => (v.lastSyncAt ?? 0) < cutoff)
    .map(([k]) => k);
}

// ─── 导出 ─────────────────────────────────────────────────────────────────

module.exports = {
  init,
  listTeamIds,
  get,
  create,
  update,
  remove,
  addChildToTeam,
  patchChildInTeam,
  removeChildFromTeam,
  listChildren,
  transaction,
  findByStatus,
  findByPhase,
  findStale,
  // 供测试用的原始内存引用（不要直接修改）
  _store,
};
