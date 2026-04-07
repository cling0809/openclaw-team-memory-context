/**
 * Store onChange choke point — 集中处理所有 Store 变化的 side effect
 *
 * 对标 Claude Code src/state/onChangeAppState.ts 的角色：
 * - 字段级 diff：每个 if 块只比较自己关心的字段，prev/next 双变量明确比较
 * - 跨字段联动：组合变化只触发一次联合通知
 * - Gateway 推送真实化：通过内部 HTTP API 推送状态变化
 *
 * @module store-choke
 */

import { getTeamStore, getQueueStore, getSessionStore } from './observable-store'
import type { TeamState, QueueState, SessionState } from './observable-store'
import { configRefreshSignal } from './config-signal'

export interface StoreChokeConfig {
  /** 是否启用团队状态持久化 */
  persistTeam?: boolean
  /** 是否启用队列事件广播 */
  broadcastQueue?: boolean
  /** 是否启用 session 变化通知 gateway */
  notifyGateway?: boolean
  /** Gateway push URL（notifyGateway=true 时需要，例：http://localhost:8765） */
  gatewayUrl?: string
  /** Gateway auth token */
  gatewayToken?: string
}

type UnsubscribeFn = () => void

const _unsubscribers: UnsubscribeFn[] = []
let _isInitialized = false

// 内部分享给所有 subscribe handler 的全局配置（init 后填充）
let _gatewayUrl = ''
let _gatewayToken = ''

// ─── 公开 API ───────────────────────────────────────────────────────────────

/**
 * 初始化 onChange choke point
 *
 * 在 gateway 或 app 启动时调用一次即可。
 * 内部管理所有 Store 的订阅生命周期。
 *
 * @example
 * import { initStoreChoke } from './store-choke'
 * initStoreChoke({ persistTeam: true, notifyGateway: true, gatewayUrl: 'http://localhost:8765' })
 */
export function initStoreChoke(config: StoreChokeConfig = {}): void {
  if (_isInitialized) {
    console.debug('[StoreChoke] already initialized, skipping')
    return
  }

  _gatewayUrl = config.gatewayUrl ?? ''
  _gatewayToken = config.gatewayToken ?? ''

  const { persistTeam = true, broadcastQueue = false, notifyGateway = false } = config

  // ── Team Store choke ──────────────────────────────────────────
  const teamStore = getTeamStore()
  _unsubscribers.push(_subscribeTeamStore(teamStore, persistTeam, notifyGateway))

  // ── Queue Store choke ─────────────────────────────────────────
  const queueStore = getQueueStore()
  _unsubscribers.push(_subscribeQueueStore(queueStore, broadcastQueue, notifyGateway))

  // ── Session Store choke ───────────────────────────────────────
  const sessionStore = getSessionStore()
  _unsubscribers.push(_subscribeSessionStore(sessionStore, notifyGateway))

  _isInitialized = true
  console.debug('[StoreChoke] initialized', { config })
}

/**
 * 销毁所有订阅（用于 graceful shutdown）
 */
export function destroyStoreChoke(): void {
  _unsubscribers.forEach((unsub) => unsub())
  _unsubscribers.length = 0
  _isInitialized = false
  _gatewayUrl = ''
  _gatewayToken = ''
  console.debug('[StoreChoke] destroyed')
}

/**
 * 重置初始化状态（用于测试或 HMR 场景）
 */
export function resetStoreChoke(): void {
  destroyStoreChoke()
  _isInitialized = false
}

// ─── Team Store handler（字段级 diff）───────────────────────────────────────

/**
 * Team Store 的 onChange handler。
 *
 * 参考 Claude Code onChangeAppState.ts 的写法：
 * - 每个 if 块只比较自己关心的字段，prev/next 双变量明确比较
 * - 跨字段联动：leadAgentId + members 变化合并为一次 team_update 推送
 */
function _subscribeTeamStore(
  store: ReturnType<typeof getTeamStore>,
  persistTeam: boolean,
  notifyGateway: boolean,
): UnsubscribeFn {
  let prevState: TeamState | undefined

  return store.subscribe(() => {
    const nextState = store.getState()

    // 首次调用：建立 baseline，不触发任何 side effect
    if (prevState === undefined) {
      prevState = nextState
      return
    }

    // ── 字段级 diff ───────────────────────────────────────────

    // leadAgentId 变化
    if (prevState.leadAgentId !== nextState.leadAgentId) {
      console.debug('[StoreChoke/Team] leadAgentId changed', {
        from: prevState.leadAgentId,
        to: nextState.leadAgentId,
      })
      // 可以触发 lead 变更通知、任务重新分配等
    }

    // members 变化（引用级别检测，由内部 task/member 对象内容驱动）
    const membersChanged = prevState.members !== nextState.members
    if (membersChanged) {
      const prevKeys = Object.keys(prevState.members)
      const nextKeys = Object.keys(nextState.members)
      const joined = nextKeys.filter((k) => !prevKeys.includes(k))
      const left = prevKeys.filter((k) => !nextKeys.includes(k))
      if (joined.length > 0 || left.length > 0) {
        console.debug('[StoreChoke/Team] members changed', { joined, left })
      }
    }

    // tasks 变化
    const tasksChanged = prevState.tasks !== nextState.tasks
    if (tasksChanged) {
      const prevKeys = Object.keys(prevState.tasks)
      const nextKeys = Object.keys(nextState.tasks)
      const added = nextKeys.filter((k) => !prevKeys.includes(k))
      const removed = prevKeys.filter((k) => !nextKeys.includes(k))
      const runningTasks = Object.values(nextState.tasks).filter(
        (t) => t.status === 'RUNNING',
      )
      console.debug('[StoreChoke/Team] tasks changed', {
        added,
        removed,
        runningCount: runningTasks.length,
      })
    }

    // metadata.updatedAt 变化（不代表业务字段变化，仅做审计）
    const metaUpdated = prevState.metadata.updatedAt !== nextState.metadata.updatedAt

    // ── 跨字段联动：leadAgentId + members 组合变化 → 只推一次 team_update ──
    const teamCoreChanged =
      prevState.leadAgentId !== nextState.leadAgentId ||
      prevState.members !== nextState.members ||
      prevState.tasks !== nextState.tasks

    // ── Side effect 触发 ───────────────────────────────────────

    if (persistTeam && teamCoreChanged) {
      _persistTeamState(nextState)
    }

    if (notifyGateway && teamCoreChanged) {
      _pushToGateway('team', {
        type: 'team_update',
        payload: {
          leadAgentId: nextState.leadAgentId,
          membersCount: Object.keys(nextState.members).length,
          tasksCount: Object.keys(nextState.tasks).length,
          // 传递变化摘要而非全量 state，减少 payload
          changedFields: {
            leadAgentId: prevState.leadAgentId !== nextState.leadAgentId,
            members: prevState.members !== nextState.members,
            tasks: prevState.tasks !== nextState.tasks,
          },
          ts: Date.now(),
        },
      })
    }

    // metadata.updatedAt 单独记录，不触发 gateway
    if (metaUpdated && !teamCoreChanged) {
      // 只有 metadata.updatedAt 变，说明只有心跳，无业务变化
      console.debug('[StoreChoke/Team] heartbeat tick', {
        updatedAt: nextState.metadata.updatedAt,
      })
    }

    prevState = nextState
  })
}

// ─── Queue Store handler（字段级 diff）──────────────────────────────────────

function _subscribeQueueStore(
  store: ReturnType<typeof getQueueStore>,
  broadcastQueue: boolean,
  notifyGateway: boolean,
): UnsubscribeFn {
  let prevState: QueueState | undefined

  return store.subscribe(() => {
    const nextState = store.getState()

    if (prevState === undefined) {
      prevState = nextState
      return
    }

    // activeLaneId 变化
    const activeLaneChanged = prevState.activeLaneId !== nextState.activeLaneId
    if (activeLaneChanged) {
      console.debug('[StoreChoke/Queue] activeLane changed', {
        from: prevState.activeLaneId,
        to: nextState.activeLaneId,
      })
    }

    // lanes 变化（引用级别；新增/移除/深度变化视为变化）
    const lanesChanged = prevState.lanes !== nextState.lanes
    if (lanesChanged) {
      const prevKeys = Object.keys(prevState.lanes)
      const nextKeys = Object.keys(nextState.lanes)
      const added = nextKeys.filter((k) => !prevKeys.includes(k))
      const removed = prevKeys.filter((k) => !nextKeys.includes(k))
      console.debug('[StoreChoke/Queue] lanes changed', { added, removed })
    }

    const queueCoreChanged = activeLaneChanged || lanesChanged

    if (broadcastQueue && queueCoreChanged) {
      _broadcastQueue(nextState)
    }

    if (notifyGateway && queueCoreChanged) {
      _pushToGateway('queue', {
        type: 'queue_update',
        payload: {
          activeLaneId: nextState.activeLaneId,
          lanesCount: Object.keys(nextState.lanes).length,
          changedFields: {
            activeLaneId: activeLaneChanged,
            lanes: lanesChanged,
          },
          ts: Date.now(),
        },
      })
    }

    prevState = nextState
  })
}

// ─── Session Store handler（字段级 diff）────────────────────────────────────

function _subscribeSessionStore(
  store: ReturnType<typeof getSessionStore>,
  notifyGateway: boolean,
): UnsubscribeFn {
  let prevState: SessionState | undefined

  return store.subscribe(() => {
    const nextState = store.getState()

    if (prevState === undefined) {
      prevState = nextState
      return
    }

    // activeSessionKey 变化
    const activeSessionChanged =
      prevState.activeSessionKey !== nextState.activeSessionKey
    if (activeSessionChanged) {
      console.debug('[StoreChoke/Session] activeSession changed', {
        from: prevState.activeSessionKey,
        to: nextState.activeSessionKey,
      })
    }

    // sessions 引用变化
    const sessionsChanged = prevState.sessions !== nextState.sessions
    if (sessionsChanged) {
      const prevKeys = Object.keys(prevState.sessions)
      const nextKeys = Object.keys(nextState.sessions)
      const added = nextKeys.filter((k) => !prevKeys.includes(k))
      const removed = prevKeys.filter((k) => !nextKeys.includes(k))
      console.debug('[StoreChoke/Session] sessions changed', {
        added,
        removed,
        totalCount: nextKeys.length,
      })
    }

    const sessionCoreChanged = activeSessionChanged || sessionsChanged

    if (notifyGateway && sessionCoreChanged) {
      _pushToGateway('session', {
        type: 'session_update',
        payload: {
          activeSessionKey: nextState.activeSessionKey,
          sessionsCount: Object.keys(nextState.sessions).length,
          changedFields: {
            activeSessionKey: activeSessionChanged,
            sessions: sessionsChanged,
          },
          ts: Date.now(),
        },
      })
    }

    prevState = nextState
  })
}

// ─── Config Store handler（触发配置刷新信号）─────────────────────────────────
//
// 注意：当前 OpenClaw 的 config 尚未抽象为独立 Store（vs team/queue/session）。
// 此处预留接入点，待 config-store 实现后，替换为真实的 store.subscribe() 调用。
//
// 使用场景：
// - config 文件热重载（watchFile / chokidar 触发）
// - feature flag 运行时变化
// - 用户通过命令修改配置（/set）
//
// 对标 Claude Code：
// - onGrowthBookRefresh → configRefreshSignal.refresh()
// - fullGrowthBookRefresh → configRefreshSignal.refresh()（无参数 = full）
//

/**
 * 触发配置刷新信号（供外部调用）
 *
 * 当 config 发生变化时，调用此函数广播给所有订阅者，
 * 强制它们重新读取最新配置（避免缓存陈旧）。
 *
 * @param changedKeys 变化的配置路径（可选，传参时触发 partial 刷新）
 */
export function notifyConfigChanged(changedKeys?: string[]): void {
  configRefreshSignal.refresh(changedKeys)
  console.debug('[StoreChoke] config refresh signal broadcast', {
    type: changedKeys ? 'partial' : 'full',
    changedKeys,
  })
}

// TODO: 待 config-store 实现后，在此添加真实订阅：
// const configStore = getConfigStore()
// _unsubscribers.push(_subscribeConfigStore(configStore))
//
// function _subscribeConfigStore(store: ReturnType<typeof getConfigStore>): UnsubscribeFn {
//   let prevState: ConfigState | undefined
//   return store.subscribe(() => {
//     const nextState = store.getState()
//     if (prevState === undefined) { prevState = nextState; return }
//     const changedKeys = _diffConfig(prevState, nextState)
//     if (changedKeys.length > 0) notifyConfigChanged(changedKeys)
//     prevState = nextState
//   })
// }

// ─── 内部 side effect helpers ────────────────────────────────────────────────

/**
 * 通过内部 HTTP API 向 Gateway 推送状态变化。
 *
 * 参考 Claude Code notifySessionMetadataChanged → ccrClient.reportMetadata 模式：
 * - 通过内部 HTTP 回调通知 gateway（避免直接 import gateway 造成循环依赖）
 * - 失败静默（gateway 推送是 best-effort，不影响主流程）
 * - 使用 JSON payload，Content-Type: application/json
 */
async function _pushToGateway(
  domain: 'team' | 'queue' | 'session',
  payload: unknown,
): Promise<void> {
  if (!_gatewayUrl) {
    console.debug('[StoreChoke] _pushToGateway called but gatewayUrl not set, skipping')
    return
  }

  const url = `${_gatewayUrl.replace(/\/$/, '')}/internal/store/${domain}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5_000) // 5s 超时

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(_gatewayToken ? { Authorization: `Bearer ${_gatewayToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      // 禁止 keep-alive 复用连接，避免 ECONNRESET/EPIPE
      keepalive: false,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      console.debug('[StoreChoke] gateway push failed', {
        domain,
        status: res.status,
        url,
      })
    }
  } catch (err) {
    // 静默失败：gateway 推送是 best-effort，不阻塞主流程
    const msg = err instanceof Error ? err.message : String(err)
    console.debug('[StoreChoke] gateway push error', { domain, url, error: msg })
  }
}

/**
 * 通过 WebSocket / SSE 广播队列状态给 connected clients。
 * 当前为空桩实现，后续可接入 ws 或 node:sse。
 */
function _broadcastQueue(state: QueueState): void {
  // TODO: 实现 WebSocket/SSE 广播
  // 典型实现：维护一个 Set<WebSocket> clients，遍历广播 JSON.stringify(state)
  console.debug('[StoreChoke] _broadcastQueue called (stub)', {
    activeLaneId: state.activeLaneId,
    lanesCount: Object.keys(state.lanes).length,
  })
}

/**
 * 持久化团队状态到外部存储（task-registry-persist）。
 * 当前为空桩，可对接磁盘文件、数据库或远程 checkpoint API。
 */
function _persistTeamState(state: TeamState): void {
  // TODO: 调用 task-registry-persist 的 checkpoint API
  // 典型实现：
  //   await fetch(`${persistUrl}/checkpoint`, { method: 'POST', body: JSON.stringify(state) })
  console.debug('[StoreChoke] _persistTeamState called (stub)', {
    leadAgentId: state.leadAgentId,
    membersCount: Object.keys(state.members).length,
    tasksCount: Object.keys(state.tasks).length,
  })
}
