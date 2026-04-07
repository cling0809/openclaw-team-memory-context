/**
 * MemoryManager — 三层记忆统一抽象接口
 *
 * 三层架构：
 *   short/  — 短期记忆：原始会话流水，TTL=24h
 *   work/   — 工作记忆：提取的关键信息，TTL=7d
 *   ../     — 长期记忆：MEMORY.md + memory/*.md，永久或用户触发删除
 *
 * TTL 衰减机制：
 *   每个记忆文件带 createdAt + accessedAt，后台 decay() 清理过期文件
 *
 * 接口：add() / search() / promote() / decay() / getStats()
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// =============================================================================
// Types
// =============================================================================

export type MemoryScope = 'short' | 'work' | 'long';
export type MemoryTier = 'short' | 'work' | 'long';

export interface MemoryRecord {
  id: string;
  scope: MemoryScope;
  title: string;
  content: string;
  source?: string;
  tags?: string[];
  confidence?: number;
  verificationState?: 'pending' | 'verified' | 'refuted';
  createdAt: number;   // ms timestamp
  accessedAt: number;  // ms timestamp
  promotedAt?: number; // ms timestamp, if promoted from short->work or work->long
  expiresAt?: number; // ms timestamp, TTL deadline
  // long-term extended fields
  useCount?: number;
  lastUsedAt?: number;
  /** JSON-escaped YAML front-matter, used by toFile()/fromFile() */
  _fm?: string;
}

export interface MemorySearchOptions {
  query?: string;
  scope?: MemoryScope;
  tags?: string[];
  limit?: number;
  since?: number;  // createdAt after this timestamp
  before?: number; // createdAt before this timestamp
  includeExpired?: boolean;
}

export interface MemoryStats {
  short: { count: number; totalSize: number; oldest?: number; newest?: number; expired?: number };
  work:  { count: number; totalSize: number; oldest?: number; newest?: number; expired?: number };
  long:  { count: number; totalSize: number; oldest?: number; newest?: number };
}

// =============================================================================
// Constants
// =============================================================================

const SHORT_TTL_MS  = 24 * 3600 * 1000;          // 24 h
const WORK_TTL_MS   = 7  * 24 * 3600 * 1000;    // 7 d
const SCHEMA_VERSION = '1.0.0';

const SHORT_DIR = 'memory/short';
const WORK_DIR  = 'memory/work';
// Long-term lives alongside MEMORY.md (workspace root) and memory/*.md subdirs

// =============================================================================
// MemoryManager
// =============================================================================

export class MemoryManager {
  private workspaceDir: string;

  constructor(workspaceDir?: string) {
    this.workspaceDir = workspaceDir ||
      process.env['OPENCLAW_WORKSPACE'] ||
      path.dirname(require.main?.filename || '.');
  }

  // ---------------------------------------------------------------------------
  // Path helpers
  // ---------------------------------------------------------------------------

  private shortDir()  { return path.join(this.workspaceDir, SHORT_DIR); }
  private workDir()   { return path.join(this.workspaceDir, WORK_DIR);  }
  private memoryDir() { return path.join(this.workspaceDir, 'memory');  }
  private memoryMd()  { return path.join(this.workspaceDir, 'MEMORY.md'); }

  // ---------------------------------------------------------------------------
  // add — 写入记忆到指定层
  // ---------------------------------------------------------------------------

  /**
   * add — 写入一条记忆到指定层
   *
   * @param opts.scope     short | work | long
   * @param opts.title     标题（用于检索和文件名）
   * @param opts.content   正文
   * @param opts.source    来源标识
   * @param opts.tags      标签数组
   * @param opts.confidence 置信度 0-1
   * @param opts.id        可选，不提供则自动生成
   * @param opts.expiresAt 可选，强制指定过期时间（覆盖 TTL）
   */
  async add(opts: {
    scope: MemoryScope;
    title: string;
    content: string;
    source?: string;
    tags?: string[];
    confidence?: number;
    verificationState?: 'pending' | 'verified' | 'refuted';
    id?: string;
    expiresAt?: number;
  }): Promise<MemoryRecord> {
    const now = Date.now();
    const id = opts.id || this._generateId(opts.title, opts.scope);
    const ttl = opts.scope === 'short' ? SHORT_TTL_MS : WORK_TTL_MS;

    const record: MemoryRecord = {
      id,
      scope: opts.scope,
      title: opts.title,
      content: opts.content,
      source: opts.source,
      tags: opts.tags,
      confidence: opts.confidence,
      verificationState: opts.verificationState || 'pending',
      createdAt: now,
      accessedAt: now,
      promotedAt: undefined,
      expiresAt: opts.expiresAt ?? (now + ttl),
      useCount: 0,
      lastUsedAt: now,
    };

    await this._ensureDir(opts.scope);
    const filePath = this._recordPath(record);
    await this._writeRecord(filePath, record);

    return record;
  }

  // ---------------------------------------------------------------------------
  // promote — 晋升记忆到更高层
  // ---------------------------------------------------------------------------

  /**
   * promote — 将短/工作记忆晋升到更高层
   *
   * short -> work (24h 内未过期则可晋升，TTL 刷新为 7d)
   * work  -> long (沉淀到 MEMORY.md 或 memory/*.md)
   *
   * 晋升成功后源文件删除（避免重复）。
   */
  async promote(recordOrId: MemoryRecord | string, targetScope: MemoryScope): Promise<MemoryRecord> {
    const record: MemoryRecord = typeof recordOrId === 'string'
      ? await this._loadRecordById(recordOrId)
      : recordOrId;

    if (record.scope === targetScope) {
      throw new Error(`Already in target scope: ${targetScope}`);
    }

    if (record.scope === 'long') {
      throw new Error('Cannot promote from long-term memory — it is already permanent');
    }

    // Clone without file-specific metadata
    const promoted: MemoryRecord = {
      ...record,
      scope: targetScope,
      accessedAt: Date.now(),
      promotedAt: Date.now(),
      expiresAt: targetScope === 'work'
        ? Date.now() + WORK_TTL_MS
        : undefined, // long-term has no TTL
      useCount: 0,
      lastUsedAt: Date.now(),
    };

    await this._ensureDir(targetScope);
    const targetPath = this._recordPath(promoted);
    await this._writeRecord(targetPath, promoted);

    // Remove source
    const srcPath = this._recordPath(record);
    await this._safeDelete(srcPath);

    return promoted;
  }

  // ---------------------------------------------------------------------------
  // search — 跨层检索记忆
  // ---------------------------------------------------------------------------

  /**
   * search — 在记忆系统中检索
   *
   * @param options.query     关键词（title + content）
   * @param options.scope      限定层（默认 all）
   * @param options.tags        必须在这些标签中
   * @param options.limit      最多返回条数（默认 20）
   * @param options.since       创建时间下限
   * @param options.before      创建时间上限
   * @param options.includeExpired 是否包含已过期（默认 false）
   */
  async search(options: MemorySearchOptions = {}): Promise<MemoryRecord[]> {
    const {
      query,
      scope,
      tags,
      limit = 20,
      since,
      before,
      includeExpired = false,
    } = options;

    const scopes: MemoryScope[] = scope ? [scope] : ['short', 'work', 'long'];
    const results: MemoryRecord[] = [];
    const now = Date.now();

    for (const s of scopes) {
      const dir = s === 'short' ? this.shortDir() : s === 'work' ? this.workDir() : this.memoryDir();
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith('.md') || file === 'MEMORY.md') continue;
          const fullPath = path.join(dir, file);
          let record: MemoryRecord;
          try {
            record = await this._readRecord(fullPath);
          } catch {
            continue;
          }

          // TTL filter
          if (!includeExpired && record.expiresAt && record.expiresAt < now) continue;

          // Time filters
          if (since && record.createdAt < since) continue;
          if (before && record.createdAt > before) continue;

          // Tag filter
          if (tags && tags.length > 0) {
            const recordTags = record.tags || [];
            if (!tags.some(t => recordTags.includes(t))) continue;
          }

          // Text query filter (simple substring)
          if (query) {
            const q = query.toLowerCase();
            const haystack = `${record.title} ${record.content} ${record.tags?.join(' ') || ''}`.toLowerCase();
            if (!haystack.includes(q)) continue;
          }

          // Update accessedAt (lazy)
          if (record.accessedAt !== now) {
            record.accessedAt = now;
            this._writeRecord(fullPath, record).catch(() => {});
          }

          results.push(record);
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }

    // Sort by accessedAt desc
    results.sort((a, b) => b.accessedAt - a.accessedAt);

    return results.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // decay — TTL 衰减清理（后台任务入口）
  // ---------------------------------------------------------------------------

  /**
   * decay — 扫描 short/ 和 work/ 目录，删除过期记忆
   *
   * @param options.dryRun  是否只报告不删除（默认 false）
   * @param options.scope   只清理指定层（默认 both short + work）
   * @returns 清理报告
   */
  async decay(options: { dryRun?: boolean; scope?: MemoryScope } = {}): Promise<{
    shortExpired: string[];
    workExpired:  string[];
    shortFreedBytes: number;
    workFreedBytes:  number;
    errors: string[];
  }> {
    const { dryRun = false, scope } = options;
    const now = Date.now();
    const result = {
      shortExpired: [] as string[],
      workExpired:  [] as string[],
      shortFreedBytes: 0,
      workFreedBytes:  0,
      errors: [] as string[],
    };

    const scopesToCheck: MemoryScope[] = scope
      ? [scope]
      : ['short', 'work'];

    for (const s of scopesToCheck) {
      const dir = s === 'short' ? this.shortDir() : this.workDir();
      const expiredList = s === 'short' ? result.shortExpired : result.workExpired;
      const freedKey = s === 'short' ? 'shortFreedBytes' : 'workFreedBytes';

      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const fullPath = path.join(dir, file);
          try {
            const stat = await fs.stat(fullPath);
            let record: MemoryRecord;
            try {
              record = await this._readRecord(fullPath);
            } catch {
              // No front-matter — try to parse as legacy format, skip
              continue;
            }

            if (record.expiresAt && record.expiresAt < now) {
              expiredList.push(file);
              result[freedKey] += stat.size;
              if (!dryRun) {
                await this._safeDelete(fullPath);
              }
            }
          } catch (err) {
            result.errors.push(`${fullPath}: ${(err as Error).message}`);
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          result.errors.push(`${dir}: ${(err as Error).message}`);
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // getStats — 记忆统计
  // ---------------------------------------------------------------------------

  async getStats(): Promise<MemoryStats> {
    const now = Date.now();
    const emptySlot = () => ({ count: 0, totalSize: 0, oldest: undefined, newest: undefined, expired: undefined });

    const scanDir = async (
      dir: string,
      ttlMs?: number
    ): Promise<{ count: number; totalSize: number; oldest?: number; newest?: number; expired?: number }> => {
      let count = 0, totalSize = 0, oldest: number | undefined, newest: number | undefined, expired = 0;
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith('.md') || file === 'MEMORY.md') continue;
          const fullPath = path.join(dir, file);
          try {
            const stat = await fs.stat(fullPath);
            const record = await this._readRecord(fullPath);
            totalSize += stat.size;
            count++;
            if (!oldest || record.createdAt < oldest) oldest = record.createdAt;
            if (!newest || record.createdAt > newest) newest = record.createdAt;
            if (ttlMs && record.expiresAt && record.expiresAt < now) expired!++;
          } catch { /* skip */ }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
      return { count, totalSize, oldest, newest, expired };
    };

    const [shortStats, workStats, longStats] = await Promise.all([
      scanDir(this.shortDir(), SHORT_TTL_MS),
      scanDir(this.workDir(), WORK_TTL_MS),
      scanDir(this.memoryDir()),
    ]);

    return {
      short: { ...shortStats, expired: shortStats.expired },
      work:  { ...workStats,  expired: workStats.expired  },
      long:  { count: longStats.count, totalSize: longStats.totalSize, oldest: longStats.oldest, newest: longStats.newest },
    };
  }

  // ---------------------------------------------------------------------------
  // get — 读取单条记忆
  // ---------------------------------------------------------------------------

  async get(id: string): Promise<MemoryRecord | null> {
    try {
      return await this._loadRecordById(id);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _generateId(title: string, scope: MemoryScope): string {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const ts = Date.now().toString(36);
    return `${scope}-${slug}-${ts}`;
  }

  private _recordPath(record: MemoryRecord): string {
    const dir = record.scope === 'short'
      ? this.shortDir()
      : record.scope === 'work'
        ? this.workDir()
        : this.memoryDir();
    const safeName = record.id.replace(/[\/\\:*?"<>|]/g, '_') + '.md';
    return path.join(dir, safeName);
  }

  private async _ensureDir(scope: MemoryScope): Promise<void> {
    const dir = scope === 'short' ? this.shortDir() : scope === 'work' ? this.workDir() : this.memoryDir();
    await fs.mkdir(dir, { recursive: true });
  }

  private async _writeRecord(filePath: string, record: MemoryRecord): Promise<void> {
    const content = this._recordToYaml(record) + '\n---\n' + record.content;
    await fs.writeFile(filePath, content, 'utf8');
  }

  private async _readRecord(filePath: string): Promise<MemoryRecord> {
    const raw = await fs.readFile(filePath, 'utf8');
    return this._parseRecord(raw, filePath);
  }

  private _recordToYaml(record: MemoryRecord): string {
    const fm: Record<string, unknown> = {
      id:                record.id,
      scope:             record.scope,
      title:             record.title,
      source:            record.source,
      tags:              record.tags ? JSON.stringify(record.tags) : undefined,
      confidence:        record.confidence,
      verificationState: record.verificationState,
      createdAt:         record.createdAt,
      accessedAt:        record.accessedAt,
      promotedAt:       record.promotedAt,
      expiresAt:        record.expiresAt,
      useCount:         record.useCount,
      lastUsedAt:        record.lastUsedAt,
    };
    // Remove undefined keys and content (content always goes after second ---)
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fm)) {
      if (v !== undefined) clean[k] = v;
    }
    const yaml = '---\n' + Object.entries(clean)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n') + '\n---';
    return yaml;
  }

  private _parseRecord(raw: string, filePath: string): MemoryRecord {
    const parts = raw.split('\n---\n');
    if (parts.length < 2) {
      // Legacy format — no front-matter
      return {
        id: path.basename(filePath, '.md'),
        scope: 'long',
        title: path.basename(filePath, '.md'),
        content: raw.trim(),
        createdAt: Date.now(),
        accessedAt: Date.now(),
      };
    }

    const fmLines = parts[0].replace(/^---\n/, '').replace(/\n---$/, '').split('\n');
    const fm: Record<string, string> = {};
    for (const line of fmLines) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }

    const getNum = (k: string) => fm[k] ? Number(fm[k]) : undefined;
    const getJson = <T>(k: string): T | undefined => {
      try { return fm[k] ? JSON.parse(fm[k]) : undefined; } catch { return undefined; }
    };

    return {
      id:                fm['id'] || path.basename(filePath, '.md'),
      scope:            (fm['scope'] as MemoryScope) || 'long',
      title:            fm['title'] || '',
      content:          parts.slice(1).join('\n---\n').trim(),
      source:            fm['source'],
      tags:              getJson<string[]>(fm['tags']),
      confidence:        getNum(fm['confidence']),
      verificationState: fm['verificationState'] as MemoryRecord['verificationState'],
      createdAt:         getNum(fm['createdAt']) || Date.now(),
      accessedAt:        getNum(fm['accessedAt']) || Date.now(),
      promotedAt:        getNum(fm['promotedAt']),
      expiresAt:         getNum(fm['expiresAt']),
      useCount:          getNum(fm['useCount']),
      lastUsedAt:        getNum(fm['lastUsedAt']),
    };
  }

  private async _loadRecordById(id: string): Promise<MemoryRecord> {
    // Try each scope
    for (const [scope, dir] of [['short', this.shortDir()], ['work', this.workDir()], ['long', this.memoryDir()]] as const) {
      try {
        const files = await fs.readdir(dir);
        const found = files.find(f => f.startsWith(id) && f.endsWith('.md'));
        if (found) {
          return await this._readRecord(path.join(dir, found));
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    throw new Error(`Record not found: ${id}`);
  }

  private async _safeDelete(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

// =============================================================================
// CLI entry
// =============================================================================

if (require.main === module) {
  // Run decay as standalone script:  ts-node memory/MemoryManager.ts --decay [--dry-run]
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const scopeArg = args.find(a => a.startsWith('--scope='));
  const scope = scopeArg
    ? (scopeArg.split('=')[1] as MemoryScope)
    : undefined;

  const manager = new MemoryManager();
  manager.decay({ dryRun, scope }).then(report => {
    console.log('=== Memory Decay Report ===');
    console.log(`Short expired: ${report.shortExpired.length} files (${report.shortFreedBytes} bytes)`);
    report.shortExpired.forEach(f => console.log(`  - ${f}`));
    console.log(`Work  expired: ${report.workExpired.length} files (${report.workFreedBytes} bytes)`);
    report.workExpired.forEach(f => console.log(`  - ${f}`));
    if (report.errors.length > 0) {
      console.log('Errors:', report.errors);
    }
    if (dryRun) {
      console.log('[DRY RUN — no files were deleted]');
    } else {
      console.log('[Done]');
    }
  }).catch(err => {
    console.error('Decay failed:', err);
    process.exit(1);
  });
}

export default MemoryManager;
