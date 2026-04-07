/**
 * Session Store 加索引
 * 
 * 告别全量文件扫描，按 sessionKey 建索引（O(1) 查找）。
 * 支持 SQLite（better-sqlite3）索引， fallback 到 JSON 文件索引。
 * 
 * @module session-store-index
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const OPENCLAW_HOME = () => process.env.OPENCLAW_HOME ?? path.join(process.env.HOME ?? '', '.openclaw')

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export interface SessionIndexEntry {
  file: string
  updatedAt: number
  size: number
}

export interface SessionIndex {
  sessionKeys: Record<string, SessionIndexEntry>
  lastRebuild: number
  version: number
}

export interface SessionMetadata {
  sessionKey: string
  createdAt: number
  updatedAt: number
  messageCount: number
  lastMessageAt?: number
  tags?: string[]
  metadata?: Record<string, unknown>
}

// ─── 路径 ────────────────────────────────────────────────────────────────────

const SESSION_DIR = () => path.join(OPENCLAW_HOME(), 'state', 'sessions')

// ─── 输入验证 ────────────────────────────────────────────────────────────────

/** 防路径遍历：sessionKey 仅允许安全字符 */
const SESSION_KEY_REGEX = /^[a-zA-Z0-9_@:-]+$/

function validateSessionKey(sessionKey: string): void {
  if (!SESSION_KEY_REGEX.test(sessionKey) || sessionKey.length > 256) {
    throw new Error(`Invalid sessionKey: must match ${SESSION_KEY_REGEX.source} and ≤256 chars`)
  }
}

// ─── 原子写入辅助 ────────────────────────────────────────────────────────────

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const tmp = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`
  try {
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(tmp, filePath)
  } catch (err) {
    try { await fs.unlink(tmp) } catch { /* ignore */ }
    throw err
  }
}
const INDEX_FILE = () => path.join(SESSION_DIR(), '.session-index.json')
const INDEX_VERSION = 1

// ─── 索引缓存 ───────────────────────────────────────────────────────────────

let _cachedIndex: SessionIndex | null = null
let _sqliteDb: unknown = null // better-sqlite3 数据库句柄

// ─── SQLite 尝试加载 ─────────────────────────────────────────────────────────

/**
 * 尝试加载 better-sqlite3（可选依赖）
 * 
 * @returns SQLite 数据库句柄 或 null（不可用）
 */
async function tryLoadSqlite(): Promise<unknown | null> {
  try {
    // 动态 import，避免硬依赖
    const Database = (await import('better-sqlite3')).default
    const dbPath = path.join(SESSION_DIR(), '.sessions.db')
    const db = new Database(dbPath)
    
    // 初始化表
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_index (
        session_key TEXT PRIMARY KEY,
        file TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        size INTEGER NOT NULL
      )
    `)
    
    console.debug('[SessionIndex] SQLite backend enabled')
    return db
  } catch (err) {
    console.debug('[SessionIndex] SQLite not available, using JSON fallback')
    return null
  }
}

/**
 * 获取 SQLite 句柄（延迟初始化）
 */
async function getSqliteDb(): Promise<unknown | null> {
  if (_sqliteDb === undefined) {
    _sqliteDb = await tryLoadSqlite()
  }
  return _sqliteDb
}

// ─── JSON 文件索引实现 ───────────────────────────────────────────────────────

/**
 * 重建会话索引（扫描所有 session 文件）
 * 
 * @returns 完整的索引对象
 */
export async function rebuildSessionIndex(): Promise<SessionIndex> {
  const dir = SESSION_DIR()
  await fs.mkdir(dir, { recursive: true })

  let files: string[] = []
  try {
    files = await fs.readdir(dir)
  } catch {
    // 目录不存在，返回空索引
  }

  const index: SessionIndex = {
    sessionKeys: {},
    lastRebuild: Date.now(),
    version: INDEX_VERSION,
  }

  for (const file of files) {
    if (!file.endsWith('.jsonl')) continue
    const filePath = path.join(dir, file)
    try {
      const stat = await fs.stat(filePath)
      const sessionKey = file.replace('.jsonl', '')
      index.sessionKeys[sessionKey] = {
        file,
        updatedAt: stat.mtimeMs,
        size: stat.size,
      }
    } catch {
      // 文件读取失败，跳过
    }
  }

  await fs.writeFile(INDEX_FILE(), JSON.stringify(index, null, 2), 'utf8')
  _cachedIndex = index
  console.debug(`[SessionIndex] Rebuilt index with ${Object.keys(index.sessionKeys).length} entries`)
  return index
}

/**
 * 加载索引（带内存缓存）
 * 
 * @returns 索引对象
 */
export async function loadSessionIndex(): Promise<SessionIndex> {
  if (_cachedIndex) return _cachedIndex

  try {
    const raw = await fs.readFile(INDEX_FILE(), 'utf8')
    const index = JSON.parse(raw) as SessionIndex

    // 版本检查，版本不匹配需要重建
    if (index.version !== INDEX_VERSION) {
      console.debug('[SessionIndex] Index version mismatch, rebuilding')
      return rebuildSessionIndex()
    }

    _cachedIndex = index
    return index
  } catch {
    // 文件不存在或解析失败，触发重建
    return rebuildSessionIndex()
  }
}

/**
 * 按 sessionKey 直接定位文件（O(1)）
 * 
 * @param sessionKey - 会话唯一键
 * @returns 文件绝对路径（不存在或文件已删除返回 null）
 */
export async function findSessionFile(sessionKey: string): Promise<string | null> {
  validateSessionKey(sessionKey)
  const index = await loadSessionIndex()
  const entry = index.sessionKeys[sessionKey]
  if (!entry) return null

  const filePath = path.join(SESSION_DIR(), entry.file)
  try {
    await fs.access(filePath)
    return filePath
  } catch {
    // 文件已删除，从索引移除并返回 null
    delete index.sessionKeys[sessionKey]
    _cachedIndex = index
    return null
  }
}

/**
 * 增量更新索引（单条，不全量重建）
 * 
 * @param sessionKey - 会话唯一键
 */
export async function touchSession(sessionKey: string): Promise<void> {
  validateSessionKey(sessionKey)
  const index = await loadSessionIndex()
  const fileName = `${sessionKey}.jsonl`
  const dir = SESSION_DIR()

  try {
    const stat = await fs.stat(path.join(dir, fileName))
    index.sessionKeys[sessionKey] = {
      file: fileName,
      updatedAt: stat.mtimeMs,
      size: stat.size,
    }
    _cachedIndex = index
    await atomicWriteJson(INDEX_FILE(), index)
    console.debug(`[SessionIndex] Touched: ${sessionKey}`)
  } catch {
    // 文件还不存在，静默忽略
  }
}

/**
 * 从索引中移除会话（文件被删除时）
 * 
 * @param sessionKey - 会话唯一键
 */
export async function removeFromIndex(sessionKey: string): Promise<void> {
  validateSessionKey(sessionKey)
  const index = await loadSessionIndex()
  if (index.sessionKeys[sessionKey]) {
    delete index.sessionKeys[sessionKey]
    _cachedIndex = index
    await atomicWriteJson(INDEX_FILE(), index)
    console.debug(`[SessionIndex] Removed: ${sessionKey}`)
  }
}

/**
 * 获取所有已知的 sessionKey
 * 
 * @returns sessionKey 数组
 */
export async function listSessionKeys(): Promise<string[]> {
  const index = await loadSessionIndex()
  return Object.keys(index.sessionKeys)
}

/**
 * 获取索引统计信息
 * 
 * @returns 统计信息
 */
export async function getIndexStats(): Promise<{
  totalSessions: number
  totalSize: number
  lastRebuild: number
}> {
  const index = await loadSessionIndex()
  const entries = Object.values(index.sessionKeys)
  const totalSize = entries.reduce((sum, e) => sum + e.size, 0)
  return {
    totalSessions: entries.length,
    totalSize,
    lastRebuild: index.lastRebuild,
  }
}

/**
 * 清除索引缓存（强制下次重新加载）
 */
export function clearIndexCache(): void {
  _cachedIndex = null
}

// ─── SQLite 后端（可选）──────────────────────────────────────────────────────

/**
 * 使用 SQLite 批量插入索引（高性能）
 * 
 * @param entries - 索引条目数组
 */
export async function bulkInsertSqlite(
  entries: Array<{ sessionKey: string; file: string; updatedAt: number; size: number }>
): Promise<void> {
  const db = await getSqliteDb()
  if (!db) return

  const stmt = (db as { prepare: (sql: string) => { run: (...args: unknown[]) => void } })
    .prepare('INSERT OR REPLACE INTO session_index (session_key, file, updated_at, size) VALUES (?, ?, ?, ?)')

  const insertMany = (db as { transaction: (fn: () => void) => void }).transaction(() => {
    for (const e of entries) {
      stmt.run(e.sessionKey, e.file, e.updatedAt, e.size)
    }
  })

  insertMany()
  console.debug(`[SessionIndex] SQLite bulk insert: ${entries.length} entries`)
}

/**
 * 从 SQLite 加载所有 sessionKey（高性能）
 * 
 * @returns sessionKey 数组
 */
export async function listSessionKeysSqlite(): Promise<string[]> {
  const db = await getSqliteDb()
  if (!db) return listSessionKeys()

  const stmt = (db as { prepare: (sql: string) => { all: () => Array<{ session_key: string }> } })
    .prepare('SELECT session_key FROM session_index')
  return stmt.all().map((r) => r.session_key)
}

// ─── 使用示例 ────────────────────────────────────────────────────────────────

/**
 * @example
 * ```typescript
 * import {
 *   rebuildSessionIndex,
 *   loadSessionIndex,
 *   findSessionFile,
 *   touchSession,
 *   removeFromIndex,
 *   listSessionKeys,
 *   getIndexStats,
 *   clearIndexCache,
 * } from './session-store-index'
 * 
 * // 首次或定期重建索引
 * await rebuildSessionIndex()
 * 
 * // 按 sessionKey 直接查找（O(1)）
 * const filePath = await findSessionFile('session-abc-123')
 * if (filePath) {
 *   console.log('Session file found:', filePath)
 *   // 读取 session 文件...
 * }
 * 
 * // 新 session 创建后增量更新
 * await touchSession('session-new-456')
 * 
 * // session 删除后从索引移除
 * await removeFromIndex('session-old-789')
 * 
 * // 列出所有 session
 * const keys = await listSessionKeys()
 * console.log(`Total sessions: ${keys.length}`)
 * 
 * // 查看索引统计
 * const stats = await getIndexStats()
 * console.log(stats)
 * 
 * // 强制清除缓存（测试用）
 * clearIndexCache()
 * ```
 */
