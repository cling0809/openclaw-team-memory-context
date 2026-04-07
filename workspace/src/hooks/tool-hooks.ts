/**
 * Tool Hooks — 工具级拦截 Hook
 *
 * 对标 Claude Code 的 preTool / postTool / preToolError / postToolError 四阶段拦截。
 *
 * 设计要点：
 * - preTool: 工具执行前，可修改 input，可拒绝执行（throw）
 * - postTool: 工具执行后，可记录结果，可追加 side effect
 * - preToolError / postToolError: 工具异常时的专用钩子
 * - handlers 按 priority 排序，高优先级先执行
 * - 单个 hook 失败不阻断其他 hooks（catchErrors 模式）
 *
 * @module hooks/tool-hooks
 */

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export type ToolHookName = 'preTool' | 'postTool' | 'preToolError' | 'postToolError'

export interface ToolHookContext {
  toolName: string
  input: unknown
  sessionKey: string
  timestamp: number
}

export interface ToolHookResult {
  /** 如果 preTool 改写了 input，在此返回 */
  input?: unknown
  /** 如果 preTool 决定拒绝执行，设置此字段 */
  rejected?: boolean
  /** 拒绝原因（rejected=true 时填写） */
  reason?: string
}

type ToolHookHandler = (ctx: ToolHookContext) => Promise<ToolHookResult | void>
type ToolHookHandlerSync = (ctx: ToolHookContext) => ToolHookResult | void

interface RegisteredToolHook {
  name: ToolHookName
  handler: ToolHookHandler
  priority: number
  id: string
}

// ─── 内部注册表 ──────────────────────────────────────────────────────────────

const _hooks: RegisteredToolHook[] = []
let _initialized = false

function _getSortedHooks(name: ToolHookName): RegisteredToolHook[] {
  return _hooks
    .filter((h) => h.name === name)
    .sort((a, b) => b.priority - a.priority) // 高优先级先执行
}

// ─── 注册 API ────────────────────────────────────────────────────────────────

/**
 * 注册一个工具级 hook
 *
 * @param name - hook 类型
 * @param handler - handler 函数（async）
 * @param priority - 优先级，数字越大越先执行，默认 0
 * @returns 取消注册函数
 *
 * @example
 * ```typescript
 * import { registerToolHook } from './hooks/tool-hooks'
 *
 * // 记录所有工具调用
 * const unregister = registerToolHook('preTool', async (ctx) => {
 *   console.log('[tool-call]', ctx.toolName, ctx.input)
 * })
 *
 * // 取消注册
 * unregister()
 * ```
 *
 * @example 拒绝执行
 * ```typescript
 * registerToolHook('preTool', async (ctx) => {
 *   if (ctx.toolName === 'exec' && isDangerous(ctx.input)) {
 *     return { rejected: true, reason: 'dangerous command blocked' }
 *   }
 * })
 * ```
 *
 * @example preTool 修改 input
 * ```typescript
 * registerToolHook('preTool', async (ctx) => {
 *   if (ctx.toolName === 'read') {
 *     return { input: { ...ctx.input, encoding: 'utf8' } }
 *   }
 * })
 * ```
 */
export function registerToolHook(
  name: ToolHookName,
  handler: ToolHookHandler,
  priority: number = 0
): () => void {
  const id = `tool-hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  _hooks.push({ name, handler, priority, id })
  return () => {
    const idx = _hooks.findIndex((h) => h.id === id)
    if (idx !== -1) _hooks.splice(idx, 1)
  }
}

/**
 * 注册同步版本的 preTool hook（适用于纯计算无 IO 的校验）
 *
 * 同步 handler 允许直接返回结果而无需 async/await 开销。
 * 内部会自动包装为 async handler。
 */
export function registerToolHookSync(
  name: ToolHookName,
  handler: ToolHookHandlerSync,
  priority: number = 0
): () => void {
  return registerToolHook(name, async (ctx) => handler(ctx), priority)
}

// ─── 内部调度 ────────────────────────────────────────────────────────────────

/**
 * 捕获错误后执行后续 hooks（catchErrors 模式）
 * 单个 hook 失败不影响其他 hooks
 */
async function _runHooksSafely(
  hooks: RegisteredToolHook[],
  ctx: ToolHookContext
): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook.handler(ctx)
    } catch (err) {
      console.debug(`[ToolHooks] ${hook.name} hook #${hook.id} threw:`, err)
    }
  }
}

// ─── 公开调度函数（供 tool-partition 等模块调用）────────────────────────────

/**
 * 触发 preTool hooks
 *
 * @returns 合并后的 input（可能被某个 hook 改写），以及是否被拒绝
 *
 * @example
 * ```typescript
 * const { input, rejected, reason } = await runPreToolHooks({
 *   toolName: 'exec',
 *   input: { command: 'rm -rf /' },
 *   sessionKey: 'abc-123',
 * })
 * if (rejected) throw new Error(`Tool blocked: ${reason}`)
 * ```
 */
export async function runPreToolHooks(ctx: {
  toolName: string
  input: unknown
  sessionKey: string
}): Promise<{ input: unknown; rejected?: boolean; reason?: string }> {
  const hooks = _getSortedHooks('preTool')
  let input = ctx.input

  for (const hook of hooks) {
    try {
      const result = await hook.handler({
        toolName: ctx.toolName,
        input,
        sessionKey: ctx.sessionKey,
        timestamp: Date.now(),
      })

      // 如果 hook 返回了新的 input，更新它
      if (result && typeof result === 'object' && 'input' in result) {
        input = result.input ?? input
      }

      // 如果 hook 标记为拒绝，直接返回
      if (result && typeof result === 'object' && 'rejected' in result && result.rejected) {
        return { input, rejected: true, reason: (result as { reason?: string }).reason }
      }
    } catch (err) {
      console.debug(`[ToolHooks] preTool hook #${hook.id} threw:`, err)
    }
  }

  return { input }
}

/**
 * 触发 postTool hooks
 *
 * @example
 * ```typescript
 * const result = await executor(call)
 * await runPostToolHooks({
 *   toolName: call.name,
 *   input: call.args,
 *   sessionKey,
 *   result,
 * })
 * ```
 */
export async function runPostToolHooks(ctx: {
  toolName: string
  input: unknown
  sessionKey: string
  result: unknown
}): Promise<void> {
  const hooks = _getSortedHooks('postTool')
  const hookCtx: ToolHookContext = {
    toolName: ctx.toolName,
    input: ctx.input,
    sessionKey: ctx.sessionKey,
    timestamp: Date.now(),
  }

  // 追加 result 到 ctx（hook 可以读取）
  await _runHooksSafely(hooks, { ...hookCtx, input: ctx.result as unknown })
}

/**
 * 触发 preToolError hooks（工具执行抛出异常前）
 *
 * 在工具抛出异常后、正式向外传播前，先让 preToolError hooks 看到现场。
 *
 * @example
 * ```typescript
 * try {
 *   result = await executor(call)
 * } catch (err) {
 *   await runPreToolErrorHooks({ toolName, input, sessionKey, error: err })
 *   throw err
 * }
 * ```
 */
export async function runPreToolErrorHooks(ctx: {
  toolName: string
  input: unknown
  sessionKey: string
  error: unknown
}): Promise<void> {
  const hooks = _getSortedHooks('preToolError')
  const hookCtx: ToolHookContext = {
    toolName: ctx.toolName,
    input: ctx.input,
    sessionKey: ctx.sessionKey,
    timestamp: Date.now(),
  }
  await _runHooksSafely(hooks, hookCtx)
}

/**
 * 触发 postToolError hooks（工具异常善后）
 *
 * 与 preToolError 的区别：postToolError 是在异常已确定不会再重新抛出后触发，
 * 适合做日志写入、指标上报等善后工作。
 *
 * 注意：postToolError hooks 内部绝不能再抛出异常。
 *
 * @example
 * ```typescript
 * try {
 *   result = await executor(call)
 * } catch (err) {
 *   await runPreToolErrorHooks({ toolName, input, sessionKey, error: err })
 *   throw err
 * } finally {
 *   await runPostToolErrorHooks({ toolName, input, sessionKey, error: err }).catch(() => {})
 * }
 * ```
 */
export async function runPostToolErrorHooks(ctx: {
  toolName: string
  input: unknown
  sessionKey: string
  error: unknown
}): Promise<void> {
  const hooks = _getSortedHooks('postToolError')
  const hookCtx: ToolHookContext = {
    toolName: ctx.toolName,
    input: ctx.input,
    sessionKey: ctx.sessionKey,
    timestamp: Date.now(),
  }
  // postToolError 不再向外传播，所以用 catch 吞掉
  await _runHooksSafely(hooks, hookCtx)
}

// ─── 调试工具 ────────────────────────────────────────────────────────────────

/**
 * 获取当前已注册的 tool hook 数量
 */
export function getToolHookCount(): number {
  return _hooks.length
}

/**
 * 清除所有已注册的 tool hooks（用于测试）
 */
export function clearToolHooks(): void {
  _hooks.length = 0
}

/**
 * 列出当前所有已注册的 tool hooks（用于调试）
 */
export function listToolHooks(): Array<{ name: ToolHookName; priority: number; id: string }> {
  return _hooks.map((h) => ({ name: h.name, priority: h.priority, id: h.id }))
}
