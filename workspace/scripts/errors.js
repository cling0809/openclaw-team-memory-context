/**
 * errors.js — 借鉴 Claude Code src/utils/errors.ts
 * 
 * Claude Code 的错误处理核心模式：
 * 1. 自定义错误类：结构化、含 metadata
 * 2. isAbortError()：同时处理 3 种 abort 形态
 * 3. Error cause 链：保留原始错误的上下文
 */

/**
 * 判断是否为 abort 类型的错误
 * 同时处理三种形态：
 * - 本地的 AbortError（自定义类）
 * - DOM AbortController 的 DOMException
 * - SDK 的 APIUserAbortError
 * 
 * @example
 * if (isAbortError(err)) {
 *   // 用户主动取消，不算 bug
 *   return
 * }
 */
function isAbortError(e) {
  if (!e) return false
  if (e instanceof Error) {
    if (e.name === 'AbortError') return true
    // SDK 的 abort 错误
    if (e.name === 'APIUserAbortError') return true
  }
  return false
}

/**
 * 小龙虾自定义错误基类
 * 比原生 Error 多支持：
 * - name 可枚举
 * - 可附加 metadata（不污染 stack）
 */
class OpenClawError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * 记忆提取失败
 */
class MemoryExtractError extends OpenClawError {
  constructor(message, { filePath, candidates, cause } = {}) {
    super(message)
    this.filePath = filePath
    this.candidates = candidates
    this.cause = cause
  }
}

/**
 * 会话压缩失败
 */
class CompactError extends OpenClawError {
  constructor(message, { sessionId, tokenCount, cause } = {}) {
    super(message)
    this.sessionId = sessionId
    this.tokenCount = tokenCount
    this.cause = cause
  }
}

/**
 * HTTP 请求失败（含 retry 信息）
 */
class FetchError extends OpenClawError {
  constructor(message, { url, status, statusText, isRetryable, attempt } = {}) {
    super(message)
    this.url = url
    this.status = status
    this.statusText = statusText
    this.isRetryable = isRetryable ?? false
    this.attempt = attempt ?? 1
  }
}

/**
 * 格式化错误为日志字符串
 * @example
 * console.error(formatError(err))
 * // => "[FetchError] HTTP 429: Rate Limited (retryable, attempt 2/3)"
 */
function formatError(err) {
  if (!err) return 'Unknown error'
  
  const parts = []
  
  if (err.name && err.name !== 'Error') {
    parts.push(`[${err.name}]`)
  }
  
  if (err.status) {
    parts.push(`HTTP ${err.status}`)
  }
  
  if (err.message) {
    parts.push(err.message)
  }
  
  if (err.isRetryable) {
    parts.push('(retryable)')
  }
  
  if (err.attempt) {
    parts.push(`(attempt ${err.attempt}/3)`)
  }
  
  if (err.cause && err.cause !== err) {
    parts.push(`← ${err.cause.message || err.cause}`)
  }
  
  return parts.join(' ') || String(err)
}

/**
 * 包装错误，保留 cause 链
 * @example
 * try {
 *   await fetchData()
 * } catch (err) {
 *   throw wrapError('获取数据失败', err, { url })
 * }
 */
function wrapError(message, cause, metadata = {}) {
  const err = new Error(message)
  Object.assign(err, metadata)
  err.cause = cause
  err.name = 'WrappedError'
  return err
}

/**
 * 判断是否为可重试错误
 * - 429 Rate Limit
 * - 529 Server Overloaded
 * - 503 Service Unavailable
 * - 网络超时 / ECONNRESET / EPIPE
 */
function isRetryable(err) {
  if (!err) return false
  if (err.isRetryable !== undefined) return err.isRetryable
  if (typeof err.status === 'number') {
    return err.status === 429 || err.status === 529 || err.status === 503
  }
  if (err.code) {
    return ['ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EPIPE'].includes(err.code)
  }
  return false
}

module.exports = {
  isAbortError,
  isRetryable,
  formatError,
  wrapError,
  OpenClawError,
  MemoryExtractError,
  CompactError,
  FetchError,
}
