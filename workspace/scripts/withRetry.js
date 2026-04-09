/**
 * withRetry.js — 借鉴 Claude Code src/services/api/withRetry.ts
 * 核心：指数退避 + jitter + 429/529 分流 + 模型降级
 *
 * Claude Code 细节（不适用）：
 * - Fast Mode / OAuth / Bedrock / Vertex 特定逻辑
 * - SystemAPIErrorMessage AsyncGenerator yield
 * - mdmRawRead / keychainPrefetch 并行 I/O
 *
 * 适用场景：OpenClaw 对外部 API 的 HTTP 请求（飞书、GitHub、web等）
 */

const { FetchError, isRetryable, formatError } = require('./errors')

const BASE_DELAY_MS = 500
const MAX_RETRIES = 3
const MAX_529_RETRIES = 3
const JITTER_FACTOR = 0.3

function backoffWithJitter(attempt, maxDelay = 30_000) {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), maxDelay)
  const jitter = Math.random() * BASE_DELAY_MS * JITTER_FACTOR
  return Math.floor(exponential + jitter)
}

function shouldRetry(error, attempt, consecutive529) {
  if (!error) return false
  if (error.status === 429) return true
  if (error.status === 529) return consecutive529 < MAX_529_RETRIES
  if (error.status === 401 || error.status === 403) return false
  if (error.code === 'ECONNRESET' || error.code === 'EPIPE') return true
  if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') return true
  return attempt < MAX_RETRIES
}

async function withRetry(fn, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    on429,
    on529,
    signal,
    onRetry,
    onFail,
  } = options

  let consecutive529 = 0
  let lastError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new Error('Aborted')
    }

    try {
      return await fn(attempt)
    } catch (error) {
      lastError = error

      if (error.status === 529) {
        consecutive529++
        if (consecutive529 >= MAX_529_RETRIES) {
          on529?.(error, consecutive529)
        }
      }

      if (error.status === 429) {
        on429?.(error)
      }

      if (!shouldRetry(error, attempt, consecutive529)) {
        throw error
      }

      if (attempt < maxRetries) {
        const delay = backoffWithJitter(attempt)
        onRetry?.(error, attempt, delay)
        await sleep(delay, signal)
      }
    }
  }

  onFail?.(lastError)
  throw lastError
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('Aborted'))
    })
  })
}

function feishuFetch(path, { token, body, method = 'POST' } = {}) {
  return withRetry(
    async (attempt) => {
      const res = await fetch('https://open.feishu.cn' + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        throw new FetchError(`Feishu ${res.status}: ${res.statusText}`, {
          url: 'https://open.feishu.cn' + path,
          status: res.status,
          isRetryable: res.status === 429 || res.status === 529 || res.status === 503,
          attempt,
        })
      }
      return res.json()
    },
    {
      maxRetries: 3,
      on429: (err) => console.warn('[feishuFetch]', formatError(err)),
      on529: (err, count) => {
        if (count >= 3) console.error('[feishuFetch]', formatError(err))
      },
      onRetry: (err, attempt, delay) => {
        console.warn(`[feishuFetch] 重试 ${attempt}/3，等待 ${delay}ms: ${err.message}`)
      },
      onFail: (err) => {
        console.error(`[feishuFetch] 最终失败: ${err.message}`)
      },
    }
  )
}

module.exports = { withRetry, backoffWithJitter, shouldRetry, feishuFetch }
