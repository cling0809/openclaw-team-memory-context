/**
 * onChange.js — 借鉴 Claude Code src/state/onChangeAppState.ts
 *
 * 核心模式：副作用集中管理
 * - 每次状态变更，通过 diff(oldState, newState) 自动触发副作用
 * - 调用方无需知道有哪些副作用，专注业务逻辑
 * - 新增副作用只需在此文件加一个 block，不污染业务代码
 *
 * Claude Code 示例：
 *   toolPermissionContext.mode 变更 → 自动通知 CCR + SDK + 保存设置
 *   mainLoopModel 变更 → 自动持久化到 settings
 *   expandedView 变更 → 自动保存 showExpandedTodos 配置
 *
 * OpenClaw 适配场景：
 *   - session 完成 → 自动触发 extractMemories
 *   - toolPermissionContext 变更 → 通知飞书/Discord 等 channel
 *   - 模型切换 → 记录到 memory / 更新配置
 *   - autoCompact 触发 → 更新 dashboard 状态
 */

const effects = []

/**
 * 注册副作用处理函数
 * @param {Function} handler - (prev, next) => void
 * @returns {Function} 取消注册
 */
export function onEachChange(handler) {
  effects.push(handler)
  return () => {
    const idx = effects.indexOf(handler)
    if (idx !== -1) effects.splice(idx, 1)
  }
}

/**
 * 在状态变更时调用（由 createStore 的 onChange 回调触发）
 * @param {Object} prev - 上一个状态
 * @param {Object} next - 下一个状态
 */
export function emitChange(prev, next) {
  for (const effect of effects) {
    try {
      effect(prev, next)
    } catch (err) {
      console.error('[onChange] 副作用执行失败:', err)
    }
  }
}

// ============================================================================
// OpenClaw 常用副作用 Block
// ============================================================================

/**
 * Block 1: session 完成 → 自动提取记忆
 * 触发条件：session 状态从 running 变为 completed/timeout
 */
onEachChange((prev, next) => {
  if (prev?.session?.status === 'running' && next?.session?.status !== 'running') {
    const { status, endedAt } = next.session
    console.log(`[onChange] Session ended: ${status} at ${endedAt}`)
    // 延迟执行，避免阻塞状态更新
    setTimeout(() => {
      try {
        const extractMemories = require('../extractMemories')
        // extractMemories(sessionTranscript).catch(console.error)
      } catch (e) {
        // extractMemories 可能尚未加载
      }
    }, 2000)
  }
})

/**
 * Block 2: 权限模式变更 → 通知所有 channel
 * 触发条件：toolPermissionContext.mode 变更
 */
onEachChange((prev, next) => {
  if (prev?.permission?.mode !== next?.permission?.mode) {
    const oldMode = prev?.permission?.mode ?? 'unknown'
    const newMode = next?.permission?.mode ?? 'unknown'
    console.log(`[onChange] Permission mode: ${oldMode} → ${newMode}`)
    // 例：通知 Discord/Slack/飞书 等 channel 权限已变更
    // broadcastPermissionChange({ from: oldMode, to: newMode })
  }
})

/**
 * Block 3: 模型切换 → 记录到 memory
 * 触发条件：model 字段变更
 */
onEachChange((prev, next) => {
  if (prev?.model !== next?.model && next?.model) {
    const timestamp = new Date().toISOString()
    console.log(`[onChange] Model switched to ${next.model} at ${timestamp}`)
    // appendToMemory(`model-switch`, { model: next.model, at: timestamp })
  }
})

/**
 * Block 4: autoCompact 触发 → 更新侧栏统计
 * 触发条件：compact.count 或 compact.bytes 变更
 */
onEachChange((prev, next) => {
  if (
    (prev?.compact?.count !== next?.compact?.count) ||
    (prev?.compact?.bytes !== next?.compact?.bytes)
  ) {
    const saved = (next?.compact?.bytes ?? 0) - (prev?.compact?.bytes ?? 0)
    if (saved > 0) {
      console.log(`[onChange] autoCompact: saved ${saved} bytes`)
      // updateDashboard({ compactCount: next.compact.count, compactBytes: next.compact.bytes })
    }
  }
})

// ============================================================================
// 副作用集中管理的优势
// ============================================================================
//
// 传统方式（散落各处）：
//   execTool()  { ...; notifyDiscord(); notifyFeishu(); }
//   setPermission() { ...; notifyDiscord(); notifyFeishu(); }
//   switchModel() { ...; notifyDiscord(); notifyFeishu(); }
//   ↑ 每个调用点都要记得加 notify，漏了就是 bug
//
// 集中管理（choke point）：
//   execTool()  { setState({ ... }) }           // 只需调 setState
//   setPermission() { setState({ ... }) }       // 只需调 setState
//   switchModel() { setState({ ... }) }          // 只需调 setState
//   onChange(prev, next) {
//     if (mode changed)  { notifyDiscord(); notifyFeishu() }
//     if (model changed)  { logToMemory() }
//   }
//   ↑ 调用方永远不漏，副作用不会丢失
//
// ============================================================================

module.exports = { onEachChange, emitChange }
