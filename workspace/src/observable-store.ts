/**
 * Observable Store - 统一状态管理
 *
 * 将散落的 globalThis[Symbol.for("openclaw.xxx")] 收口到一个统一的 Store 模式。
 * 参考 Claude Code src/state/store.ts 的实现。
 *
 * @module observable-store
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const OPENCLAW_HOME = () => process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? '', '.openclaw')

// ─── 核心类型 ────────────────────────────────────────────────────────────────

export type Store<T> = {
  /** 获取当前状态 */
  getState: () => T
  /**
   * 更新状态
   *
   * 支持两种形式：
   * - setState(partialState)：对普通对象做浅展开合并（默认 merge=true）
   * - setState(updaterFn)：updater 返回值直接替换状态（需显式 { merge: false }）
   *
   * @param updater - 部分状态对象或 updater 函数
   * @param options - merge: true（默认）做浅合并；merge: false 则 updater 返回值全量替换
   */
  setState: (
    updater: Partial<T> | ((prev: T) => T | Partial<T>),
    options?: { merge: boolean }
  ) => void
  /** 订阅状态变化，返回取消订阅函数 */
  subscribe: (listener: () => void) => () => void
}

type ChangeCallback<T> = (args: { newState: T; oldState: T }) => void

// ─── 模块级单例存储（避免 HMR 状态残留）────────────────────────────────────
//
// 使用 module-level 变量替代 globalThis[Symbol.for(...)]，原因：
// 1. Node.js HMR（热模块替换）时 globalThis 状态会残留，导致 reload 后
//    session/team/queue 状态不可预测
// 2. WeakMap 方案需要额外的 key 对象，且清理逻辑复杂
// 3. FinalizationRegistry 在 HMR 场景下也不可靠（模块卸载时机不确定）
//
// 最终方案：模块级变量 + replaceStore 显式替换，最简单可靠。
//
// ─────────────────────────────────────────────────────────────────────────────

let _teamStore: Store<TeamState> | undefined
let _queueStore: Store<QueueState> | undefined
let _sessionStore: Store<SessionState> | undefined

// ─── Store 工厂 ─────────────────────────────────────────────────────────────

/**
 * 创建响应式 Store
 * 
 * @param initialState - 初始状态
 * @param onChange - 状态变化回调（用于集中处理 side effect）
 * @returns Store 实例
 */
export function createStore<T>(
  initialState: T,
  onChange?: ChangeCallback<T>
): Store<T> {
  let state = initialState
  const listeners = new Set<() => void>()

  return {
    getState: () => state,

    setState: (updater, options) => {
      const prev = state
      // merge 默认为 true（浅合并），与历史行为一致；
      // 设置 merge: false 时 updater 必须返回完整新状态，不做合并
      const shouldMerge = options?.merge !== false

      let next: T
      if (typeof updater === 'function') {
        const result = (updater as (prev: T) => T | Partial<T>)(prev)
        // 【关键修复】：如果 updater 直接返回 prev，保持原引用，跳过无变化
        if (Object.is(result, prev)) return
        if (shouldMerge && result !== null && typeof result === 'object') {
          // 浅合并：{ ...prev, ...result }
          // 注意：仅一层浅合并，避免深度合并的复杂性和不确定性
          next = { ...prev, ...(result as Partial<T>) } as T
        } else {
          next = result as T
        }
      } else {
        // 直接传入部分状态对象，默认做浅合并
        next = shouldMerge
          ? { ...prev, ...(updater as Partial<T>) } as T
          : updater as T
      }

      // Object.is 跳过无变化状态，避免不必要的订阅通知
      if (Object.is(next, prev)) return
      state = next
      onChange?.({ newState: next, oldState: prev })
      listeners.forEach((l) => l())
    },

    subscribe: (listener) => {
      listeners.add(listener)
      // 返回取消订阅函数
      return () => listeners.delete(listener)
    },
  }
}

// ─── Team Store ─────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string
  name: string
  role: string
  status: 'online' | 'offline' | 'busy'
  lastSeen?: number
}

export interface TeamTask {
  id: string
  title: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'KILLED' | 'NEEDS_REWORK' | 'AWAITING_RET'
  assignee?: string
  createdAt: number
  updatedAt: number
  checkpoints?: Array<{ at: number; [key: string]: unknown }>
}

export interface TeamState {
  leadAgentId: string
  members: Record<string, TeamMember>
  tasks: Record<string, TeamTask>
  metadata: {
    teamName: string
    createdAt: number
    updatedAt: number
  }
}

function createTeamStore(): Store<TeamState> {
  const defaultState: TeamState = {
    leadAgentId: '',
    members: {},
    tasks: {},
    metadata: {
      teamName: 'default',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }

  return createStore(defaultState, ({ newState, oldState }) => {
    // 集中处理 side effect：持久化、通知、同步等
    newState.metadata.updatedAt = Date.now()
    // TODO: 触发 persistence、通知等 side effect
    console.debug('[TeamStore] state updated', {
      membersCount: Object.keys(newState.members).length,
      tasksCount: Object.keys(newState.tasks).length,
    })
  })
}

// ─── CommandQueue Store ──────────────────────────────────────────────────────

export interface QueueLane {
  id: string
  name: string
  priority: number
  commands: Array<{
    id: string
    tool: string
    args: unknown
    status: 'pending' | 'running' | 'done' | 'failed'
    createdAt: number
  }>
}

export interface QueueState {
  lanes: Record<string, QueueLane>
  activeLaneId: string | null
  metadata: {
    createdAt: number
    updatedAt: number
  }
}

function createQueueStore(): Store<QueueState> {
  const defaultState: QueueState = {
    lanes: {},
    activeLaneId: null,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }

  return createStore(defaultState, ({ newState }) => {
    newState.metadata.updatedAt = Date.now()
    // TODO: 触发队列调度、通知等 side effect
    console.debug('[QueueStore] state updated', {
      lanesCount: Object.keys(newState.lanes).length,
    })
  })
}

// ─── Session Store ───────────────────────────────────────────────────────────

export interface SessionEntry {
  sessionKey: string
  createdAt: number
  updatedAt: number
  messageCount: number
  metadata?: Record<string, unknown>
}

export interface SessionState {
  sessions: Record<string, SessionEntry>
  activeSessionKey: string | null
  metadata: {
    createdAt: number
    updatedAt: number
  }
}

function createSessionStore(): Store<SessionState> {
  const defaultState: SessionState = {
    sessions: {},
    activeSessionKey: null,
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  }

  return createStore(defaultState, ({ newState }) => {
    newState.metadata.updatedAt = Date.now()
    // TODO: 触发 session 持久化等 side effect
    console.debug('[SessionStore] state updated', {
      sessionsCount: Object.keys(newState.sessions).length,
    })
  })
}

// ─── 全局 Store 访问器 ──────────────────────────────────────────────────────

/**
 * 获取 Team Store（单例，模块级变量，HMR 安全）
 */
export function getTeamStore(): Store<TeamState> {
  if (!_teamStore) {
    _teamStore = createTeamStore()
  }
  return _teamStore
}

/**
 * 获取 Queue Store（单例，模块级变量，HMR 安全）
 */
export function getQueueStore(): Store<QueueState> {
  if (!_queueStore) {
    _queueStore = createQueueStore()
  }
  return _queueStore
}

/**
 * 获取 Session Store（单例，模块级变量，HMR 安全）
 */
export function getSessionStore(): Store<SessionState> {
  if (!_sessionStore) {
    _sessionStore = createSessionStore()
  }
  return _sessionStore
}

/**
 * 热更新：替换模块级 Store（用于测试或配置切换）
 *
 * HMR 时旧的 module-level 变量会被新模块覆盖，
 * 此函数保留用于显式的 Store 替换场景（如测试、配置热切换）。
 */
export function replaceStore<T>(key: 'team' | 'queue' | 'session', newStore: Store<T>): void {
  if (key === 'team') _teamStore = newStore as Store<TeamState>
  else if (key === 'queue') _queueStore = newStore as Store<QueueState>
  else if (key === 'session') _sessionStore = newStore as Store<SessionState>
}

// ─── Core Session Store 轮询代理 ───────────────────────────────────────────────

/**
 * Core Session Store 数据条目的 Core 格式
 * 对应 .jsonl 文件中的一行
 */
export interface CoreSessionEntry {
  sessionKey: string
  createdAt: number
  updatedAt: number
  messageCount: number
  metadata?: Record<string, unknown>
}

/**
 * 创建 Core Session Store 的轮询代理
 *
 * 将 Observable Session Store 与 Core 的 .jsonl 文件同步：
 * - 启动时从 Core 加载初始数据
 * - 定时轮询检测 Core 外部变化，有变化时同步到 Observable Store
 * - Observable Store 变化时写回 Core
 *
 * @param options.pollIntervalMs - 轮询间隔，默认 5000ms
 * @param options.sessionDir - Core session 目录，默认 $OPENCLAW_HOME/state/sessions
 * @returns Observable Session Store 实例
 *
 * @example
 * ```typescript
 * import { createCoreSessionStore } from './observable-store'
 *
 * // 创建并启动轮询代理
 * const store = await createCoreSessionStore({ pollIntervalMs: 3000 })
 *
 * // 读取状态
 * console.log(store.getState().sessions)
 *
 * // 更新状态（会自动写回 Core）
 * store.setState(prev => ({
 *   ...prev,
 *   activeSessionKey: 'my-session'
 * }))
 *
 * // 停止轮询
 * store.stopPolling?.()
 * ```
 */
export async function createCoreSessionStore(options?: {
  pollIntervalMs?: number
  sessionDir?: string
}): Promise<Store<SessionState> & { stopPolling?: () => void }> {
  const {
    pollIntervalMs = 5000,
    sessionDir = path.join(OPENCLAW_HOME(), 'state', 'sessions')
  } = options || {}

  // 动态导入 session-store-index（避免循环依赖）
  const { loadSessionIndex, findSessionFile, touchSession } = await import('./session-store-index')

  const observableStore = getSessionStore()

  // 追踪上次轮询时的索引状态（sessionKey -> mtime）
  let lastIndexState: Map<string, number> = new Map()
  let pollingTimer: ReturnType<typeof setInterval> | undefined
  let isDestroyed = false

  /**
   * 从 .jsonl 文件加载单个 session 的元数据
   * 只读取最后一行作为当前状态
   */
  async function loadSessionFromFile(sessionKey: string): Promise<SessionEntry | null> {
    try {
      const filePath = await findSessionFile(sessionKey)
      if (!filePath) return null

      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.trim().split('\n').filter(l => l.trim())
      if (lines.length === 0) return null

      const lastLine = lines[lines.length - 1]
      const entry: CoreSessionEntry = JSON.parse(lastLine)

      return {
        sessionKey: entry.sessionKey || sessionKey,
        createdAt: entry.createdAt || Date.now(),
        updatedAt: entry.updatedAt || Date.now(),
        messageCount: entry.messageCount || lines.length,
        metadata: entry.metadata,
      }
    } catch {
      return null
    }
  }

  /**
   * 从 Core 加载所有 session 数据到 Observable Store
   */
  async function syncFromCore(): Promise<void> {
    try {
      const index = await loadSessionIndex()
      const sessions: Record<string, SessionEntry> = {}
      let hasChanges = false

      for (const sessionKey of Object.keys(index.sessionKeys)) {
        const entry = await loadSessionFromFile(sessionKey)
        if (entry) {
          const prev = observableStore.getState().sessions[sessionKey]
          if (!prev || prev.updatedAt !== entry.updatedAt) {
            hasChanges = true
          }
          sessions[sessionKey] = entry
        }
      }

      // 只在有变化时更新
      if (hasChanges) {
        observableStore.setState(prev => {
          // 合并：保留不在 Core 中的 local-only sessions
          const mergedSessions = { ...prev.sessions, ...sessions }
          return {
            ...prev,
            sessions: mergedSessions,
            activeSessionKey: prev.activeSessionKey || Object.keys(sessions)[0] || null,
          }
        })
      }

      // 更新索引状态
      lastIndexState = new Map(
        Object.entries(index.sessionKeys).map(([k, v]) => [k, v.updatedAt])
      )
    } catch (err) {
      console.debug('[CoreSessionStore] syncFromCore error:', err)
    }
  }

  /**
   * 将 Observable Store 变化写回 Core
   */
  async function syncToCore(sessionKey: string, entry: SessionEntry): Promise<void> {
    try {
      const fileName = `${sessionKey}.jsonl`
      const filePath = path.join(sessionDir, fileName)

      // 确保目录存在
      await fs.mkdir(sessionDir, { recursive: true })

      // 追加到 .jsonl 文件
      const line = JSON.stringify({
        sessionKey: entry.sessionKey,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        messageCount: entry.messageCount,
        metadata: entry.metadata,
      }) + '\n'

      await fs.appendFile(filePath, line, 'utf8')

      // 更新索引
      await touchSession(sessionKey)
    } catch (err) {
      console.debug('[CoreSessionStore] syncToCore error:', err)
    }
  }

  /**
   * 轮询检查 Core 变化
   */
  async function poll(): Promise<void> {
    if (isDestroyed) return

    try {
      const index = await loadSessionIndex()

      for (const [sessionKey, idxEntry] of Object.entries(index.sessionKeys)) {
        const lastMtime = lastIndexState.get(sessionKey)
        if (lastMtime === undefined || idxEntry.updatedAt > lastMtime) {
          // 检测到外部变化，同步整个状态
          await syncFromCore()
          break
        }
      }
    } catch (err) {
      console.debug('[CoreSessionStore] poll error:', err)
    }
  }

  // 启动时同步一次
  await syncFromCore()

  // 启动轮询
  pollingTimer = setInterval(poll, pollIntervalMs)

  // 订阅 Observable Store 变化，写回 Core
  const unsubscribe = observableStore.subscribe(() => {
    const state = observableStore.getState()
    for (const [sessionKey, entry] of Object.entries(state.sessions)) {
      syncToCore(sessionKey, entry)
    }
  })

  // 返回 Store 实例附加 stopPolling 方法
  return {
    ...observableStore,
    stopPolling: () => {
      isDestroyed = true
      if (pollingTimer) {
        clearInterval(pollingTimer)
        pollingTimer = undefined
      }
      unsubscribe()
    },
  }
}

// ─── 使用示例 ────────────────────────────────────────────────────────────────

/**
 * @example
 * ```typescript
 * import { getTeamStore, createStore } from './observable-store'
 * 
 * // 获取 Team Store
 * const teamStore = getTeamStore()
 * 
 * // 读取状态
 * console.log(teamStore.getState().members)
 * 
 * // 更新状态
 * teamStore.setState(prev => ({
 *   ...prev,
 *   leadAgentId: 'agent-001',
 * }))
 * 
 * // 订阅变化
 * const unsubscribe = teamStore.subscribe(() => {
 *   console.log('Team state changed!')
 * })
 * 
 * // 取消订阅
 * unsubscribe()
 * 
 * // 也可以独立创建新的 Store
 * const customStore = createStore({ count: 0 }, ({ newState }) => {
 *   console.log('custom store changed:', newState)
 * })
 * customStore.setState(p => ({ count: p.count + 1 }))
 * ```
 */
