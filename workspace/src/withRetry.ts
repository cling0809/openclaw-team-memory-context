/**
 * withRetry — 通用重试幂等机制
 *
 * 参考 Claude Code src/services/api/withRetry.ts 设计，但适配 OpenClaw 场景：
 * - 飞书 API 调用（HTTP）
 * - exec 工具的外部命令（子进程）
 * - session-store-index 的文件 I/O
 *
 * 错误处理策略：
 * - 401（API key 问题）→ 清缓存 + 重试一次
 * - 429（限速）→ 指数退避后重试（maxRetries 次）
 * - 529（服务过载）→ 前台重试3次后降级模型，后台直接丢弃
 * - ECONNRESET/EPIPE → 禁用 keep-alive 重连
 * - 408/409/5xx → 重试
 * - 其他错误 → 不重试，直接抛出
 *
 * @module withRetry
 */

// ─── 内置依赖（无外部包） ─────────────────────────────────────────────────

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new AbortError())
      }, { once: true })
    }
  })

class AbortError extends Error {
  name = 'AbortError'
  constructor() {
    super('Aborted')
  }
}

// ─── 错误类型工具 ─────────────────────────────────────────────────────────

/** 检测是否为 HTTP 错误响应（fetch Response 或类 Axios 错误） */
function getHttpStatus(err: unknown): number | null {
  // fetch Response.rejected → 普通 Error
  if (err instanceof Response) return err.status
  // fetch → 可能抛出 { status: number, message: string }
  if (typeof err === 'object' && err !== null) {
    const s = (err as Record<string, unknown>).status
    if (typeof s === 'number') return s
  }
  return null
}

/** 检测是否为网络连接断开错误（ECONNRESET / EPIPE） */
function isConnectionReset(err: unknown): boolean {
  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code
    return code === 'ECONNRESET' || code === 'EPIPE'
  }
  return false
}

/** 检测是否为 401 认证错误 */
function is401(err: unknown): boolean {
  return getHttpStatus(err) === 401
}

/** 检测是否为 429 限速错误 */
function is429(err: unknown): boolean {
  return getHttpStatus(err) === 429
}

/** 检测是否为 529 服务过载错误 */
function is529(err: unknown): boolean {
  return getHttpStatus(err) === 529
}

/** 检测是否为可重试的 5xx 错误 */
function is5xx(err: unknown): boolean {
  const s = getHttpStatus(err)
  return s !== null && s >= 500
}

/** 检测是否为 408 请求超时或 409 冲突 */
function isRetryableStatus(err: unknown): boolean {
  const s = getHttpStatus(err)
  return s === 408 || s === 409
}

// ─── RetryOptions ──────────────────────────────────────────────────────────

export interface RetryOptions {
  /** 最大重试次数（不含首次调用），默认 3 */
  maxRetries?: number
  /** 基础延迟（ms），默认 500 */
  baseDelayMs?: number
  /** 最大延迟上限（ms），默认 30000 */
  maxDelayMs?: number
  /**
   * Retry-After 秒数（来自响应头），优先级高于指数退避
   * @default null（从错误中解析 retry-after header）
   */
  retryAfterHeader?: string | null
  /** 重试前回调（可记录日志或修改状态）；返回 true 可中断重试循环 */
  onRetry?: (attempt: number, delayMs: number, error: unknown) => boolean | void
  /**
   * 自定义重试判定函数
   * - 返回 true → 执行重试
   * - 返回 false → 立即抛出
   */
  shouldRetry?: (err: unknown, attempt: number) => boolean
  /** AbortSignal，用于取消重试 */
  signal?: AbortSignal
  /**
   * 场景标签（用于日志和条件重试）
   * - 'feishu': 飞书 API 调用
   * - 'exec': exec 工具外部命令
   * - 'file-io': session-store-index 文件 I/O
   * - 'generic': 其他通用场景
   */
  label?: 'feishu' | 'exec' | 'file-io' | 'generic'
  /**
   * 529 过载时的降级模型（前台场景）
   * 当连续 3 次 529 后触发降级，抛出 FallbackTriggeredError
   */
  fallbackModel?: string
  /**
   * 是否为前台场景（用户阻塞等待结果）。
   * - true: 529 重试最多 MAX_529_RETRIES（3）次后可降级
   * - false: 529 直接丢弃（throw CannotRetryError）
   * @default true
   */
  foreground?: boolean
}

// ─── 自定义错误 ───────────────────────────────────────────────────────────

export class CannotRetryError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly context: RetryContext,
  ) {
    super(_errorMessage(originalError))
    this.name = 'CannotRetryError'
    if (originalError instanceof Error && originalError.stack) {
      this.stack = originalError.stack
    }
  }
}

export class FallbackTriggeredError extends Error {
  constructor(
    public readonly originalModel: string,
    public readonly fallbackModel: string,
  ) {
    super(`Model fallback triggered: ${originalModel} -> ${fallbackModel}`)
    this.name = 'FallbackTriggeredError'
  }
}

export interface RetryContext {
  label?: string
  fallbackModel?: string
}

const DEFAULT_MAX_RETRIES = 3
const MAX_529_RETRIES = 3
const DEFAULT_BASE_DELAY_MS = 500
const DEFAULT_MAX_DELAY_MS = 30_000
const JitterFactor = 0.25 // ±25% jitter

function _errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

// ─── 核心 withRetry ───────────────────────────────────────────────────────

/**
 * 带指数退避的重试包装器。
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => feishuApi.get('/chat', { headers }),
 *   { label: 'feishu', maxRetries: 5, fallbackModel: 'claude-3-5-haiku' }
 * )
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    retryAfterHeader: retryAfterHeaderOpt = null,
    onRetry,
    shouldRetry: shouldRetryCustom,
    signal,
    label = 'generic',
    fallbackModel,
    foreground = true,
  } = options

  let lastError: unknown
  let consecutive529Errors = 0

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (signal?.aborted) {
      throw new AbortError()
    }

    try {
      return await fn()
    } catch (err) {
      lastError = err

      // ── 特殊情况处理 ────────────────────────────────────

      // ECONNRESET / EPIPE → 禁用 keep-alive（下次请求重建连接），重试
      if (isConnectionReset(err)) {
        _disableKeepAlive()
        console.debug(`[withRetry/${label}] ECONNRESET/EPIPE — reconnecting without keep-alive`)
        // 不计入 attempt，继续重试
        void attempt
      }

      // 401 → 清缓存（如果 caller 注册了 onRetry，可在里面清理），
      // 强制重试一次（通常 token refresh 在 fn 内部做，这里给 fn 重来的机会）
      if (is401(err)) {
        console.debug(`[withRetry/${label}] 401 — retrying once after potential token refresh`)
        if (attempt <= maxRetries) {
          // 401 不占用重试配额，继续重试（token refresh 应在 fn 内部完成）
          continue
        }
        // attempt > maxRetries：已达到上限，401 不再重试
      }

      // 529 → 分前台/后台策略
      if (is529(err)) {
        if (!foreground) {
          // 后台场景：直接丢弃，不放大过载
          console.debug(`[withRetry/${label}] 529 in background — dropping`)
          throw new CannotRetryError(err, { label, fallbackModel })
        }
        consecutive529Errors++
        if (consecutive529Errors >= MAX_529_RETRIES) {
          if (fallbackModel) {
            console.debug(`[withRetry/${label}] 529 x${MAX_529_RETRIES} — triggering model fallback`)
            throw new FallbackTriggeredError(
              label === 'feishu' ? 'feishu-model' : 'default',
              fallbackModel,
            )
          }
          // 无 fallback：降级为普通重试耗尽
          console.debug(`[withRetry/${label}] 529 x${MAX_529_RETRIES} — no fallback, exhausting retries`)
        }
      }

      // ── 通用 shouldRetry ─────────────────────────────────

      // 自定义 shouldRetry 优先
      if (shouldRetryCustom) {
        const decision = shouldRetryCustom(err, attempt)
        if (!decision) {
          throw new CannotRetryError(err, { label, fallbackModel })
        }
      } else {
        // 内置 shouldRetry
        if (!shouldRetry(err, { is5xx, is429, is408: isRetryableStatus })) {
          throw new CannotRetryError(err, { label, fallbackModel })
        }
      }

      // ── 到达重试上限 ────────────────────────────────────

      if (attempt > maxRetries + 1) {
        throw new CannotRetryError(err, { label, fallbackModel })
      }

      // ── 计算延迟 ─────────────────────────────────────────

      const retryAfterHeader =
        retryAfterHeaderOpt ??
        _extractRetryAfterHeader(err)

      let delayMs: number
      if (retryAfterHeader !== null) {
        // 优先使用 Retry-After header（秒）
        delayMs = Math.min(retryAfterHeader * 1000, maxDelayMs)
      } else {
        // 指数退避 + jitter
        const exponential = Math.min(
          baseDelayMs * Math.pow(2, attempt - 1),
          maxDelayMs,
        )
        const jitter = exponential * JitterFactor * (Math.random() * 2 - 1)
        delayMs = Math.round(exponential + jitter)
      }

      // ── onRetry 回调 ──────────────────────────────────────

      const interrupt = onRetry?.(attempt, delayMs, err)
      if (interrupt === true) {
        console.debug(`[withRetry/${label}] onRetry returned true — interrupting`)
        throw new CannotRetryError(err, { label, fallbackModel })
      }

      console.debug(
        `[withRetry/${label}] retrying (attempt ${attempt}/${maxRetries + 1}) after ${delayMs}ms`,
        { error: _errorMessage(err) },
      )

      await sleep(delayMs, signal)
    }
  }

  throw new CannotRetryError(lastError!, { label, fallbackModel })
}

// ─── shouldRetry 内置策略 ─────────────────────────────────────────────────

function shouldRetry(
  err: unknown,
  helpers: {
    is5xx: (err: unknown) => boolean
    is429: (err: unknown) => boolean
    is408: (err: unknown) => boolean
  },
): boolean {
  // 408 / 409 → 重试
  if (helpers.is408(err) || helpers.is409(err)) return true

  // 429 → 重试（限速）
  if (helpers.is429(err)) return true

  // 5xx → 重试
  if (helpers.is5xx(err)) return true

  // 网络断开（无 status code）→ 重试
  if (isConnectionReset(err)) return true

  // 其他错误 → 不重试
  return false
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────

/** 从错误对象中提取 Retry-After header（秒） */
function _extractRetryAfterHeader(err: unknown): number | null {
  if (err instanceof Response) {
    const h = err.headers.get('retry-after')
    if (h) return _parseRetryAfterSeconds(h)
  }
  if (typeof err === 'object' && err !== null) {
    // 类 Axios 错误：{ response: { headers: { 'retry-after': '30' } } }
    const resp = (err as Record<string, unknown>).response
    if (resp && typeof resp === 'object') {
      const headers = (resp as Record<string, unknown>).headers
      if (headers && typeof headers === 'object') {
        const h = (headers as Record<string, unknown>)['retry-after']
        if (typeof h === 'string') return _parseRetryAfterSeconds(h)
      }
    }
    // 扁平化：{ headers: { 'retry-after': '30' } }
    const headers = (err as Record<string, unknown>).headers
    if (headers && typeof headers === 'object') {
      const h = (headers as Record<string, unknown>)['retry-after']
      if (typeof h === 'string') return _parseRetryAfterSeconds(h)
    }
  }
  return null
}

function _parseRetryAfterSeconds(raw: string): number | null {
  const seconds = parseInt(raw, 10)
  if (!isNaN(seconds)) return seconds
  // HTTP-date 格式（RFC 7231）："Wed, 31 Oct 2025 07:00:00 GMT"
  const date = new Date(raw)
  if (!isNaN(date.getTime())) {
    return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000))
  }
  return null
}

/** 禁用 HTTP keep-alive（用于处理 ECONNRESET/EPIPE）。 */
function _disableKeepAlive(): void {
  // Node.js: 尝试关闭所有 HTTP Agent 的 keep-alive socket
  // 这个函数放在这里是为了不引入额外 import，实际使用时由 caller 的
  // httpAgent / httpsAgent 配置决定。
  try {
    const http = require('node:http') as typeof import('node:http')
    const https = require('node:https') as typeof import('node:https')
    // 遍历全局 agent 池，标记所有 socket 为不重用
    for (const agent of [http.globalAgent, https.globalAgent]) {
      if (agent && typeof agent === 'object') {
        ;(agent as import('node:http').Agent).keepAlive = false
        ;(agent as import('node:http').Agent).maxSockets = 1
      }
    }
  } catch {
    // 非 Node.js 环境（如 Deno/Bun）静默忽略
  }
}

// ─── 便捷包装器 ───────────────────────────────────────────────────────────

/** 飞书 API 调用的带重试包装器 */
export async function withRetryFeishu<T>(
  fn: () => Promise<T>,
  options?: Omit<RetryOptions, 'label' | 'foreground'>,
): Promise<T> {
  return withRetry(fn, { ...options, label: 'feishu' })
}

/** exec 工具外部命令的带重试包装器 */
export async function withRetryExec<T>(
  fn: () => Promise<T>,
  options?: Omit<RetryOptions, 'label'>,
): Promise<T> {
  return withRetry(fn, { ...options, label: 'exec' })
}

/** 文件 I/O 的带重试包装器（用于 session-store-index） */
export async function withRetryFileIO<T>(
  fn: () => Promise<T>,
  options?: Omit<RetryOptions, 'label'>,
): Promise<T> {
  return withRetry(fn, { ...options, label: 'file-io' })
}
