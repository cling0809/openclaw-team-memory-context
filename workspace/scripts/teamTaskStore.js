/**
 * teamTaskStore.js — 统一任务状态源
 *
 * 小龙团队任务的权威状态存储：
 * - 子龙生命周期追踪（start/progress/done/fail/timeout/handoff）
 * - 落盘持久化到 ~/.openclaw/team-task-store.json
 * - 超时兜底机制
 * - 订阅变更通知
 *
 * 依赖：
 *   createStore  ← ./state.js
 *   sequential   ← ./sequential.js
 *   emitChange   ← ./onChange.js
 *   OpenClawError← ./errors.js
 */

const fs = require('fs/promises')
const path = require('path')
const { createStore } = require('./state')
const { sequential } = require('./sequential')
const { emitChange } = require('./onChange')
const { OpenClawError } = require('./errors')

const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(process.env.HOME || '', '.openclaw')

// ============================================================================
// 常量
// ============================================================================

const STORE_FILE = path.join(OPENCLAW_HOME, 'team-task-store.json')
const TIMEOUT_CHECK_INTERVAL_MS = 10_000

// ============================================================================
// 错误类型
// ============================================================================

class TaskStoreError extends OpenClawError {
  constructor(message, { taskId, agentId, cause } = {}) {
    super(message)
    this.taskId = taskId
    this.agentId = agentId
    this.cause = cause
  }
}

// ============================================================================
// 子龙超时兜底
// ============================================================================

/**
 * 超时记录项
 * @typedef {{ timer: NodeJS.Timeout, maxAgeMs: number, startedAt: number }} TimeoutEntry
 */

/** @type {Map<string, TimeoutEntry>} agentId → timeout entry */
const _timeoutMap = new Map()

/** @type {NodeJS.Timeout|null} */
let _timeoutInterval = null

// ============================================================================
// 内部状态（singleton）
// ============================================================================

/** @type {ReturnType<typeof createStore>|null} */
let _store = null

/** @type {ReturnType<typeof sequential>|null} */
const _writeFile = sequential(async (taskObj) => {
  await fs.mkdir(path.dirname(STORE_FILE), { recursive: true })
  await fs.writeFile(STORE_FILE, JSON.stringify(taskObj, null, 2), 'utf-8')
})

// 任务对象引用，用于差异对比
let _prevSnapshot = null

/** @type {Map<string, Map<string, string>>} taskId → (fromId + '_' + toId) → reason */
const _handoffReasons = new Map()

// ============================================================================
// Store 创建
// ============================================================================

function _initStore(taskObj) {
  _store = createStore(taskObj, ({ newState, oldState }) => {
    emitChange(oldState, newState)
    _prevSnapshot = oldState
    // 异步落盘，不阻塞事件循环
    _writeFile(newState).catch((err) => {
      console.error('[teamTaskStore] 落盘失败:', err)
    })
  })
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成短 ID
 * @returns {string}
 */
function _genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/**
 * 获取子龙在 children 数组中的索引
 * @param {string} taskId
 * @param {string} agentId
 * @returns {number}
 */
function _findChildIndex(children, agentId) {
  return children.findIndex((c) => c.agentId === agentId)
}

/**
 * 检查子龙是否处于可写状态（避免竞态）
 * @param {object} child
 * @param {string} expectedStatus
 */
function _checkChildStatus(child, expectedStatus, agentId, taskId) {
  if (!child) {
    throw new TaskStoreError(`子龙不存在: ${agentId}`, { taskId, agentId })
  }
  if (child.status !== expectedStatus) {
    throw new TaskStoreError(
      `子龙状态非法: agentId=${agentId} expected=${expectedStatus} actual=${child.status}`,
      { taskId, agentId }
    )
  }
}

/**
 * 启动超时检查定时器（懒启动，仅启动一次）
 */
function _ensureTimeoutInterval() {
  if (_timeoutInterval !== null) return
  _timeoutInterval = setInterval(() => {
    if (!_store) return
    const task = _store.getState()
    const now = Date.now()
    for (const child of task.children) {
      const entry = _timeoutMap.get(child.agentId)
      if (!entry) continue
      // 只检查 running 的子龙
      if (child.status !== 'running') {
        _timeoutMap.delete(child.agentId)
        continue
      }
      if (now - entry.startedAt > entry.maxAgeMs) {
        _applyChildStateChange(task, child.agentId, {
          status: 'timed_out',
          lastActivityAt: new Date().toISOString(),
        })
      }
    }
  }, TIMEOUT_CHECK_INTERVAL_MS)
  // Node 进程退出时清理定时器
  _timeoutInterval.unref()
}

/**
 * 在 store 上应用子龙状态变更（内部原子操作）
 * @param {object} task - 最新任务快照
 * @param {string} agentId
 * @param {object} patch - 部分字段覆盖
 * @param {boolean} recompute - 是否触发任务整体状态重算（默认 true）
 */
function _applyChildStateChange(task, agentId, patch, recompute = true) {
  if (!_store) return
  const idx = _findChildIndex(task.children, agentId)
  if (idx === -1) return
  const updatedChildren = task.children.slice()
  updatedChildren[idx] = { ...updatedChildren[idx], ...patch }
  if (!recompute) {
    _store.setState({ ...task, children: updatedChildren, updatedAt: new Date().toISOString() })
    return
  }
  const nextTask = { ...task, children: updatedChildren, updatedAt: new Date().toISOString() }
  // 重算任务整体状态
  const statuses = nextTask.children.map((c) => c.status)
  if (statuses.length === 0) {
    Object.assign(nextTask, { phase: 'init', status: 'idle' })
  } else if (statuses.every((s) => s === 'done')) {
    Object.assign(nextTask, { phase: 'done', status: 'done' })
  } else if (statuses.every((s) => ['failed', 'timed_out', 'aborted'].includes(s))) {
    Object.assign(nextTask, { phase: 'failed', status: 'failed' })
  } else if (statuses.some((s) => s === 'running' || s === 'queued')) {
    Object.assign(nextTask, { phase: 'running', status: 'running' })
  } else {
    Object.assign(nextTask, { phase: 'partial', status: 'partial' })
  }
  _store.setState(nextTask)
}

// ============================================================================
// 公开 API：创建 / 加载
// ============================================================================

/**
 * 创建新任务
 * @param {string} objective
 * @param {{ lead?: string, support?: string, verify?: string, review?: string }} roles
 * @returns {string} taskId
 */
function createTask(objective, roles = {}) {
  const taskId = _genId()
  const now = new Date().toISOString()
  const taskObj = {
    id: taskId,
    objective,
    createdAt: now,
    updatedAt: now,
    phase: 'init',
    status: 'idle',
    lead: roles.lead || null,
    support: roles.support || null,
    verify: roles.verify || null,
    review: roles.review || null,
    children: [],
    currentWorker: null,
    nextWorker: null,
    lastProgress: null,
    lastSyncAt: now,
  }
  _initStore(taskObj)
  return taskId
}

/**
 * 加载指定 taskId 的任务（从当前内存中查找）
 * @param {string} taskId
 * @returns {object|null}
 */
function loadTask(taskId) {
  if (!_store) return null
  const t = _store.getState()
  return t.id === taskId ? t : null
}

/**
 * 从磁盘加载任务（进程重启后调用）
 * @returns {object|null}
 */
function loadCurrentTask() {
  try {
    const raw = require(STORE_FILE)
    if (raw && raw.id) {
      _initStore(raw)
      _prevSnapshot = null
      return raw
    }
  } catch {
    // 文件不存在或解析失败
  }
  return null
}

// ============================================================================
// 公开 API：子龙生命周期
// ============================================================================

/**
 * 子龙开始执行
 * queued → running
 */
function startChild(taskId, agentId, role, sessionKey) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  const idx = _findChildIndex(task.children, agentId)
  if (idx !== -1) {
    // 已存在：支持重启（done→running 或 failed→running）
    const child = task.children[idx]
    if (!['done', 'failed', 'timed_out', 'aborted', 'queued'].includes(child.status)) {
      throw new TaskStoreError(
        `子龙状态非法，start 前必须是 queued/done/failed/timed_out/aborted，实际=${child.status}`,
        { taskId, agentId }
      )
    }
    const updatedChildren = task.children.slice()
    updatedChildren[idx] = {
      ...child,
      role: role || child.role,
      sessionKey: sessionKey || child.sessionKey,
      status: 'running',
      lastActivityAt: new Date().toISOString(),
    }
    _store.setState({
      ...task,
      children: updatedChildren,
      currentWorker: agentId,
      nextWorker: null,
      updatedAt: new Date().toISOString(),
    })
    return
  }
  // 新子龙
  const newChild = {
    agentId,
    role: role || 'unknown',
    sessionKey: sessionKey || '',
    status: 'running',
    taskSummary: null,
    lastActivityAt: new Date().toISOString(),
    resultDigest: null,
    error: null,
  }
  _store.setState({
    ...task,
    children: [...task.children, newChild],
    currentWorker: agentId,
    nextWorker: null,
    updatedAt: new Date().toISOString(),
  })
  const updated = _store.getState()
  _recomputeTaskStatus(updated, agentId)


/**
 * 子龙进度上报
 * running + lastActivityAt 更新
 */
function progressChild(taskId, agentId, summary) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  const child = task.children[_findChildIndex(task.children, agentId)]
  _checkChildStatus(child, 'running', agentId, taskId)
  _applyChildStateChange(task, agentId, {
    taskSummary: summary || child.taskSummary,
    lastActivityAt: new Date().toISOString(),
  })
  _store.setState({ ...task, lastProgress: summary, lastSyncAt: new Date().toISOString() })
}

/**
 * 子龙完成
 * running → done
 */
function doneChild(taskId, agentId, resultDigest) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  const child = task.children[_findChildIndex(task.children, agentId)]
  _checkChildStatus(child, 'running', agentId, taskId)
  _timeoutMap.delete(agentId)
  _applyChildStateChange(task, agentId, {
    status: 'done',
    resultDigest: resultDigest || null,
    lastActivityAt: new Date().toISOString(),
  })
}

/**
 * 子龙失败
 * running → failed
 */
function failChild(taskId, agentId, error) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  const child = task.children[_findChildIndex(task.children, agentId)]
  _checkChildStatus(child, 'running', agentId, taskId)
  _timeoutMap.delete(agentId)
  const errorMessage = error instanceof Error ? error.message : String(error || 'unknown')
  _applyChildStateChange(task, agentId, {
    status: 'failed',
    error: errorMessage,
    lastActivityAt: new Date().toISOString(),
  })
}

/**
 * 子龙超时（被动触发，由 enforceTimeout 调用）
 * running → timed_out
 */
function timeoutChild(taskId, agentId) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  const child = task.children[_findChildIndex(task.children, agentId)]
  if (!child) return
  if (child.status !== 'running') return
  _timeoutMap.delete(agentId)
  _applyChildStateChange(task, agentId, {
    status: 'timed_out',
    lastActivityAt: new Date().toISOString(),
  })
}

/**
 * 子龙交接
 * currentWorker 切换 + 记录原因
 */
function handoffChild(taskId, fromAgentId, toAgentId, reason) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  const fromChild = task.children[_findChildIndex(task.children, fromAgentId)]
  if (!fromChild) {
    throw new TaskStoreError(`源子龙不存在: ${fromAgentId}`, { taskId, agentId: fromAgentId })
  }
  // 记录交接原因
  if (!task.id) return
  let reasonsMap = _handoffReasons.get(task.id)
  if (!reasonsMap) {
    reasonsMap = new Map()
    _handoffReasons.set(task.id, reasonsMap)
  }
  const key = `${fromAgentId}_${toAgentId}`
  reasonsMap.set(key, reason || 'no reason')
  // 更新 nextWorker
  _store.setState({ ...task, nextWorker: toAgentId, updatedAt: new Date().toISOString() })
}

// ============================================================================
// 公开 API：查询
// ============================================================================

/**
 * 获取所有子龙
 */
function getChildren(taskId) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  return task.children
}

/**
 * 获取任务整体状态
 * - idle: 无子龙运行
 * - running: 有子龙运行中
 * - done: 全部完成
 * - failed: 全部失败
 * - partial: 部分完成（混合）
 */
function getStatus(taskId) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  if (task.children.length === 0) return 'idle'
  const statuses = task.children.map((c) => c.status)
  if (statuses.length === 1) {
    const s = statuses[0]
    if (s === 'done') return 'done'
    if (s === 'failed' || s === 'timed_out' || s === 'aborted') return 'failed'
    if (s === 'running' || s === 'queued') return 'running'
  }
  const hasRunning = statuses.some((s) => s === 'running' || s === 'queued')
  if (hasRunning) return 'running'
  return 'partial'
}

/**
 * 获取下一个待执行的 worker
 */
function getNextWorker(taskId) {
  const task = _store.getState()
  if (task.id !== taskId) throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  return task.nextWorker || null
}

/**
 * 获取交接原因
 */
function getHandoffReason(taskId, fromAgentId, toAgentId) {
  const reasonsMap = _handoffReasons.get(taskId)
  if (!reasonsMap) return null
  return reasonsMap.get(`${fromAgentId}_${toAgentId}`) || null
}

// ============================================================================
// 公开 API：超时兜底
// ============================================================================

/**
 * 为子龙设置超时定时器
 * 如果超时尚未收到 done/fail 回调，自动标记为 timed_out
 *
 * @param {string} taskId
 * @param {string} agentId
 * @param {number} maxAgeMs - 最大存活时间（毫秒）
 */
function enforceTimeout(taskId, agentId, maxAgeMs) {
  const task = _store.getState()
  if (task.id !== taskId) {
    throw new TaskStoreError(`任务不存在: ${taskId}`, { taskId })
  }
  const child = task.children[_findChildIndex(task.children, agentId)]
  if (!child) {
    throw new TaskStoreError(`子龙不存在: ${agentId}`, { taskId, agentId })
  }
  if (child.status !== 'running') return
  _ensureTimeoutInterval()
  _timeoutMap.set(agentId, {
    timer: null,
    maxAgeMs,
    startedAt: Date.now(),
  })
}

// ============================================================================
// 公开 API：订阅
// ============================================================================

/**
 * 订阅任务变化
 * @param {string} taskId
 * @param {Function} listener - (prev, next) => void
 * @returns {Function} unsubscribe
 */
function subscribe(taskId, listener) {
  if (!_store) {
    throw new TaskStoreError('Store 未初始化，请先调用 createTask 或 loadCurrentTask')
  }
  // state.js 的 listener() 不传参，包一层注入 newState
  return _store.subscribe(() => listener(_store.getState()))
}

// ============================================================================
// 内部辅助
// ============================================================================

/**
 * 根据子龙状态重算任务整体 phase / status
 */
function _recomputeTaskStatus(task, changedAgentId) {
  const children = task.children
  if (children.length === 0) {
    _store.setState({ ...task, phase: 'init', status: 'idle', updatedAt: new Date().toISOString() })
    return
  }
  const statuses = children.map((c) => c.status)
  const allDone = statuses.every((s) => s === 'done')
  const allFailed = statuses.every((s) =>
    ['failed', 'timed_out', 'aborted'].includes(s)
  )
  const anyRunning = statuses.some((s) => s === 'running')
  let phase = task.phase
  let status = task.status
  if (allDone) {
    phase = 'done'
    status = 'done'
  } else if (allFailed) {
    phase = 'failed'
    status = 'failed'
  } else if (anyRunning) {
    phase = 'running'
    status = 'running'
  } else {
    phase = 'partial'
    status = 'partial'
  }
  _store.setState({ ...task, phase, status, updatedAt: new Date().toISOString() })
}

// ============================================================================
// 导出
// ============================================================================

module.exports = {
  createTask,
  loadTask,
  loadCurrentTask,
  startChild,
  progressChild,
  doneChild,
  failChild,
  timeoutChild,
  handoffChild,
  getChildren,
  getStatus,
  getNextWorker,
  getHandoffReason,
  enforceTimeout,
  subscribe,
  // 导出错误类型供外部使用
  TaskStoreError,
}
