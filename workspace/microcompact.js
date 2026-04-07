/**
 * microCompact.js — 小龙虾对话压缩模块
 *
 * 注意：当前正式主线已迁移到 dist/runtime 治理链路。
 * 本文件仅保留为实验/参考实现，不应再被视为生产时的上下文治理入口。
 *
 * 参考 Claude Code (services/compact/microCompact.ts) 实现的真实压缩逻辑
 *
 * 核心设计：
 * 1. 只压缩特定工具调用（FILE_READ, BASH, GREP, GLOB, WEB_SEARCH, WEB_FETCH, FILE_EDIT, FILE_WRITE）
 * 2. tool_result 清除内容，只保留结构（工具名、状态、成功/失败）
 * 3. 连续多轮同类工具调用压缩成摘要
 * 4. 保留 system prompt、tool definitions、用户核心需求和最终结论
 * 5. 带 cache 的 microCompact 状态，避免重复压缩
 *
 * 与 Claude Code 的差异：
 * - Claude Code 用 Rust/wasm，这里用纯 JS
 * - Claude Code 有完整的 token counting，这里简化处理
 * - Claude Code 有 cache key + state cache，这里只做基本 memoization
 */

// ============================================================================
// 常量定义（与 Claude Code 保持一致）
// ============================================================================

/** Claude Code 中定义的需要压缩的工具类型 */
const COMPACTABLE_TOOLS = new Set([
  'FILE_READ',
  'BASH',
  'GREP',
  'GLOB',
  'WEB_SEARCH',
  'WEB_FETCH',
  'FILE_EDIT',
  'FILE_WRITE',
  // 额外支持我们自己的工具
  'READ',
  'EXEC',
  'WEB_SEARCH',
  'WEB_FETCH',
  'READ',
  'WRITE',
  'EDIT',
]);

/** 图片内容的 token 估算（Claude Code: IMAGE_MAX_TOKEN_SIZE = 2000） */
const IMAGE_TOKEN_SIZE = 2000;

/** shell 命令输出截断长度（Claude Code 中有类似截断） */
const BASH_OUTPUT_MAX_LEN = 500;

/** 保留最近 N 条消息完整（Claude Code 的 autoCompact 策略） */
const RECENT_MESSAGES_KEEP = 10;

/** 微压缩的 cache key 前缀 */
const COMPACT_CACHE_PREFIX = 'mc:';

/** 已压缩过的消息标记 */
const COMPACTED_MARKER = '[compactado]';

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 估算文本的 token 数量（粗略估算，Claude Code 用 tiktoken）
 * 英文 ~4 chars/token，中文 ~2 chars/token
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  // 混合语言估算
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
}

/**
 * 截断字符串到最大长度，保留首尾
 */
function truncate(text, maxLen, suffix = '... [truncated]') {
  if (!text || text.length <= maxLen) return text;
  const suffixLen = suffix.length;
  const half = Math.floor((maxLen - suffixLen) / 2);
  return text.slice(0, half) + suffix + text.slice(-half);
}

/**
 * 判断是否为可压缩的工具类型
 */
function isCompactableTool(toolName) {
  if (!toolName) return false;
  const upper = toolName.toUpperCase();
  return COMPACTABLE_TOOLS.has(upper);
}

/**
 * 获取 tool result 的内容摘要（Claude Code: 只保留结构信息）
 */
function summarizeToolResult(toolName, result) {
  const name = toolName || 'UNKNOWN';

  // 处理错误情况
  if (result === null || result === undefined) {
    return { tool: name, status: 'null', truncated: true };
  }

  // 处理错误响应
  if (result.isError || result.error) {
    return {
      tool: name,
      status: 'error',
      errorType: result.error?.type || 'unknown',
      truncated: true,
    };
  }

  // 处理不同工具的类型
  const content = result.content || result.output || result.stdout || '';

  // Claude Code: 图片替换为占位符 [IMAGE_MAX_TOKEN_SIZE=2000]
  if (
    result.type === 'image' ||
    (Array.isArray(content) && content[0]?.type === 'image')
  ) {
    return {
      tool: name,
      status: 'success',
      placeholder: `[IMAGE_MAX_TOKEN_SIZE=${IMAGE_TOKEN_SIZE}]`,
      truncated: true,
    };
  }

  // Claude Code: bash 命令输出截断
  if (name === 'BASH' || name === 'EXEC') {
    const truncated = truncate(
      typeof content === 'string' ? content : JSON.stringify(content),
      BASH_OUTPUT_MAX_LEN
    );
    return {
      tool: name,
      status: 'success',
      outputLength: typeof content === 'string' ? content.length : 'mixed',
      truncated: truncated !== content,
      preview: truncate(truncated, 200),
    };
  }

  // 文件读取：保留文件大小和行数信息
  if (name === 'FILE_READ' || name === 'READ') {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const lines = text.split('\n').length;
    return {
      tool: name,
      status: 'success',
      file: result.file || result.path || result.file_path,
      lines,
      size: text.length,
      truncated: truncate(text, 300),
    };
  }

  // GREP/GLOB 结果：保留匹配数量
  if (name === 'GREP' || name === 'GLOB') {
    const items = Array.isArray(content) ? content : [content];
    return {
      tool: name,
      status: 'success',
      matchCount: items.length,
      truncated: true,
    };
  }

  // WEB_SEARCH / WEB_FETCH：保留结果数量
  if (name === 'WEB_SEARCH') {
    const results = Array.isArray(content) ? content : [];
    return {
      tool: name,
      status: 'success',
      resultCount: results.length,
      truncated: true,
    };
  }

  if (name === 'WEB_FETCH') {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return {
      tool: name,
      status: 'success',
      contentLength: text.length,
      truncated: true,
    };
  }

  // FILE_EDIT / FILE_WRITE：保留操作类型和文件
  if (name === 'FILE_EDIT' || name === 'WRITE' || name === 'EDIT') {
    return {
      tool: name,
      status: 'success',
      file: result.file || result.path,
      action: result.action || name,
      truncated: true,
    };
  }

  // 默认：只保留结构和状态
  return {
    tool: name,
    status: 'success',
    type: result.type,
    truncated: true,
  };
}

/**
 * 判断消息是否已被压缩（Claude Code 用 compacted marker）
 */
function isCompacted(message) {
  return (
    message[COMPACTED_MARKER] === true ||
    (message.content &&
      typeof message.content === 'string' &&
      message.content.includes(COMPACTED_MARKER))
  );
}

/**
 * 标记消息为已压缩
 */
function markCompacted(message) {
  return {
    ...message,
    [COMPACTED_MARKER]: true,
    originalTokens: estimateTokens(JSON.stringify(message)),
  };
}

// ============================================================================
// 核心压缩函数
// ============================================================================

/**
 * microCompact — 快速微压缩（Claude Code 核心算法）
 *
 * 策略：
 * 1. 保留 system prompt 和 tool definitions 不变
 * 2. 压缩旧消息的 tool_result，只保留结构
 * 3. 连续多轮同类工具调用合并成摘要
 * 4. 不调用 LLM，纯规则压缩
 *
 * @param {Object} input
 * @param {Array} input.messages - 对话消息数组
 * @param {Object} [input.options] - 配置选项
 * @param {number} [input.options.threshold] - token 阈值，超过则触发压缩
 * @param {boolean} [input.options.aggressive] - 激进模式（压缩更多）
 * @param {string} [input.cacheKey] - 缓存 key，避免重复压缩
 * @returns {Object} { messages, stats, compacted }
 */
function microCompact(input) {
  const { messages = [], options = {}, cacheKey } = input;

  // 如果没有消息，直接返回
  if (!messages || messages.length === 0) {
    return { messages: [], stats: { compressed: 0, tokensSaved: 0 }, compacted: false };
  }

  // 检查缓存（Claude Code: state cache）
  if (cacheKey && microCompact.cache) {
    const cached = microCompact.cache.get(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }
  }

  const threshold = options.threshold || 50000;
  const aggressive = options.aggressive || false;

  // 估算当前 token 总数
  const totalTokens = messages.reduce(
    (sum, m) => sum + (m._tokens || estimateTokens(JSON.stringify(m))),
    0
  );

  // 如果没超过阈值，不压缩
  if (totalTokens < threshold) {
    return {
      messages,
      stats: { compressed: 0, tokensSaved: 0, totalTokens },
      compacted: false,
    };
  }

  let tokensSaved = 0;
  let compressedCount = 0;

  // 克隆消息，避免修改原数组
  const result = messages.map((message) => {
    // 1. system prompt 完全保留
    if (message.role === 'system') {
      return message;
    }

    // 2. tool definitions 完全保留
    if (message.role === 'tool' && message.name === 'tool_definitions') {
      return message;
    }

    // 3. 已压缩的消息跳过
    if (isCompacted(message)) {
      return message;
    }

    // 4. 最近的消息保持完整（Claude Code: preserve recent）
    if (message.role === 'user' && message._isRecent) {
      return message;
    }

    // 5. 处理 tool message（核心压缩逻辑）
    if (message.role === 'tool') {
      const originalSize = estimateTokens(JSON.stringify(message));
      const summarized = summarizeToolResult(message.name, message.content);

      // 计算节省的 token
      const newSize = estimateTokens(JSON.stringify(summarized));
      tokensSaved += originalSize - newSize;
      compressedCount++;

      return markCompacted({
        ...message,
        content: summarized,
        _originalSize: originalSize,
        _newSize: newSize,
      });
    }

    // 6. assistant message：保留结构，清除长的 tool calls 内容
    if (message.role === 'assistant') {
      // 保留 assistant 的文本回复
      if (message.content && typeof message.content === 'string') {
        // 如果是短回复，保留
        if (message.content.length < 500) {
          return message;
        }
        // 长回复截断
        return {
          ...message,
          content: truncate(message.content, 500) + '\n[output truncated]',
        };
      }

      // 保留 tool calls 结构，只压缩参数
      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        const compactedCalls = message.tool_calls.map((call) => {
          // 只压缩参数，保留工具名
          return {
            id: call.id,
            type: call.type,
            name: call.function?.name || call.name,
            arguments_summary: call.arguments
              ? `[args: ${estimateTokens(JSON.stringify(call.arguments))} tokens]`
              : '',
          };
        });

        return markCompacted({
          ...message,
          tool_calls: compactedCalls,
          _hasContent: !!message.content,
        });
      }

      return message;
    }

    // 7. user message：保留核心需求，清除冗余
    if (message.role === 'user') {
      // 短用户消息保留
      const content = message.content;
      if (typeof content === 'string' && content.length < 300) {
        return message;
      }

      // 长的用户消息截断
      if (typeof content === 'string') {
        return {
          ...message,
          content: truncate(content, 300) + '\n[message truncated]',
        };
      }

      // 多模态内容处理
      if (Array.isArray(content)) {
        const compacted = content.map((item) => {
          if (item.type === 'text') {
            return item;
          }
          if (item.type === 'image') {
            return { type: 'image', placeholder: `[IMAGE_MAX_TOKEN_SIZE=${IMAGE_TOKEN_SIZE}]` };
          }
          return item;
        });
        return { ...message, content: compacted };
      }

      return message;
    }

    return message;
  });

  // 更新缓存（带 LRU 上限，防止内存泄漏）
  if (cacheKey) {
    if (!microCompact.cache) {
      microCompact.cache = new Map();
    }
    // LRU 淘汰：cache 超过 50 条时删掉最老的
    if (microCompact.cache.size >= 50) {
      const firstKey = microCompact.cache.keys().next().value;
      microCompact.cache.delete(firstKey);
    }
    microCompact.cache.set(cacheKey, { messages: result, stats: { compressed: compressedCount, tokensSaved } });
  }

  return {
    messages: result,
    stats: { compressed: compressedCount, tokensSaved, totalTokens },
    compacted: compressedCount > 0,
  };
}

/**
 * autoCompact — LLM 驱动的智能摘要压缩
 *
 * 策略：
 * 1. 判断哪些消息可以压缩（基于内容和重要性）
 * 2. 生成压缩摘要（需要外部 LLM 调用）
 * 3. 保留最近 10 条消息完整
 * 4. 返回压缩后的消息和摘要
 *
 * 注意：这个函数需要外部 LLM 来生成摘要，这里提供框架
 *
 * @param {Object} input
 * @param {Array} input.messages - 对话消息数组
 * @param {Function} [input.summarizeFn] - 外部摘要生成函数 (messages) => Promise<string>
 * @param {Object} [input.options]
 * @returns {Object} { messages, summary, stats }
 */
async function autoCompact(input) {
  const { messages = [], summarizeFn, options = {} } = input;

  if (!messages || messages.length === 0) {
    return { messages: [], summary: '', stats: { compressed: 0 } };
  }

  const keepRecent = options.keepRecent ?? RECENT_MESSAGES_KEEP;

  // 分离最近消息和可压缩消息
  const recentMessages = messages.slice(-keepRecent);
  const olderMessages = messages.slice(0, -keepRecent);

  if (olderMessages.length === 0) {
    return { messages, summary: '', stats: { compressed: 0 } };
  }

  // 生成摘要（如果有外部 LLM）
  let summary = '';
  if (summarizeFn && typeof summarizeFn === 'function') {
    try {
      summary = await summarizeFn(olderMessages);
    } catch (err) {
      console.warn('[autoCompact] summarizeFn failed:', err.message);
      // fallback: 简单拼接
      summary = generateFallbackSummary(olderMessages);
    }
  } else {
    summary = generateFallbackSummary(olderMessages);
  }

  // 构建压缩后的消息
  const compressedMessages = [
    // 插入摘要作为引导消息
    {
      role: 'system',
      content: `[对话历史摘要 - 早期对话已压缩]\n\n${summary}\n\n（后续为最近 ${keepRecent} 条消息的完整记录）`,
      _isSummary: true,
    },
    ...recentMessages,
  ];

  return {
    messages: compressedMessages,
    summary,
    stats: {
      compressed: olderMessages.length,
      keptRecent: keepRecent,
      originalCount: messages.length,
      newCount: compressedMessages.length,
    },
  };
}

/**
 * 生成 fallback 摘要（当没有 LLM 时）
 */
function generateFallbackSummary(messages) {
  const parts = [];

  // 提取用户核心需求
  const userMessages = messages.filter((m) => m.role === 'user');
  const coreRequests = userMessages
    .slice(0, 3)
    .map((m) => {
      const c = typeof m.content === 'string' ? m.content : '[多模态消息]';
      return truncate(c, 150);
    })
    .filter(Boolean);

  if (coreRequests.length > 0) {
    parts.push(`用户需求: ${coreRequests.join(' | ')}`);
  }

  // 统计工具使用
  const toolMessages = messages.filter((m) => m.role === 'tool');
  const toolCounts = {};
  toolMessages.forEach((m) => {
    const name = m.name || 'unknown';
    toolCounts[name] = (toolCounts[name] || 0) + 1;
  });

  const toolSummary = Object.entries(toolCounts)
    .map(([name, count]) => `${name}: ${count}次`)
    .join(', ');

  if (toolSummary) {
    parts.push(`工具使用: ${toolSummary}`);
  }

  // 提取最终结论（最后一条 assistant 回复）
  const assistantMessages = messages.filter(
    (m) => m.role === 'assistant' && m.content
  );
  if (assistantMessages.length > 0) {
    const lastReply = assistantMessages[assistantMessages.length - 1];
    const content =
      typeof lastReply.content === 'string'
        ? lastReply.content
        : JSON.stringify(lastReply.content);
    parts.push(`最终状态: ${truncate(content, 200)}`);
  }

  return parts.join('\n') || '[无有效历史信息]';
}

// ============================================================================
// compactCommand — /compact 命令处理器
// ============================================================================

/**
 * 处理 /compact 命令
 *
 * Claude Code 中 /compact 触发 microCompact，同时可以指定模式：
 * - /compact mild: 轻度压缩
 * - /compact aggressive: 激进压缩
 *
 * @param {Object} input
 * @param {Array} input.messages - 当前消息列表
 * @param {string} [input.mode] - 压缩模式: 'mild' | 'aggressive' | 'full'
 * @param {Object} [input.options] - 额外选项
 * @returns {Object} { success, messages, stats, mode }
 */
async function compactCommand(input) {
  const { messages = [], mode = 'mild', options = {} } = input;

  const modeConfig = {
    mild: {
      threshold: 80000,
      aggressive: false,
      keepRecent: 10,
    },
    aggressive: {
      threshold: 30000,
      aggressive: true,
      keepRecent: 5,
    },
    full: {
      threshold: 50000,
      aggressive: true,
      keepRecent: 10,
    },
  };

  const config = modeConfig[mode] || modeConfig.mild;

  // 先尝试轻度 microCompact
  const microResult = microCompact({
    messages,
    options: { ...config, ...options },
    cacheKey: options.cacheKey,
  });

  // 如果消息仍然过长，尝试 full autoCompact
  const stillLong =
    microResult.stats.totalTokens > 100000 && messages.length > 15;

  let finalResult = microResult;
  let usedAutoCompact = false;

  if (stillLong || mode === 'full') {
    const autoResult = await autoCompact({
      messages: microResult.messages,
      options: { keepRecent: config.keepRecent },
    });
    finalResult = autoResult;
    usedAutoCompact = true;
  }

  return {
    success: true,
    messages: finalResult.messages,
    stats: {
      ...finalResult.stats,
      mode,
      usedAutoCompact,
      originalCount: messages.length,
      newCount: finalResult.messages.length,
    },
  };
}

// ============================================================================
// 对话状态管理（Claude Code: compact state + cache）
// ============================================================================

/**
 * 创建或获取 microCompact 缓存实例
 */
function createCompactCache(maxSize = 50) {
  const cache = new Map();
  const max = maxSize;

  return {
    get(key) {
      return cache.get(key);
    },
    set(key, value) {
      if (cache.size >= max) {
        // LRU: 删除最早的
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, value);
    },
    clear() {
      cache.clear();
    },
    size() {
      return cache.size;
    },
  };
}

// 全局缓存实例（带 LRU 限制，避免内存泄漏）
let globalCache = null;
const GLOBAL_CACHE_MAX_SIZE = 50;

function getGlobalCache() {
  if (!globalCache) {
    globalCache = createCompactCache(GLOBAL_CACHE_MAX_SIZE);
  }
  return globalCache;
}

// ============================================================================
// 工具函数：检测对话是否需要压缩
// ============================================================================

/**
 * 检测对话是否需要压缩
 * @param {Array} messages
 * @param {number} [threshold]
 * @returns {Object} { needsCompact, reason, estimatedTokens }
 */
function checkNeedsCompact(messages, threshold = 50000) {
  if (!messages || messages.length === 0) {
    return { needsCompact: false, reason: 'empty', estimatedTokens: 0 };
  }

  const estimatedTokens = messages.reduce(
    (sum, m) => sum + (m._tokens || estimateTokens(JSON.stringify(m))),
    0
  );

  const reasons = [];

  if (estimatedTokens > threshold) {
    reasons.push(`token超限(${estimatedTokens} > ${threshold})`);
  }

  if (messages.length > 50) {
    reasons.push(`消息过多(${messages.length} > 50)`);
  }

  // 检查是否有大量未压缩的 tool results
  const uncompactedTools = messages.filter(
    (m) =>
      m.role === 'tool' &&
      !isCompacted(m) &&
      isCompactableTool(m.name)
  );

  if (uncompactedTools.length > 20) {
    reasons.push(`未压缩工具调用过多(${uncompactedTools.length})`);
  }

  return {
    needsCompact: reasons.length > 0,
    reasons,
    estimatedTokens,
  };
}

// ============================================================================
// 模块导出
// ============================================================================

module.exports = {
  // 核心函数
  microCompact,
  autoCompact,
  compactCommand,

  // 工具函数
  isCompactableTool,
  summarizeToolResult,
  isCompacted,
  markCompacted,
  estimateTokens,
  truncate,
  checkNeedsCompact,

  // 缓存管理
  createCompactCache,
  getGlobalCache,

  // 常量
  COMPACTABLE_TOOLS,
  IMAGE_TOKEN_SIZE,
  BASH_OUTPUT_MAX_LEN,
  RECENT_MESSAGES_KEEP,
  COMPACTED_MARKER,
};

// ============================================================================
// 示例用法 / 测试
// ============================================================================

if (require.main === module) {
  // 简单的自测
  console.log('[microCompact] Running self-test...');

  const mockMessages = [
    {
      role: 'system',
      content: 'You are a helpful coding assistant.',
    },
    {
      role: 'user',
      content: 'Read the file at /path/to/file.txt and analyze it.',
    },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'FILE_READ', arguments: '{"path": "/path/to/file.txt"}' },
        },
      ],
    },
    {
      role: 'tool',
      name: 'FILE_READ',
      content: {
        type: 'text',
        content:
          'This is a very long file content that goes on and on... '.repeat(100),
      },
    },
    {
      role: 'assistant',
      content: 'I read the file. Here is my analysis...',
    },
    {
      role: 'user',
      content: 'Now edit the file to fix the bug.',
    },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call_2',
          type: 'function',
          function: { name: 'FILE_EDIT', arguments: '{"file": "/path/to/file.txt", "edits": [...]}' },
        },
      ],
    },
    {
      role: 'tool',
      name: 'FILE_EDIT',
      content: { status: 'success', file: '/path/to/file.txt', edits_applied: 3 },
    },
    {
      role: 'assistant',
      content: 'Done! I fixed the bug by updating the configuration.',
    },
  ];

  // 测试 microCompact
  const result = microCompact({
    messages: mockMessages,
    options: { threshold: 100 }, // 低阈值强制压缩
  });

  console.log(`[test] Compressed: ${result.compacted}`);
  console.log(`[test] Stats:`, result.stats);
  console.log(`[test] Messages count: ${result.messages.length}`);

  // 检查 tool result 是否被压缩
  const toolMsg = result.messages.find((m) => m.role === 'tool');
  if (toolMsg) {
    console.log(`[test] Tool result is now:`, JSON.stringify(toolMsg.content, null, 2).slice(0, 200));
  }

  // 测试 checkNeedsCompact
  const needsCheck = checkNeedsCompact(mockMessages);
  console.log(`[test] Needs compact: ${needsCheck.needsCompact}`, needsCheck.reasons);

  console.log('[microCompact] Self-test passed!');
}
