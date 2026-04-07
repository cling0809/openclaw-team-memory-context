/**
 * extractMemories.js — 小龙虾自适应记忆提取系统 v2.0
 * =====================================================
 *
 * 改造自 Claude Code extractMemories.ts 设计模式：
 *   https://github.com/anthropics/claude-code/blob/main/src/extractMemories.ts
 *
 * v2.0 核心变化：
 *   旧：transcript → 直接写 MEMORY.md / daily md
 *   新：transcript → MemoryRecord candidates → 初分类 → 路由检查 → 写入对应层
 *
 * 路由层设计：memory/schema/routing-rules.md
 * MemoryRecord Schema：memory/schema/MemoryRecord.md
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const crypto = require('crypto');

// 全局记忆写入队列：防止多个 session 同时写 memory/ 文件夹
const { sequential } = require('./scripts/sequential');
const memoryWriteQueue = sequential(async (task) => task());

// ============================================================================
// 路径配置
// ============================================================================

const OPENCLAW_HOME      = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
const WORKSPACE          = process.env.OPENCLAW_WORKSPACE || path.join(OPENCLAW_HOME, 'workspace');
const MEMORY_DIR         = path.join(WORKSPACE, 'memory');
const PROJECTS_DIR       = path.join(MEMORY_DIR, 'projects');
const CARDS_DIR          = path.join(MEMORY_DIR, 'cards');
const PROCEDURES_DIR     = path.join(MEMORY_DIR, 'procedures');
const RECOVERY_DIR       = path.join(MEMORY_DIR, 'recovery');
const MEMORY_INDEX       = path.join(WORKSPACE, 'MEMORY.md');
const CURSOR_FILE        = path.join(WORKSPACE, '.memory_cursor');

const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// 核心函数签名（兼容原调用方）
// ============================================================================

/**
 * extractMemories — 主入口
 *
 * @param {Array<{role:string, content:string, uuid?:string, timestamp?:string}>} sessionTranscript
 * @param {Object} options
 * @param {string}  [options.sessionKey]              — 当前会话 key
 * @param {string}  [options.lastMemoryMessageUuid]   — cursor-based 防重（兼容旧接口）
 * @param {Function} [options.onFork]                 — fork 独立 agent 执行
 * @param {Function} [options.logger]                  — 日志函数
 *
 * @returns {Promise<{extracted: Array, written: Array, skipped: number, lastMemoryMessageUuid: string}>}
 */
async function extractMemories(sessionTranscript, options = {}) {
  const logger = options.logger || defaultLogger;
  const { lastMemoryMessageUuid, sessionKey } = options;

  logger('info', `[extractMemories v2] 开始分析 session（lastUuid=${lastMemoryMessageUuid || 'null'}）`);

  // Step 0：读取 cursor，跳过已处理消息
  const cursor = readCursor();
  const effectiveLastUuid = options.lastMemoryMessageUuid || cursor.lastMemoryMessageUuid;
  const newMessages = cursorFilter(sessionTranscript, effectiveLastUuid);

  if (newMessages.length === 0) {
    logger('info', '[extractMemories v2] 无新消息，跳过');
    return { extracted: [], written: [], skipped: 0, lastMemoryMessageUuid: effectiveLastUuid };
  }

  // Step 1：判断是否值得提取
  if (!shouldExtractMemory(newMessages)) {
    logger('info', '[extractMemories v2] 未达触发阈值，跳过');
    return { extracted: [], written: [], skipped: 0, lastMemoryMessageUuid: effectiveLastUuid };
  }

  // Step 2：识别候选记忆
  const candidates = identifyMemoryCandidates(newMessages);
  if (candidates.length === 0) {
    logger('info', '[extractMemories v2] 未发现值得记住的内容');
    return { extracted: [], written: [], skipped: 0, lastMemoryMessageUuid: effectiveLastUuid };
  }

  // Step 2.5：处理子龙 announce 消息
  const announceResults = collectSubagentAnnounces(newMessages, sessionKey || 'main');
  if (announceResults.length > 0) {
    logger('info', `[extractMemories v2] 检测到 ${announceResults.length} 条子龙 announce`);
    for (const ar of announceResults) {
      syncChildResultToOrchestration(ar, sessionKey || 'main');
    }
  }

  logger('info', `[extractMemories v2] 发现 ${candidates.length} 条候选记忆`);

  // Step 3：执行提取（支持 fork 模式）
  let extracted;
  if (typeof options.onFork === 'function') {
    logger('info', '[extractMemories v2] 使用 Forked Agent 模式');
    extracted = await options.onFork(candidates, sessionTranscript);
  } else {
    extracted = await extractInCurrentContext(candidates, sessionTranscript);
  }

  // Step 4：将提取结果转为 MemoryRecord candidates
  const records = extracted.map(cand => buildMemoryRecord(cand, sessionKey));

  // Step 5：路由写入（核心改造）
  const written = [];
  for (const record of records) {
    // 5a. 查重检查
    const dupResult = checkDeduplication(record);
    if (dupResult.duplicate) {
      logger('info', `[extractMemories v2] 跳过重复记录: ${record.id}`);
      continue;
    }

    // 5b. 路由到正确落点
    const filePath = await memoryWriteQueue(async () => routeRecord(record));
    written.push({ record, filePath });
  }

  // 5c. 统一更新 cursor（所有记录处理完后）
  if (newMessages.length > 0) {
    const lastUuid = newMessages[newMessages.length - 1].uuid;
    updateCursor({ _lastUuid: lastUuid });
  }

  // Step 6：触发副作用（onChange）
  if (written.length > 0) {
    try {
      const { emitChange } = require('./scripts/onChange');
      emitChange(
        { action: 'memory_writing', count: 0 },
        { action: 'memory_written', count: written.length, files: written.map(w => w.filePath) }
      );
    } catch (e) {
      // onChange 可能尚未加载，静默忽略
    }
  }

  const lastUuid = newMessages[newMessages.length - 1]?.uuid;

  logger('info', `[extractMemories v2] 完成：写入 ${written.length} 条记忆`);

  return {
    extracted: written.map(w => w.record),
    written:   written.map(w => w.filePath),
    skipped:   sessionTranscript.length - newMessages.length,
    lastMemoryMessageUuid: lastUuid,
  };
}

// ============================================================================
// 核心新增函数
// ============================================================================

/**
 * buildMemoryRecord — 将 extract 产物转为 MemoryRecord 结构
 */
function buildMemoryRecord(cand, sessionKey) {
  const now = Date.now();
  const shortHash = shortHashOf(`${cand.type}:${cand.topic}:${now}`);
  const inferredScope = cand.scope || inferScopeFromType(cand.type);
  const id = `mem:single:${inferredScope}:${shortHash}`;

  return {
    id,
    type: 'single',
    scope: inferredScope,
    title:     cand.topic  || '未分类',
    summary:   cand.summary || null,
    detail:    cand.detail  || null,
    source:    cand.source  || `session:${sessionKey || 'unknown'}`,
    confidence: cand.confidence || inferConfidenceFromType(cand.type),
    verificationState: inferInitialVerificationState(cand),
    importance:  cand.importance  || 'medium',
    sensitivity: cand.sensitivity || 'private',
    tags:        cand.tags        || [cand.type],
    relatedTaskIds:     cand.relatedTaskIds     || [],
    relatedSessionKeys: sessionKey ? [sessionKey] : [],
    createdAt: now,
    lastUsedAt: now,
    useCount: 0,
    ttlPolicy: buildTtlPolicy(inferredScope),
    promotionPolicy: buildPromotionPolicy(inferredScope),
    demotionPolicy: buildDemotionPolicy(inferredScope),
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * classifyRecord — 根据 source/context 判断 type + scope（二次分类）
 */
function classifyRecord(record) {
  const { scope, source, tags, confidence } = record;

  // 如果已有明确非默认 scope，直接返回
  if (scope && scope !== 'programmatic') return record;

  if (typeof source === 'string') {
    if (source.startsWith('session:'))  return { ...record, scope: 'episodic' };
    if (source.startsWith('file:'))     return { ...record, scope: 'semantic' };
    if (source === 'user' && confidence >= 0.85) return { ...record, scope: 'profile' };
    if (source === 'system')            return { ...record, scope: 'semantic' };
  }

  if (tags) {
    if (tags.includes('preference')) return { ...record, scope: 'profile' };
    if (tags.includes('workflow'))   return { ...record, scope: 'procedural' };
    if (tags.includes('project'))    return { ...record, scope: 'project' };
  }

  return { ...record, scope: 'episodic' };
}

/**
 * checkDeduplication — 三级查重
 * @returns {{ duplicate: boolean, level: 'L1'|'L2'|'L3'|null, existingId: string|null }}
 */
function checkDeduplication(record) {
  const { scope, id, title, source, summary } = record;

  // L1: id 精确匹配
  const existingPath = resolveRecordPath(record);
  if (existingPath && fs.existsSync(existingPath)) {
    return { duplicate: true, level: 'L1', existingId: id };
  }

  // L2: title hash + scope 精确匹配
  if (title) {
    const titleHash = shortHashOf(title);
    const l2Match = findByTitleHash(titleHash, scope);
    if (l2Match) return { duplicate: true, level: 'L2', existingId: l2Match.id };
  }

  // L3: source + summary hash 匹配（仅对 episodic 有效）
  if (scope === 'episodic' && source && summary) {
    const sigHash = shortHashOf(`${source}:${summary}`);
    const l3Match = findBySignatureHash(sigHash);
    if (l3Match) return { duplicate: true, level: 'L3', existingId: l3Match.id };
  }

  return { duplicate: false, level: null, existingId: null };
}

/**
 * routeRecord — 按 routing-rules 写到正确落点
 * @param {Object} record
 * @returns {Promise<string>} 写入的文件路径
 */
async function routeRecord(record) {
  const classified = classifyRecord(record);
  const { scope, verificationState } = classified;

  switch (scope) {
    case 'profile':
      // profile 只写 verified 到 MEMORY.md
      if (verificationState === 'verified') {
        return writeToMemoryIndexProfile(classified);
      }
      // 未 verified，降级到 semantic pending
      return writeToSemanticCard({ ...classified, scope: 'semantic', verificationState: 'pending' });

    case 'project':
      return writeToProjectFile(classified);

    case 'episodic':
      return writeToEpisodicDaily(classified);

    case 'semantic':
      return writeToSemanticCard(classified);

    case 'procedural':
      return writeToProceduralFile(classified);

    default:
      return writeToEpisodicDaily({ ...classified, scope: 'episodic' });
  }
}

/**
 * promoteCandidate — 满足条件时触发升级
 * @returns {{ record: Object, promoted: boolean, newScope: string|null }}
 */
function promoteCandidate(record) {
  const { verificationState, confidence, useCount, scope, promotionPolicy } = record;

  if (verificationState === 'pending') {
    const minUseCount   = promotionPolicy?.minUseCount   || 5;
    const minConfidence = promotionPolicy?.minConfidence || 0.85;
    if (useCount >= minUseCount && confidence >= minConfidence) {
      return {
        record: { ...record, verificationState: 'verified', lastUsedAt: Date.now() },
        promoted: true,
        newScope: scope,
      };
    }
  }

  if (verificationState === 'unverified') {
    if (useCount >= 2 && confidence >= 0.7) {
      return {
        record: { ...record, verificationState: 'pending', lastUsedAt: Date.now() },
        promoted: true,
        newScope: scope,
      };
    }
  }

  return { record, promoted: false, newScope: null };
}

// ============================================================================
// 路由落点写入函数
// ============================================================================

function writeToMemoryIndexProfile(record) {
  if (!fs.existsSync(MEMORY_INDEX)) {
    fs.writeFileSync(MEMORY_INDEX, '# MEMORY.md - Long-Term Memory\n\n', 'utf8');
  }

  let content = fs.readFileSync(MEMORY_INDEX, 'utf8');
  const profileSection = '## Profile';
  if (!content.includes(profileSection)) {
    content += `\n${profileSection}\n`;
  }

  const dateStr = new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric' });
  const entry = `- **${dateStr}** ${record.title}${record.summary ? ` · ${record.summary}` : ''} · \`${record.id}\`\n`;

  const sectionRegex = new RegExp(`(${profileSection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\n`);
  if (sectionRegex.test(content)) {
    content = content.replace(sectionRegex, `$1\n${entry}`);
  } else {
    content += `\n${entry}`;
  }

  fs.writeFileSync(MEMORY_INDEX, content, 'utf8');
  return MEMORY_INDEX;
}

function writeToProjectFile(record) {
  const taskId = record.relatedTaskIds?.[0];
  const id = taskId || shortHashOf(record.title);
  const filePath = path.join(PROJECTS_DIR, `${id}.md`);

  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  fs.appendFileSync(filePath, formatRecordBlock(record) + '\n', 'utf8');
  return filePath;
}

function writeToEpisodicDaily(record) {
  const dateStr = new Date(record.createdAt).toISOString().slice(0, 10);
  const filePath = path.join(MEMORY_DIR, `${dateStr}.md`);

  fs.mkdirSync(MEMORY_DIR, { recursive: true });
  fs.appendFileSync(filePath, formatRecordBlock(record) + '\n', 'utf8');
  return filePath;
}

function writeToSemanticCard(record) {
  const id = shortHashOf(record.title);
  const filePath = path.join(CARDS_DIR, `${id}.md`);

  fs.mkdirSync(CARDS_DIR, { recursive: true });

  const block = formatRecordBlock(record);
  const existing = fs.existsSync(filePath);

  if (existing) {
    const content = fs.readFileSync(filePath, 'utf8');
    // 已有同 id 记录则跳过
    if (content.includes(`memory-record-id: ${record.id}`)) return filePath;
    fs.appendFileSync(filePath, block + '\n', 'utf8');
  } else {
    fs.writeFileSync(filePath, block + '\n', 'utf8');
  }

  return filePath;
}

function writeToProceduralFile(record) {
  const id = shortHashOf(record.title);
  const filePath = path.join(PROCEDURES_DIR, `${id}.md`);

  fs.mkdirSync(PROCEDURES_DIR, { recursive: true });
  fs.appendFileSync(filePath, formatRecordBlock(record) + '\n', 'utf8');
  return filePath;
}

function formatRecordBlock(record) {
  const ts = new Date(record.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const { id, scope, title, summary, detail, verificationState, confidence, importance, tags } = record;

  let block = `## [${scope}] ${title} @${ts}\n`;
  block    += `<!-- memory-record-id: ${id} -->\n`;
  block    += `<!-- verificationState: ${verificationState} | confidence: ${confidence} | importance: ${importance} -->\n`;
  if (tags && tags.length > 0) block += `<!-- tags: ${tags.join(', ')} -->\n`;
  if (summary) block += `\n**摘要**：${summary}\n`;
  if (detail)  block += `\n**详情**：\n${detail}\n`;

  return block;
}

// ============================================================================
// 查重辅助
// ============================================================================

function resolveRecordPath(record) {
  const { scope, id } = record;
  if (!id) return null;
  const parts = id.split(':');
  if (parts.length < 4) return null;
  const shortId = parts[3];

  switch (scope) {
    case 'episodic':   return null; // 日期文件无法 L1 精确定位
    case 'semantic':   return path.join(CARDS_DIR, `${shortId}.md`);
    case 'procedural': return path.join(PROCEDURES_DIR, `${shortId}.md`);
    case 'project': {
      const taskId = record.relatedTaskIds?.[0];
      return taskId ? path.join(PROJECTS_DIR, `${taskId}.md`) : null;
    }
    case 'profile': return MEMORY_INDEX;
    default:         return null;
  }
}

function findByTitleHash(titleHash, scope) {
  let dir;
  switch (scope) {
    case 'semantic':   dir = CARDS_DIR;       break;
    case 'procedural': dir = PROCEDURES_DIR;  break;
    case 'project':    dir = PROJECTS_DIR;    break;
    default:           return null;
  }

  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    if (content.includes(titleHash)) {
      const idMatch = content.match(/memory-record-id: (mem:[^\s>]+)/);
      if (idMatch) return { id: idMatch[1] };
    }
  }
  return null;
}

function findBySignatureHash(sigHash) {
  if (!fs.existsSync(MEMORY_DIR)) return null;
  const files = fs.readdirSync(MEMORY_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));
  const cutoff = Date.now() - 7 * 24 * 3600 * 1000;

  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(sigHash)) {
      const idMatch = content.match(/memory-record-id: (mem:[^\s>]+)/);
      if (idMatch) return { id: idMatch[1] };
    }
  }
  return null;
}

// ============================================================================
// Cursor 持久化
// ============================================================================

function readCursor() {
  if (!fs.existsSync(CURSOR_FILE)) {
    return { lastMemoryMessageUuid: null, lastMemoryTimestamp: null };
  }
  try {
    return JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf8'));
  } catch {
    return { lastMemoryMessageUuid: null, lastMemoryTimestamp: null };
  }
}

function updateCursor(record) {
  const cursor = {
    lastMemoryMessageUuid: record._lastUuid || null,
    lastMemoryTimestamp: Date.now(),
  };
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(cursor, null, 2), 'utf8');
}

// ============================================================================
// MemoryRecord Schema 辅助函数
// ============================================================================

function inferScopeFromType(type) {
  return { feedback: 'episodic', user: 'profile', project: 'project', reference: 'semantic' }[type] || 'episodic';
}

function inferConfidenceFromType(type) {
  return { feedback: 0.8, user: 0.75, project: 0.9, reference: 0.7 }[type] || 0.7;
}

function inferInitialVerificationState(cand) {
  // 高置信来源 → verified
  if ((cand.source === 'system' || (cand.source || '').startsWith('file:')) && cand.confidence >= 0.85) {
    return 'verified';
  }
  // episodic 默认 pending（不是直接 verified）
  if (cand.scope === 'episodic' || !cand.scope) return 'pending';
  // profile 门槛更高
  if (cand.scope === 'profile') {
    return cand.confidence >= 0.85 ? 'verified' : 'unverified';
  }
  return 'pending';
}

function buildTtlPolicy(scope) {
  const policies = {
    profile:    { action: 'snapshot', maxAgeMs: 365 * 24 * 3600 * 1000,      maxUseCount: null },
    project:    { action: 'snapshot', maxAgeMs: 90  * 24 * 3600 * 1000,      maxUseCount: null },
    semantic:   { action: 'archive',  maxAgeMs: 30  * 24 * 3600 * 1000,      maxUseCount: 50   },
    procedural: { action: 'archive',  maxAgeMs: 60  * 24 * 3600 * 1000,      maxUseCount: 100  },
    episodic:   { action: 'expire',   maxAgeMs: 7   * 24 * 3600 * 1000,      maxUseCount: 20   },
  };
  return policies[scope] || policies.episodic;
}

function buildPromotionPolicy(scope) {
  const policies = {
    profile:    { minUseCount: 5,  minConfidence: 0.85, triggerStates: ['pending', 'verified'] },
    project:    { minUseCount: 5,  minConfidence: 0.8,  triggerStates: ['pending'] },
    semantic:   { minUseCount: 3,  minConfidence: 0.8,  triggerStates: ['pending'] },
    procedural: { minUseCount: 5,  minConfidence: 0.8,  triggerStates: ['pending', 'verified'] },
    episodic:   { minUseCount: 3,  minConfidence: 0.8,  triggerStates: ['pending'] },
  };
  return policies[scope] || null;
}

function buildDemotionPolicy(scope) {
  const policies = {
    profile:    { maxAgeDays: 90,  decayIntervalDays: 30, demoteTo: 'semantic' },
    project:    { maxAgeDays: 90,  decayIntervalDays: 30, demoteTo: 'episodic' },
    semantic:   { maxAgeDays: 30,  decayIntervalDays: 14, demoteTo: 'episodic' },
    procedural: { maxAgeDays: 30,  decayIntervalDays: 14, demoteTo: 'semantic' },
    episodic:   { maxAgeDays: 14,  decayIntervalDays: 7,  demoteTo: null },
  };
  return policies[scope] || null;
}

// ============================================================================
// 原有逻辑（保留兼容性）
// ============================================================================

function shouldExtractMemory(messages) {
  if (!messages || messages.length === 0) return false;
  if (hasCorrectionFeedback(messages)) return true;
  if (hasProjectChange(messages)) return true;
  if (hasNewReference(messages)) return true;
  if (hasConfirmation(messages)) return !recentlyExtractedConfirmation(messages);
  return false;
}

function hasCorrectionFeedback(messages) {
  return messages.some(m => {
    if (m.role !== 'user') return false;
    const c = m.content?.toLowerCase() || '';
    return /不对|不是|错|错误|修正|更正|重来|不应该|记错了|改一下|重新|不对的|纠正/.test(c);
  });
}

function hasProjectChange(messages) {
  return messages.some(m => {
    if (m.role !== 'user') return false;
    const c = m.content || '';
    return /方向.*确定|决定|选定为|最终方案|放弃|换方向|换.*方向|改了|改了主意/.test(c);
  });
}

function hasNewReference(messages) {
  return messages.some(m => {
    if (m.role !== 'assistant') return false;
    const c = m.content || '';
    return /新方法|新工具|学到了|了解到|发现.*可以|这个技巧|推荐使用|最好用|标准做法/.test(c);
  });
}

function hasConfirmation(messages) {
  return messages.some(m => {
    if (m.role !== 'user') return false;
    const c = m.content?.toLowerCase() || '';
    return /对了|可以|很好|完成|没问题|好的|清楚了|没问题|就这样|👍/.test(c);
  });
}

function recentlyExtractedConfirmation(messages) {
  return getRecentMemoryFiles(30).length > 0;
}

function identifyMemoryCandidates(messages) {
  const candidates = [];

  for (const msg of messages) {
    const role = msg.role;
    const content = msg.content || '';

    if (role === 'user') {
      if (/不对|不是|错|错误|修正|更正|不应该|记错了/.test(content)) {
        candidates.push({
          type: 'feedback', topic: extractTopic(content),
          event: extractCorrectionEvent(content, messages),
          lesson: extractWhyWrong(content), howToApply: extractHowToApply(content),
          source: 'correction', scope: 'episodic', confidence: 0.8,
        });
      }

      if (/偏好|喜欢|希望|要|不要|最好|尽量/.test(content)) {
        candidates.push({
          type: 'user', topic: extractTopic(content),
          preference: extractPreference(content),
          context: extractContext(content, messages),
          source: 'user', scope: 'profile', confidence: 0.75,
        });
      }

      if (/方向.*确定|决定|选定为|最终方案/.test(content)) {
        candidates.push({
          type: 'project', topic: '研究/项目方向',
          decision: extractDecision(content),
          rationale: extractRationale(content, messages),
          source: 'user', scope: 'project', confidence: 0.9,
        });
      }
    }

    if (role === 'assistant') {
      if (/新方法|新工具|学到了|了解到|推荐使用|这个技巧/.test(content)) {
        candidates.push({
          type: 'reference', topic: extractTopic(content),
          knowledge: extractKnowledge(content),
          source: 'assistant_teaching', scope: 'semantic', confidence: 0.7,
        });
      }

      if (hasSuccessfulPattern(content)) {
        candidates.push({
          type: 'reference', topic: extractToolName(content),
          knowledge: extractToolUsage(content),
          source: 'successful_pattern', scope: 'semantic', confidence: 0.75,
        });
      }
    }
  }

  return deduplicateCandidates(candidates);
}

async function extractInCurrentContext(candidates, sessionTranscript) {
  const extracted = [];

  for (const cand of candidates) {
    const mem = {
      type:       cand.type,
      topic:      cand.topic  || '未分类',
      scope:      cand.scope  || 'episodic',
      summary:    cand.lesson || cand.preference || cand.knowledge || null,
      detail:     cand.detail  || null,
      event:      cand.event  || null,
      confidence: cand.confidence || 0.7,
      source:     cand.source  || 'general',
      importance: cand.type === 'feedback' ? 'high' : 'medium',
      sensitivity: 'private',
      tags:       [cand.type],
      relatedTaskIds: [],
    };
    if (mem.type === 'feedback') {
      mem.summary = mem.summary || inferLesson(cand, sessionTranscript);
    }
    extracted.push(mem);
  }

  return extracted;
}

function collectSubagentAnnounces(messages, parentSessionKey) {
  const results = [];
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const content = msg.content || '';
    if (!content.includes('<<<BEGIN_OPENCLAW_INTERNAL_CONTEXT>>>')) continue;
    const statusMatch   = content.match(/type: subagent task\s+status: (\w+)/i);
    const childKeyMatch = content.match(/session_key: (agent:[^\s]+)/i);
    const resultMatch   = content.match(/<<<BEGIN_UNTRUSTED_CHILD_RESULT>>>\s*([\s\S]*?)\s*<<<END_UNTRUSTED_CHILD_RESULT>>>/);
    if (!statusMatch) continue;
    const status = statusMatch[1].toLowerCase().replace('completed successfully', 'done').replace('timed_out', 'timeout').replace('failed', 'failed');
    const childSessionKey = childKeyMatch ? childKeyMatch[1] : null;
    const summary = resultMatch ? (resultMatch[1].trim().slice(0, 300) || '(无内容)') : '(无summary)';
    results.push({ childSessionKey, status, summary, parentSessionKey });
  }
  return results;
}

function syncChildResultToOrchestration(announceResult, parentSessionKey) {
  const { childSessionKey, status, summary } = announceResult;
  if (!childSessionKey) return;
  const dir = path.join(OPENCLAW_HOME, 'team-orchestrations');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.includes(encodeURIComponent(parentSessionKey))).sort().reverse();
  if (files.length === 0) return;
  const filePath = path.join(dir, files[0]);
  let orch;
  try { orch = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return; }
  if (!Array.isArray(orch.children)) return;
  const idx = orch.children.findIndex(c => c.sessionKey === childSessionKey);
  if (idx === -1) return;
  orch.children[idx] = {
    ...orch.children[idx], status,
    summary: summary || orch.children[idx].summary,
    resultDigest: shortHashOf(summary || ''),
    lastActivityAt: Date.now(),
  };
  orch.updatedAt = Date.now();
  try { fs.writeFileSync(filePath, JSON.stringify(orch, null, 2), 'utf8'); } catch {}
}

// ============================================================================
// 辅助函数
// ============================================================================

function cursorFilter(messages, lastMemoryMessageUuid) {
  if (!lastMemoryMessageUuid) return messages;
  const idx = messages.findIndex(m => m.uuid === lastMemoryMessageUuid);
  return idx >= 0 ? messages.slice(idx + 1) : messages;
}

function extractTopic(content) {
  return content.replace(/\n+/g, ' ').replace(/[#*`]/g, '').slice(0, 60) || '未分类';
}

function extractCorrectionEvent(content, messages) {
  const userIdx = messages.findIndex(m => m.content === content);
  if (userIdx > 0 && messages[userIdx - 1].role === 'assistant') {
    return `用户纠正了之前的回答。上轮 assistant 说："${messages[userIdx - 1].content.slice(0, 100)}..."`;
  }
  return content.slice(0, 100);
}

function extractWhyWrong(content) {
  if (/不是我|不是的|记错了|搞错了/.test(content)) return '记错了用户的信息或上下文';
  if (/不对|错|错误/.test(content)) return '之前的回答存在事实或逻辑错误';
  if (/重新|改一下/.test(content)) return '之前的处理方式需要调整';
  return '用户的预期与实际不符，需要修正';
}

function extractHowToApply(content) {
  if (/不是我|不是我本人/.test(content)) return '回复前先确认用户身份，不直接假设';
  if (/重新|改/.test(content)) return '按照用户新的指示重新执行';
  return '遇到纠正时，立即更新认知，不再重复同样的错误';
}

function extractPreference(content) { return content.slice(0, 150); }

function extractContext(content, messages) {
  const idx = messages.findIndex(m => m.content === content);
  if (idx > 0 && messages[idx - 1].role === 'assistant') {
    return `在讨论"${messages[idx - 1].content?.slice(0, 50)}..."时表达了此偏好`;
  }
  return null;
}

function extractDecision(content) {
  const match = content.match(/(决定|选定|选择|最终方案|确定).{0,100}/);
  return match ? match[0] : content.slice(0, 100);
}

function extractRationale(content, messages) {
  const idx = messages.findIndex(m => m.content === content);
  for (let i = idx - 1; i >= Math.max(0, idx - 3); i--) {
    if (messages[i].role === 'assistant') return messages[i].content.slice(0, 200);
  }
  return null;
}

function extractKnowledge(content) { return content.slice(0, 300); }

function extractToolName(content) {
  const match = content.match(/`(工具|方法|命令|技能)[:：]?([^\s`]+)`/);
  return match ? match[2] : extractTopic(content);
}

function extractToolUsage(content) {
  const codeBlocks = content.match(/```[\s\S]*?```/g);
  return codeBlocks ? codeBlocks[0].slice(0, 200) : content.slice(0, 200);
}

function hasSuccessfulPattern(content) {
  return /✅|成功|完成了|已写入|已创建|已发送|已更新/.test(content);
}

function inferLesson(cand, sessionTranscript) {
  if (cand.source === 'correction') return `避免重复同样的错误：${cand.lesson || '在回答前先确认信息准确性'}`;
  return cand.lesson || '从本次交互中学到了教训';
}

function deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter(c => {
    const key = `${c.type}:${c.topic}`.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function getRecentMemoryFiles(withinMinutes) {
  if (!fs.existsSync(MEMORY_DIR)) return [];
  const cutoff = Date.now() - withinMinutes * 60 * 1000;
  return fs.readdirSync(MEMORY_DIR)
    .filter(f => /\.md$/.test(f) && f !== 'README.md')
    .filter(f => fs.statSync(path.join(MEMORY_DIR, f)).mtimeMs > cutoff);
}

function recentlyExtractedForTopic(topic, withinMinutes = 30) {
  const files = getRecentMemoryFiles(withinMinutes);
  const topicLower = topic.toLowerCase();
  for (const file of files) {
    const content = fs.readFileSync(path.join(MEMORY_DIR, file), 'utf8');
    if (content.toLowerCase().includes(topicLower)) return true;
  }
  return false;
}

function shortHashOf(str) {
  return crypto.createHash('md5').update(str || '').digest('hex').slice(0, 8);
}

function defaultLogger(level, msg) {
  const prefix = { info: '💾', warn: '⚠️', error: '❌' }[level] || '•';
  console.log(`${prefix} [extractMemories] ${msg}`);
}

// ============================================================================
// CLI 测试入口
// ============================================================================

if (require.main === module) {
  const testTranscript = [
    { role: 'user',   content: '不对，我不是这个意思，记错了', uuid: 'msg-001', timestamp: new Date().toISOString() },
    { role: 'assistant', content: '好的，我重新理解', uuid: 'msg-002', timestamp: new Date().toISOString() },
  ];

  extractMemories(testTranscript, { logger: defaultLogger })
    .then(r => {
      console.log('\n✅ extractMemories v2 测试完成');
      console.log(`   提取: ${r.extracted.length} 条`);
      console.log(`   写入: ${r.written.length} 个文件`);
      console.log(`   跳过: ${r.skipped} 条`);
      if (r.lastMemoryMessageUuid) console.log(`   cursor: ${r.lastMemoryMessageUuid}`);
    })
    .catch(err => {
      console.error('❌ extractMemories v2 出错:', err);
      process.exit(1);
    });
}

// ============================================================================
// 导出（支持 require 或 import）
// ============================================================================

module.exports = {
  extractMemories,
  shouldExtractMemory,
  identifyMemoryCandidates,
  buildMemoryRecord,
  classifyRecord,
  checkDeduplication,
  routeRecord,
  promoteCandidate,
  writeDailyMemoryEntry: writeToEpisodicDaily,
  updateMemoryIndex: writeToMemoryIndexProfile,
  recentlyExtractedForTopic,
  generateMemoryId: (type, topic) => `mem:${type}:${shortHashOf(`${type}:${topic}:${Date.now()}`)}`,
  // 内部工具（供测试和调试）
  extractTopic,
  extractWhyWrong,
  extractHowToApply,
  hasCorrectionFeedback,
  hasProjectChange,
  hasNewReference,
  hasConfirmation,
  shortHashOf,
};
