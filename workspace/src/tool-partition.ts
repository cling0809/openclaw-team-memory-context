/**
 * 工具并发安全分区 v2
 *
 * 核心改进：
 * 1. 工具级 `isConcurrencySafe` 接口（参考 Claude Code toolOrchestration.ts）
 * 2. 并发上限控制（maxConcurrency，默认 10，可 env 覆盖）
 * 3. 上下文修改合并队列（queuedContextModifiers 模式）
 * 4. 读操作并发安全标记（read/grep/glob 等 → concurrencySafe: true）
 * 5. 工具级拦截 Hook（preTool / postTool / preToolError / postToolError）
 *
 * @module tool-partition
 */

import {
  runPreToolHooks,
  runPostToolHooks,
  runPreToolErrorHooks,
  runPostToolErrorHooks,
} from './hooks/tool-hooks.js'

// ─── 并发配置 ────────────────────────────────────────────────────────────────

/** 默认最大并发数 */
const DEFAULT_MAX_CONCURRENCY = 10

/**
 * 从环境变量获取最大并发数
 * 允许通过 OPENCLAW_MAX_CONCURRENCY 覆盖默认配置
 */
function getMaxConcurrency(): number {
  const envVal = process.env?.OPENCLAW_MAX_CONCURRENCY
  if (envVal !== undefined) {
    const parsed = parseInt(envVal, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_MAX_CONCURRENCY
}

// ─── 工具并发安全注册表 ─────────────────────────────────────────────────────

/**
 * 工具并发安全标记接口
 *
 * 每个工具函数可声明 `concurrencySafe: true`，表示可以安全地与其他
 * 并发安全工具同时执行而不会产生竞争条件或状态冲突。
 *
 * 参考 Claude Code toolOrchestration.ts 的 isConcurrencySafe 设计
 */
export interface ConcurrencySafeTool {
  concurrencySafe?: boolean
}

/**
 * 已知的并发安全工具注册表
 *
 * key: 工具名（不区分大小写）
 * value: 是否并发安全（默认 false，即默认所有工具都是不安全的）
 *
 * 标记为 true 的工具可以互相并行，以及与标记为 true 的其他工具并行。
 *
 * 标记规则：
 * - 纯读操作（不修改任何共享状态）→ concurrencySafe: true
 * - 写操作、副作用操作 → concurrencySafe: false（默认，可省略）
 */
const CONCURRENCY_SAFE_TOOLS = new Set<string>([
  // ── 文件系统读 ──────────────────────────────────────────────────────────────
  'read',
  'grep',
  'glob',
  'search',
  'fetch',
  'web_search',
  'image',
  'pdf',
  'web_fetch',

  // ── Session/Memory 读 ───────────────────────────────────────────────────────
  'sessions_history',
  'memory_search',
  'memory_get',

  // ── Feishu 只读 ─────────────────────────────────────────────────────────────
  'feishu_bitable_get_meta',
  'feishu_bitable_list_fields',
  'feishu_bitable_list_records',
  'feishu_bitable_get_record',
  'feishu_chat',            // members/info 只读
  'feishu_drive_list',      // list 只读
  'feishu_wiki_nodes',      // nodes 只读
])

/**
 * 判断工具是否并发安全
 *
 * @param toolName - 工具名称
 * @returns 是否并发安全（默认 false）
 */
export function isConcurrencySafe(toolName: string): boolean {
  return CONCURRENCY_SAFE_TOOLS.has(toolName.toLowerCase())
}

// ─── 工具分类 ────────────────────────────────────────────────────────────────

const READ_OPERATIONS = new Set([
  'read',
  'grep',
  'glob',
  'search',
  'fetch',
  'web_search',
  'image',
  'pdf',
  'web_fetch',
  'sessions_history',
  'memory_search',
  'memory_get',
  'feishu_bitable_get_meta',
  'feishu_bitable_list_fields',
  'feishu_bitable_list_records',
  'feishu_bitable_get_record',
])

const WRITE_OPERATIONS = new Set([
  'edit',
  'write',
  'create',
  'delete',
  'move',
  'exec',
  'bash',
  'message',
  'feishu_doc',
  'feishu_drive',
  'feishu_wiki',
  'feishu_bitable_create_record',
  'feishu_bitable_update_record',
  'feishu_bitable_create_app',
  'feishu_bitable_create_field',
])

// ─── 工具判断 ────────────────────────────────────────────────────────────────

/**
 * 判断是否为读操作
 */
export function isReadOperation(toolName: string): boolean {
  const name = toolName.toLowerCase()
  return (
    READ_OPERATIONS.has(name) ||
    name.includes('read') ||
    name.includes('search') ||
    name.includes('fetch') ||
    name.includes('get') ||
    name.includes('list')
  )
}

/**
 * 判断是否为写操作
 */
export function isWriteOperation(toolName: string): boolean {
  const name = toolName.toLowerCase()
  return (
    WRITE_OPERATIONS.has(name) ||
    name.includes('edit') ||
    name.includes('write') ||
    name.includes('create') ||
    name.includes('delete') ||
    name.includes('move') ||
    name.includes('exec') ||
    name.includes('send')
  )
}

/**
 * 获取工具操作类型
 */
export function getOperationType(
  toolName: string
): 'read' | 'write' | 'other' {
  if (isReadOperation(toolName)) return 'read'
  if (isWriteOperation(toolName)) return 'write'
  return 'other'
}

// ─── 上下文修改合并队列 ──────────────────────────────────────────────────────

/**
 * 上下文修改记录
 *
 * 当工具执行结果需要合并到上下文时（如 session store 更新），
 * 不立即写入，而是进入队列，由合并器延迟处理。
 *
 * 参考 Claude Code queuedContextModifiers 模式
 */
export interface ContextModification {
  toolName: string
  args: unknown
  result: unknown
  timestamp: number
}

/**
 * 上下文修改合并器
 *
 * 用法：在 partitionAndExecute 执行完成后，
 * 用此函数将队列中的修改合并到最终上下文。
 */
export class ContextMergeQueue {
  private queue: ContextModification[] = []
  private merged: Map<string, ContextModification[]> = new Map()

  /**
   * 将工具执行结果加入合并队列
   * 只记录 non-concurrency-safe 工具的结果（因为 safe 工具不修改共享状态）
   */
  add(toolName: string, args: unknown, result: unknown): void {
    this.queue.push({
      toolName,
      args,
      result,
      timestamp: Date.now(),
    })
  }

  /**
   * 获取所有需要合并的修改
   * 按工具名分组，用于批量合并
   */
  getMerges(): Map<string, ContextModification[]> {
    if (this.merged.size > 0) return this.merged

    for (const mod of this.queue) {
      const existing = this.merged.get(mod.toolName) ?? []
      existing.push(mod)
      this.merged.set(mod.toolName, existing)
    }
    return this.merged
  }

  /**
   * 按顺序获取所有修改（用于日志/调试）
   */
  getAll(): ContextModification[] {
    return [...this.queue]
  }

  /** 清空队列（执行完合并后调用） */
  clear(): void {
    this.queue = []
    this.merged.clear()
  }

  /** 队列长度 */
  get length(): number {
    return this.queue.length
  }
}

// ─── 上下文修改合并队列 v2（patch-based）─────────────────────────────────────

/**
 * 上下文补丁类型
 *
 * 用于描述工具执行后对 ExecutionContext 的增量修改。
 * 所有 *_append 字段为追加语义（不覆盖），其他字段为覆盖语义。
 *
 * 参考 Claude Code queuedContextModifiers 模式中的 patch 合并策略。
 */
export interface ExecutionContextPatch {
  /** 追加到 system prompt 的内容 */
  systemPrompt_append?: string
  /** 追加到 user prompt 的内容 */
  userPrompt_append?: string
  /** 追加到工具描述列表的内容 */
  toolDescriptions_append?: string
  /** 覆盖 maxTokens */
  maxTokens?: number
  /** 覆盖 temperature */
  temperature?: number
  /** 覆盖 stop sequences */
  stop?: string[]
  /** 追加 metadata */
  metadata_append?: Record<string, string>
  /** 追加到 context notes */
  contextNotes_append?: string
}

/**
 * 单个上下文修改记录
 *
 * 区别于旧的 ContextModification（记录工具名+结果），
 * 这里直接记录对上下文的 patch（由工具执行器从结果中提取）。
 */
export interface ContextModifier {
  toolId: string
  patch: ExecutionContextPatch
  timestamp: number
}

/**
 * 上下文修改合并队列 v2
 *
 * 与旧的 ContextMergeQueue（按工具名分组）的区别：
 * - 按 patch 字段语义合并：`*_append` 字段拼接，其他字段取最后一个值
 * - 支持从工具执行结果中提取 patch（由 executor 决定格式）
 * - flush() 返回合并后的完整 patch，可直接应用到 ExecutionContext
 *
 * 使用场景：
 * 多个工具并发执行时，各自产生的上下文修改（如多个 skill 都追加了 system prompt），
 * 后执行的工具不应覆盖前者的修改，而应该合并。
 */
export class ContextModifierQueue {
  private queue: ContextModifier[] = []

  /**
   * 将工具的上下文 patch 加入队列
   *
   * @param toolId - 工具名/ID
   * @param patch - 该工具产生的上下文补丁
   */
  enqueue(toolId: string, patch: ExecutionContextPatch): void {
    this.queue.push({ toolId, patch, timestamp: Date.now() })
  }

  /**
   * 合并所有 patch，返回最终上下文补丁
   *
   * 合并策略：
   * - `*_append` 字段：按顺序拼接（先到先）
   * - 其他字段：取队列中最后一个值（后面的覆盖前面的）
   */
  flush(): ExecutionContextPatch {
    const merged: ExecutionContextPatch = {}

    for (const m of this.queue) {
      const p = m.patch

      // *_append 字段：拼接
      if (p.systemPrompt_append) {
        merged.systemPrompt_append = (merged.systemPrompt_append ?? '') + p.systemPrompt_append
      }
      if (p.userPrompt_append) {
        merged.userPrompt_append = (merged.userPrompt_append ?? '') + p.userPrompt_append
      }
      if (p.toolDescriptions_append) {
        merged.toolDescriptions_append = (merged.toolDescriptions_append ?? '') + p.toolDescriptions_append
      }
      if (p.contextNotes_append) {
        merged.contextNotes_append = (merged.contextNotes_append ?? '') + p.contextNotes_append
      }
      if (p.metadata_append) {
        merged.metadata_append = { ...merged.metadata_append, ...p.metadata_append }
      }

      // 其他字段：覆盖（取最后一个非 undefined 值）
      if (p.maxTokens !== undefined) merged.maxTokens = p.maxTokens
      if (p.temperature !== undefined) merged.temperature = p.temperature
      if (p.stop !== undefined) merged.stop = p.stop
    }

    this.lastFlushedPatch = merged
    this.queue = []
    return merged
  }

  /**
   * 最近一次 flush 的结果（partitionAndExecute 调用 flush() 后可读）
   */
  lastFlushedPatch: ExecutionContextPatch = {}

  /** 队列是否为空 */
  get isEmpty(): boolean {
    return this.queue.length === 0
  }

  /** 当前队列长度 */
  get length(): number {
    return this.queue.length
  }

  /** 清空队列 */
  clear(): void {
    this.queue = []
  }

  /**
   * 从队列中提取指定工具的 patch（不执行合并）
   * 用于调试/日志
   */
  getPatchForTool(toolId: string): ExecutionContextPatch[] {
    return this.queue
      .filter(m => m.toolId === toolId)
      .map(m => m.patch)
  }
}

// ─── 分区执行核心 ────────────────────────────────────────────────────────────

/**
 * 分区执行配置
 */
export interface PartitionConfig {
  /**
   * 最大并发数
   * 超过此数量的 concurrency-safe 工具将被分批执行
   * @default 10
   */
  maxConcurrency?: number

  /**
   * 是否启用上下文修改合并队列
   * @default false（向后兼容）
   */
  enableContextMerge?: boolean

  /**
   * 上下文修改队列实例（外部传入，方便共享）
   */
  contextMergeQueue?: ContextMergeQueue

  /**
   * 新版 patch 合并队列（queuedContextModifiers 模式）
   *
   * 当工具返回 { __contextPatch: {...} } 格式的结果时，
   * patch 会被自动加入此队列，最后 flush() 合并后返回。
   *
   * 与 contextMergeQueue 的区别：
   * - contextMergeQueue：按工具名分组，记录原始 args/result
   * - contextModifierQueue：直接合并 patch，`*_append` 字段拼接
   *
   * @default new ContextModifierQueue()
   */
  contextModifierQueue?: ContextModifierQueue

  /**
   * 当前会话标识（传递给 tool hooks）
   */
  sessionKey?: string
}

// ─── 工具调用类型 ────────────────────────────────────────────────────────────

export interface ToolCall {
  name: string
  args: unknown
}

export type ToolExecutor = (call: ToolCall) => Promise<unknown>

// ─── Semaphore（信号量）──────────────────────────────────────────────────────

/**
 * 轻量信号量，用于限制并发数
 */
class Semaphore {
  private permits: number
  private waitQueue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }
    // 需要等待
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve)
    })
  }

  release(): void {
    this.permits++
    const next = this.waitQueue.shift()
    if (next) {
      this.permits--
      next()
    }
  }

  /** 同步获取当前可用许可数（仅用于监控） */
  get available(): number {
    return this.permits
  }
}

// ─── 并发执行器（带信号量）──────────────────────────────────────────────────

/**
 * 使用信号量限制并发的执行函数
 *
 * @param calls - 要执行的调用列表
 * @param executor - 实际执行器
 * @param semaphore - 信号量（已设置 maxConcurrency）
 * @param queue - 旧版上下文合并队列（可选，向后兼容）
 * @param modifierQueue - 新版 patch 合并队列（可选）
 * @returns 结果数组（按顺序）
 */
async function executeWithSemaphore(
  calls: ToolCall[],
  executor: ToolExecutor,
  semaphore: Semaphore,
  queue?: ContextMergeQueue,
  modifierQueue?: ContextModifierQueue,
  sessionKey?: string
): Promise<unknown[]> {
  // 构建所有任务
  const tasks = calls.map(async (call, index): Promise<{ index; result }> => {
    await semaphore.acquire()
    try {
      // ── preTool hook（可修改 input，可拒绝）────────────────────────────
      const safeSessionKey = sessionKey ?? 'unknown'
      let currentInput = call.args
      let rejected = false
      let rejectReason: string | undefined

      try {
        const preResult = await runPreToolHooks({
          toolName: call.name,
          input: currentInput,
          sessionKey: safeSessionKey,
        })
        currentInput = preResult.input
        rejected = preResult.rejected ?? false
        rejectReason = preResult.reason
      } catch (err) {
        // preTool 自身失败：不阻断执行，记录并继续
        console.debug(`[tool-partition] preTool hook for "${call.name}" threw:`, err)
      }

      if (rejected) {
        throw new Error(`Tool blocked by hook: ${rejectReason ?? 'unknown reason'}`)
      }

      // ── 执行 ────────────────────────────────────────────────────────────
      let result: unknown
      let executionError: unknown

      try {
        result = await executor({ name: call.name, args: currentInput })
      } catch (err) {
        executionError = err
        // preToolError hook（错误路径的 hook）
        try {
          await runPreToolErrorHooks({
            toolName: call.name,
            input: currentInput,
            sessionKey: safeSessionKey,
            error: err,
          })
        } catch (hookErr) {
          console.debug(`[tool-partition] preToolError hook for "${call.name}" threw:`, hookErr)
        }
        throw err
      }

      // ── postTool hook ───────────────────────────────────────────────────
      try {
        await runPostToolHooks({
          toolName: call.name,
          input: currentInput,
          sessionKey: safeSessionKey,
          result,
        })
      } catch (err) {
        // postTool 失败：不阻断执行，只记录
        console.debug(`[tool-partition] postTool hook for "${call.name}" threw:`, err)
      }

      // ── 上下文合并队列 ───────────────────────────────────────────────────
      // 旧版队列（按工具名分组，向后兼容）
      if (queue && !isConcurrencySafe(call.name)) {
        queue.add(call.name, currentInput, result)
      }

      // 新版 patch 队列（如果有工具返回了 patch 格式的结果）
      if (modifierQueue && result != null && typeof result === 'object') {
        const r = result as Record<string, unknown>
        if (r.__contextPatch && typeof r.__contextPatch === 'object') {
          modifierQueue.enqueue(call.name, r.__contextPatch as ExecutionContextPatch)
        }
      }

      return { index, result }
    } finally {
      semaphore.release()
    }
  })

  const settled = await Promise.all(tasks)

  // 按原顺序返回
  return settled
    .sort((a, b) => a.index - b.index)
    .map((item) => item.result)
}

// ─── 分区执行 ────────────────────────────────────────────────────────────────

/**
 * 按读写类型分区执行工具调用
 *
 * 核心策略：
 * 1. concurrency-safe 工具：并行执行，受 maxConcurrency 限制
 * 2. non-concurrency-safe 工具：串行执行，保证写入安全
 * 3. non-concurrency-safe 结果进入上下文合并队列（可选）
 *
 * @param toolCalls - 工具调用列表
 * @param executor - 实际执行函数
 * @param config - 分区配置
 * @returns 结果数组（按原顺序）
 */
export async function partitionAndExecute(
  toolCalls: ToolCall[],
  executor: ToolExecutor,
  config: PartitionConfig = {}
): Promise<unknown[]> {
  const maxConcurrency = config.maxConcurrency ?? getMaxConcurrency()
  const enableContextMerge = config.enableContextMerge ?? false
  const queue = config.contextMergeQueue ?? new ContextMergeQueue()
  const modifierQueue = config.contextModifierQueue ?? new ContextModifierQueue()

  // ── Step 1: 三路分区 ──────────────────────────────────────────────────────
  const safeCalls: ToolCall[] = []     // concurrency-safe（可并行）
  const unsafeCalls: ToolCall[] = []   // non-concurrency-safe（串行）

  for (const call of toolCalls) {
    if (isConcurrencySafe(call.name)) {
      safeCalls.push(call)
    } else {
      unsafeCalls.push(call)
    }
  }

  // ── Step 2: 并发执行 safe 工具（受 semaphore 限制）────────────────────────
  const semaphore = new Semaphore(maxConcurrency)
  const safeResults = safeCalls.length > 0
    ? await executeWithSemaphore(
        safeCalls,
        executor,
        semaphore,
        enableContextMerge ? queue : undefined,
        modifierQueue,
        config.sessionKey
      )
    : []

  // ── Step 3: 串行执行 unsafe 工具（保证写入安全，同时走 hooks）─────────────
  const unsafeResults: unknown[] = []
  for (const call of unsafeCalls) {
    const safeSessionKey = config.sessionKey ?? 'unknown'

    // preTool hook
    let currentInput = call.args
    let rejected = false
    let rejectReason: string | undefined
    try {
      const preResult = await runPreToolHooks({
        toolName: call.name,
        input: currentInput,
        sessionKey: safeSessionKey,
      })
      currentInput = preResult.input
      rejected = preResult.rejected ?? false
      rejectReason = preResult.reason
    } catch (err) {
      console.debug(`[tool-partition] preTool hook for "${call.name}" threw:`, err)
    }

    if (rejected) {
      throw new Error(`Tool blocked by hook: ${rejectReason ?? 'unknown reason'}`)
    }

    let result: unknown
    try {
      result = await executor({ name: call.name, args: currentInput })
    } catch (err) {
      try {
        await runPreToolErrorHooks({
          toolName: call.name,
          input: currentInput,
          sessionKey: safeSessionKey,
          error: err,
        })
      } catch (hookErr) {
        console.debug(`[tool-partition] preToolError hook for "${call.name}" threw:`, hookErr)
      }
      throw err
    }

    // postTool hook
    try {
      await runPostToolHooks({
        toolName: call.name,
        input: currentInput,
        sessionKey: safeSessionKey,
        result,
      })
    } catch (err) {
      console.debug(`[tool-partition] postTool hook for "${call.name}" threw:`, err)
    }

    if (enableContextMerge) {
      queue.add(call.name, currentInput, result)
    }
    if (result != null && typeof result === 'object') {
      const r = result as Record<string, unknown>
      if (r.__contextPatch && typeof r.__contextPatch === 'object') {
        modifierQueue.enqueue(call.name, r.__contextPatch as ExecutionContextPatch)
      }
    }
    unsafeResults.push(result)
  }

  // ── Step 4: flush 新版 patch 队列 ───────────────────────────────────────
  // 所有并发+串行执行完成后，合并所有 patch，结果存入 lastFlushedPatch
  modifierQueue.flush()

  // ── Step 5: 按原顺序合并结果 ─────────────────────────────────────────────
  const safeIndexMap = new Map<number, number>()   // safeCalls[i] → original index
  const unsafeIndexMap = new Map<number, number>()

  {
    let si = 0, ui = 0
    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i]
      if (isConcurrencySafe(call.name)) {
        safeIndexMap.set(i, si++)
      } else {
        unsafeIndexMap.set(i, ui++)
      }
    }
  }

  return toolCalls.map((call, i) => {
    if (isConcurrencySafe(call.name)) {
      return safeResults[safeIndexMap.get(i) ?? -1]
    }
    return unsafeResults[unsafeIndexMap.get(i) ?? -1]
  })
}

/**
 * 简化版：并行执行所有调用（无分区）
 *
 * @param toolCalls - 工具调用列表
 * @param executor - 实际执行函数
 * @param maxConcurrency - 最大并发数（可选，默认 10）
 * @returns 结果数组
 */
export async function executeAllParallel(
  toolCalls: ToolCall[],
  executor: ToolExecutor,
  maxConcurrency?: number
): Promise<unknown[]> {
  const sem = new Semaphore(maxConcurrency ?? getMaxConcurrency())
  return executeWithSemaphore(toolCalls, executor, sem)
}

/**
 * 简化版：串行执行所有调用（无分区）
 *
 * @param toolCalls - 工具调用列表
 * @param executor - 实际执行函数
 * @returns 结果数组
 */
export async function executeAllSerial(
  toolCalls: ToolCall[],
  executor: ToolExecutor
): Promise<unknown[]> {
  const results: unknown[] = []
  for (const c of toolCalls) {
    results.push(await executor(c))
  }
  return results
}

// ─── 工具注册表管理（运行时扩展）────────────────────────────────────────────

/**
 * 运行时注册并发安全工具
 * 允许在应用启动后动态标记某工具为 concurrency-safe
 *
 * @param toolName - 工具名称
 * @example
 * ```typescript
 * registerConcurrencySafeTool('my_custom_read_tool', true)
 * ```
 */
export function registerConcurrencySafeTool(toolName: string, safe: boolean = true): void {
  const key = toolName.toLowerCase()
  if (safe) {
    CONCURRENCY_SAFE_TOOLS.add(key)
  } else {
    CONCURRENCY_SAFE_TOOLS.delete(key)
  }
}

/**
 * 获取所有已注册的 concurrency-safe 工具名称
 */
export function listConcurrencySafeTools(): string[] {
  return [...CONCURRENCY_SAFE_TOOLS]
}

// ─── 使用示例 ────────────────────────────────────────────────────────────────

/**
 * @example
 * ```typescript
 * import {
 *   partitionAndExecute,
 *   isConcurrencySafe,
 *   isReadOperation,
 *   isWriteOperation,
 *   ContextMergeQueue,
 *   ContextModifierQueue,
 *   type PartitionConfig,
 * } from './tool-partition'
 *
 * const queue = new ContextMergeQueue()
 * const modifierQueue = new ContextModifierQueue()
 *
 * const executor = async (call) => {
 *   await new Promise(r => setTimeout(r, Math.random() * 100))
 *   // 工具可返回 { __contextPatch: { systemPrompt_append: '...' } } 来贡献上下文修改
 *   return { success: true, tool: call.name }
 * }
 *
 * const toolCalls = [
 *   { name: 'read', args: { file: 'a.txt' } },        // concurrency-safe → 并行
 *   { name: 'write', args: { file: 'b.txt' } },      // unsafe → 串行
 *   { name: 'grep', args: { pattern: 'foo' } },      // concurrency-safe → 并行
 * ]
 *
 * const config: PartitionConfig = {
 *   maxConcurrency: 5,
 *   enableContextMerge: true,
 *   contextMergeQueue: queue,
 *   contextModifierQueue: modifierQueue,
 * }
 *
 * const results = await partitionAndExecute(toolCalls, executor, config)
 *
 * // 查看 patch 合并结果（所有工具的 `*_append` 字段已拼接）
 * const patch = modifierQueue.lastFlushedPatch
 * console.log('追加的 system prompt:', patch.systemPrompt_append)
 *
 * // 查看旧版合并队列
 * const merges = queue.getMerges()
 *
 * // 判断工具是否并发安全
 * console.log(isConcurrencySafe('read'))   // true
 * console.log(isConcurrencySafe('write'))   // false
 * ```
 */
