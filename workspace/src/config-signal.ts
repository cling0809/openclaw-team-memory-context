/**
 * 配置刷新信号系统
 *
 * 类似 Claude Code 的 GrowthBook 刷新信号：
 * 当配置发生变化时，广播信号给所有订阅者，强制它们重新读取最新配置。
 * 避免缓存陈旧导致的行为不一致。
 *
 * @module config-signal
 */

// ─── 类型定义 ────────────────────────────────────────────────────────────────

/** 配置刷新事件监听器 */
export type ConfigRefreshListener = (event: ConfigRefreshEvent) => void

/** 配置刷新事件 */
export interface ConfigRefreshEvent {
  type: 'full' | 'partial' // 全量刷新 or 部分刷新
  changedKeys?: string[] // 变化的配置路径
  timestamp: number
}

// ─── 信号类 ──────────────────────────────────────────────────────────────────

/**
 * 配置刷新信号
 *
 * 实现发布-订阅模式，广播配置刷新事件给所有订阅者。
 * 对标 Claude Code 的 onGrowthBookRefresh / fullGrowthBookRefresh 机制。
 *
 * 使用示例：
 * ```typescript
 * import { configRefreshSignal, onConfigRefresh } from './config-signal'
 *
 * // 订阅
 * const unsubscribe = onConfigRefresh((event) => {
 *   console.log('配置已刷新', event)
 *   // 强制重新读取最新配置
 * })
 *
 * // 触发全量刷新
 * configRefreshSignal.refresh()
 *
 * // 触发部分刷新（仅特定 key）
 * configRefreshSignal.refresh(['feature.myFeature'])
 * ```
 */
class ConfigRefreshSignal {
  private listeners = new Map<string, Set<ConfigRefreshListener>>()

  /**
   * 订阅配置刷新事件
   * @param scope 订阅作用域，用于区分不同模块（如 'ui'、'skills'、'gateway'）
   * @param listener 回调函数
   * @returns 取消订阅函数
   */
  subscribe(scope: string, listener: ConfigRefreshListener): () => void {
    if (!this.listeners.has(scope)) {
      this.listeners.set(scope, new Set())
    }
    this.listeners.get(scope)!.add(listener)
    return () => this.listeners.get(scope)?.delete(listener)
  }

  /**
   * 触发刷新
   * @param changedKeys 变化的配置路径（传入时触发 partial 刷新，否则 full 刷新）
   */
  refresh(changedKeys?: string[]): void {
    const event: ConfigRefreshEvent = {
      type: changedKeys ? 'partial' : 'full',
      changedKeys,
      timestamp: Date.now(),
    }
    for (const listeners of this.listeners.values()) {
      for (const listener of listeners) {
        try {
          listener(event)
        } catch {
          // 不阻断其他 listener
        }
      }
    }
  }

  /**
   * 触发 feature flag 变化（让依赖旧 flag 值的组件强制重读）
   * @param flagName feature flag 名称
   * @param newValue 新的 flag 值
   */
  refreshFeatureFlag(flagName: string, newValue: unknown): void {
    this.refresh([flagName])
  }

  /** 获取当前订阅统计（用于调试） */
  getListenerCount(): number {
    let total = 0
    for (const set of this.listeners.values()) {
      total += set.size
    }
    return total
  }
}

// ─── 单例导出 ────────────────────────────────────────────────────────────────

export const configRefreshSignal = new ConfigRefreshSignal()

// ─── 便捷 API ────────────────────────────────────────────────────────────────

/**
 * 便捷订阅（用于 React hooks / store-choke / skill-engine 等）
 *
 * @param listener 回调函数
 * @param scope 作用域，默认为 'default'
 * @returns 取消订阅函数
 *
 * @example
 * ```typescript
 * // 在组件或模块初始化时订阅
 * const cleanup = onConfigRefresh((event) => {
 *   if (event.type === 'full') {
 *     // 全量刷新：重新加载所有配置
 *   } else {
 *     // 部分刷新：只处理变化的 keys
 *     event.changedKeys?.forEach(reloadConfig)
 *   }
 * })
 *
 * // 组件卸载时取消订阅
 * onCleanup(cleanup)
 * ```
 */
export function onConfigRefresh(
  listener: ConfigRefreshListener,
  scope = 'default'
): () => void {
  return configRefreshSignal.subscribe(scope, listener)
}
