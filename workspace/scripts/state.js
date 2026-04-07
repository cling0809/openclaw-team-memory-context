/**
 * state.js — 借鉴 Claude Code src/state/store.ts
 * 极简 3 API: getState / setState / subscribe
 * 引用相等跳过 + 函数式更新
 */

/**
 * @param {*} initialState
 * @param {Function} [onChange] - ({ newState, oldState }) => void
 * @returns {{ getState, setState, subscribe }}
 */
function createStore(initialState, onChange) {
  let state = initialState
  const listeners = new Set()

  return {
    getState: () => state,

    setState: (updater) => {
      const prev = state
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (Object.is(next, prev)) return  // 引用相等，跳过
      state = next
      if (onChange) onChange({ newState: next, oldState: prev })
      for (const listener of listeners) listener()
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

// ============================================================================
// 使用示例
// ============================================================================

/**
// 计数器示例
const counterStore = createStore({ count: 0, lastUpdated: null })

counterStore.subscribe(() => {
  console.log('状态变更:', counterStore.getState())
})

counterStore.setState(prev => ({
  count: prev.count + 1,
  lastUpdated: Date.now()
}))

counterStore.setState(prev => prev)  // 无变化，Object.is 相等，跳过
*/

module.exports = { createStore }
