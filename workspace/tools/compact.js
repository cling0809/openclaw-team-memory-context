/**
 * compact.ts - Context 压缩核心
 *
 * 在 workspace memory/ 目录下维护一个 compact 日志
 * 支持 Auto Compact 和 Micro Compact 两种模式
 */

const fs = require('fs');
const path = require('path');
const { estimateTokens } = require('./token-counter');

// 默认保留的工具类型
const DEFAULT_KEEP_TOOLS = ['Read', 'Bash', 'Grep', 'WebSearch'];

// COMPACT boundary 标记
function makeBoundary() {
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').substring(0, 19);
  return `===== COMPACT ${ts} =====`;
}

/**
 * 解析 transcript 文件为消息块
 */
function parseTranscript(content) {
  const blocks = [];
  const lines = content.split('\n');
  let currentBlock = [];
  let currentType = 'unknown';

  for (const line of lines) {
    // 检测角色标记
    if (line.match(/^## \[(user|assistant|system)\]/i)) {
      // 保存之前的 block
      if (currentBlock.length > 0) {
        blocks.push({ type: currentType, raw: currentBlock.join('\n') });
      }
      currentBlock = [line];
      const match = line.match(/^## \[(user|assistant|system)\]/i);
      currentType = (match && match[1] && match[1].toLowerCase()) || 'unknown';
    } else if (line.match(/^## tool/i)) {
      if (currentBlock.length > 0) {
        blocks.push({ type: currentType, raw: currentBlock.join('\n') });
      }
      currentBlock = [line];
      currentType = 'tool';
    } else if (line.startsWith('===== COMPACT')) {
      if (currentBlock.length > 0) {
        blocks.push({ type: currentType, raw: currentBlock.join('\n') });
      }
      currentBlock = [];
      currentType = 'compact-boundary';
      blocks.push({ type: 'compact-boundary', raw: line });
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push({ type: currentType, raw: currentBlock.join('\n') });
  }

  return blocks;
}

/**
 * 为每个 block 估算 token
 */
async function tokenizeBlocks(blocks) {
  const withTokens = await Promise.all(blocks.map(async b => ({
    ...b,
    tokens: await estimateTokens(b.raw)
  })));
  return withTokens;
}

/**
 * 提取摘要（简单的启发式：保留首尾 + 关键信息）
 */
async function extractSummary(blocks, maxTokens) {
  const importantPatterns = [
    /决策/, /结论/, /完成/, /创建/, /修改/, /删除/,
    /decided/, /conclusion/, /completed/, /created/, /modified/, /deleted/,
    /TODO/, /FIXME/, /BUG/, /路径/, /目录/, /文件/
  ];

  const keptLines = [];
  let totalTokens = 0;

  // 保留所有用户消息（简短）
  for (const block of blocks) {
    if (block.type === 'user') {
      const lines = block.raw.split('\n').slice(0, 5); // 只保留前5行
      const text = lines.join('\n');
      const t = await estimateTokens(text);
      if (totalTokens + t < maxTokens * 0.3) {
        keptLines.push(`[USER] ${text}`);
        totalTokens += t;
      }
    }
  }

  // 保留包含重要信息的 assistant 消息
  for (const block of blocks) {
    if (block.type === 'assistant') {
      const lines = block.raw.split('\n');
      const important = lines.filter(l => importantPatterns.some(p => p.test(l)));
      if (important.length > 0) {
        const text = important.join('\n');
        const t = await estimateTokens(text);
        if (totalTokens + t < maxTokens * 0.5) {
          keptLines.push(`[ASSISTANT] ${text}`);
          totalTokens += t;
        }
      }
    }
  }

  // 保留最近的 assistant 消息（结尾）
  const assistantBlocks = blocks.filter(b => b.type === 'assistant');
  for (let i = Math.max(0, assistantBlocks.length - 3); i < assistantBlocks.length; i++) {
    const text = assistantBlocks[i].raw.substring(0, 500);
    const t = await estimateTokens(text);
    if (totalTokens + t < maxTokens * 0.8) {
      keptLines.push(`[RECENT] ${text}`);
      totalTokens += t;
    }
  }

  return keptLines.join('\n---\n') || '[对话已压缩，无关键内容可提取]';
}

/**
 * 运行 Auto Compact
 * 在 transcript 中插入 COMPACT_BOUNDARY，丢弃边界之前的内容
 */
async function runAutoCompact(transcriptPath, options) {
  options = options || {};
  const {
    warningThreshold = 65000,
    maxSummaryTokens = 13000
  } = options;

  // 读取 transcript
  const content = fs.existsSync(transcriptPath)
    ? fs.readFileSync(transcriptPath, 'utf-8')
    : '';

  const beforeTokens = await estimateTokens(content);
  const boundary = makeBoundary();

  // 解析并分块
  const blocks = parseTranscript(content);
  const tokenized = await tokenizeBlocks(blocks);

  // 找到最近的 COMPACT_BOUNDARY 之后的内容
  let startIdx = 0;
  for (let i = tokenized.length - 1; i >= 0; i--) {
    if (tokenized[i].type === 'compact-boundary') {
      startIdx = i + 1;
      break;
    }
  }

  // 收集要保留的 blocks
  const keptBlocks = [];
  let keptTokens = 0;

  // 从后往前保留，直到达到 maxSummaryTokens
  for (let i = tokenized.length - 1; i >= startIdx; i--) {
    const block = tokenized[i];
    if (keptTokens + (block.tokens || 0) < maxSummaryTokens) {
      keptBlocks.unshift(block);
      keptTokens += block.tokens || 0;
    } else {
      break;
    }
  }

  // 提取摘要
  const summary = await extractSummary(tokenized.slice(startIdx), maxSummaryTokens);
  const summaryTokens = await estimateTokens(summary);

  // 构建压缩后的内容
  const compactedContent = [
    `${boundary}`,
    '',
    `--- 压缩摘要 (${keptTokens} tokens) ---`,
    summary,
    '',
    `--- 保留的最近对话 (${keptBlocks.length} blocks) ---`,
    ...keptBlocks.map(b => b.raw),
    '',
    `--- 原始 ${beforeTokens} tokens → 压缩后 ${keptTokens + summaryTokens} tokens ---`
  ].join('\n');

  // 写入 memory/compact-log/
  const logDir = path.join(path.dirname(transcriptPath), '..', 'memory', 'compact-log');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `compact-${Date.now()}.log`);
  fs.writeFileSync(logFile, compactedContent, 'utf-8');

  const afterTokens = await estimateTokens(compactedContent);

  return {
    beforeTokens,
    afterTokens,
    savedTokens: beforeTokens - afterTokens,
    boundary,
    summary,
    timestamp: new Date().toISOString()
  };
}

/**
 * 运行 Micro Compact
 * 只清理特定工具的结果，保留用户和 assistant 决策
 */
async function runMicroCompact(transcriptPath, options) {
  options = options || {};
  const {
    keepTools = DEFAULT_KEEP_TOOLS
  } = options;

  const content = fs.existsSync(transcriptPath)
    ? fs.readFileSync(transcriptPath, 'utf-8')
    : '';

  const beforeTokens = await estimateTokens(content);
  const boundary = makeBoundary();

  // 解析 blocks
  const blocks = parseTranscript(content);

  // 处理每个 tool block
  const processedBlocks = await Promise.all(blocks.map(async block => {
    if (block.type === 'tool') {
      // 检测工具类型
      const toolName = detectToolName(block.raw);
      if (toolName && !keepTools.includes(toolName)) {
        // 替换为占位符
        const origLen = block.raw.length;
        return {
          ...block,
          raw: `[已压缩: ${toolName}结果，原${origLen}字符]`,
          tokens: await estimateTokens(`[已压缩: ${toolName}结果，原${origLen}字符]`)
        };
      }
    }
    return { ...block, tokens: await estimateTokens(block.raw) };
  }));

  // 构建压缩后的内容
  const compactedLines = [];
  for (const block of processedBlocks) {
    compactedLines.push(block.raw);
    compactedLines.push('');
  }

  const compactedContent = compactedLines.join('\n');

  // 写入日志
  const logDir = path.join(path.dirname(transcriptPath), '..', 'memory', 'compact-log');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `micro-compact-${Date.now()}.log`);
  fs.writeFileSync(logFile, compactedContent, 'utf-8');

  const afterTokens = await estimateTokens(compactedContent);

  // 生成摘要
  const summary = `[Micro Compact] 清理非关键工具结果 | 保留工具: ${keepTools.join(', ')}`;

  return {
    beforeTokens,
    afterTokens,
    savedTokens: beforeTokens - afterTokens,
    boundary,
    summary,
    timestamp: new Date().toISOString()
  };
}

/**
 * 检测工具名称
 */
function detectToolName(blockRaw) {
  // 匹配 "## tool: ToolName" 或 "ToolName(...)" 格式
  const match = blockRaw.match(/##\s*tool:\s*(\w+)|^(\w+)\s*\(/);
  if (match) {
    return match[1] || match[2] || null;
  }

  // 常见工具名模式
  const knownTools = ['Read', 'Bash', 'Grep', 'WebSearch', 'Write', 'Edit', 'Glob', 'Todo'];
  for (const tool of knownTools) {
    if (blockRaw.includes(tool)) {
      return tool;
    }
  }

  return null;
}

/**
 * 获取最新的 transcript 文件路径
 */
async function findLatestTranscript() {
  const workspace = process.env.OPENCLAW_WORKSPACE ||
    path.join(process.env.HOME || '', '.openclaw', 'workspace');
  const transcriptsDir = path.join(workspace, 'memory', 'transcripts');

  if (!fs.existsSync(transcriptsDir)) {
    return null;
  }

  const files = fs.readdirSync(transcriptsDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.txt'))
    .map(f => ({
      name: f,
      path: path.join(transcriptsDir, f),
      mtime: fs.statSync(path.join(transcriptsDir, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files[0] && files[0].path || null;
}

// ============================================================
// 单元测试
// ============================================================
async function runTests() {
  console.log('\n🧪 compact.ts 单元测试\n');

  let passed = 0;
  let failed = 0;
  const asyncTests = [];

  function test(name, fn) {
    try {
      const result = fn();
      if (result instanceof Promise) {
        asyncTests.push(result.then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        }).catch(e => {
          console.log(`  ❌ ${name}: ${e.message}`);
          failed++;
        }));
      } else {
        console.log(`  ✅ ${name}`);
        passed++;
      }
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, msg) {
    msg = msg || '';
    if (actual !== expected) {
      throw new Error(`${msg} expected ${expected}, got ${actual}`);
    }
  }

  test('makeBoundary 生成正确格式的边界标记', () => {
    const b = makeBoundary();
    assertEqual(b.startsWith('===== COMPACT '), true, 'boundary starts with prefix');
    assertEqual(b.endsWith(' ====='), true, 'boundary ends with suffix');
  });

  test('parseTranscript 正确解析 ## [user] 标记', () => {
    const content = `## [user]
hello world
## [assistant]
hi there`;
    const blocks = parseTranscript(content);
    assertEqual(blocks.length, 2, 'should have 2 blocks');
    assertEqual(blocks[0].type, 'user', 'first block is user');
    assertEqual(blocks[1].type, 'assistant', 'second block is assistant');
  });

  test('parseTranscript 正确识别 COMPACT boundary', () => {
    const content = `## [user]
hello
===== COMPACT 2026-04-09 02:00:00 =====
## [assistant]
hi`;
    const blocks = parseTranscript(content);
    const boundaryBlock = blocks.find(b => b.type === 'compact-boundary');
    assertEqual(boundaryBlock !== undefined, true, 'should have boundary block');
    assertEqual(boundaryBlock && boundaryBlock.raw.includes('COMPACT'), true, 'boundary includes COMPACT');
  });

  test('parseTranscript 正确解析 ## tool 标记', () => {
    const content = `## tool
## tool: Read
file content here`;
    const blocks = parseTranscript(content);
    assertEqual(blocks.some(b => b.type === 'tool'), true, 'should have tool block');
  });

  test('detectToolName 从 ## tool: ToolName 格式提取工具名', () => {
    assertEqual(detectToolName('## tool: Read'), 'Read');
    assertEqual(detectToolName('## tool: Bash'), 'Bash');
  });

  test('detectToolName 从已知工具名匹配', () => {
    assertEqual(detectToolName('Read file: /tmp/test.txt'), 'Read');
    assertEqual(detectToolName('Bash: ls -la'), 'Bash');
  });

  test('detectToolName 无法识别时返回 null', () => {
    assertEqual(detectToolName('some random text'), null);
  });

  test('tokenizeBlocks 为每个 block 计算 tokens', async () => {
    const blocks = [{ type: 'user', raw: 'hello' }];
    const tokenized = await tokenizeBlocks(blocks);
    assertEqual(tokenized[0].tokens !== undefined, true, 'should have tokens');
    assertEqual(tokenized[0].tokens > 0, true, 'tokens should be > 0');
  });

  test('extractSummary 空内容返回默认消息', async () => {
    const result = await extractSummary([], 1000);
    assertEqual(result.includes('[对话已压缩'), true, 'should return default message');
  });

  test('extractSummary 保留用户消息', async () => {
    const blocks = [
      { type: 'user', raw: 'hello world test message' },
    ];
    const result = await extractSummary(blocks, 1000);
    assertEqual(result.includes('[USER]'), true, 'should include USER marker');
  });

  if (asyncTests.length > 0) {
    await Promise.all(asyncTests);
  }

  console.log(`\n  测试结果: ${passed} 通过, ${failed} 失败\n`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    if (args.includes('--test')) {
      await runTests();
      process.exit(0);
    }

    if (args.length === 0 || args.includes('--help')) {
      console.log(`
Context Compression Tool
=======================
用法:
  node compact.js auto <transcript-path>   # Auto Compact
  node compact.js micro <transcript-path>  # Micro Compact
  node compact.js --latest                 # 使用最新 transcript
  node compact.js --test                   # 运行单元测试

示例:
  node compact.js auto ./memory/transcripts/session-xxx.json
  node compact.js micro ./memory/transcripts/session-xxx.json
  node compact.js auto --latest

Auto Compact:
  - 当 token 达到 warningThreshold 时触发
  - 在对话中插入 COMPACT_BOUNDARY
  - 丢弃边界之前的内容，保留摘要

Micro Compact:
  - 逐条清理工具结果（默认保留 Read/Bash/Grep/WebSearch）
  - 用 [已压缩: 原N字符] 占位符替换
  - 保留用户输入和 assistant 决策
`);
      process.exit(0);
    }

    const command = args[0];
    let transcriptPath;

    if (args.includes('--latest')) {
      const latest = await findLatestTranscript();
      if (!latest) {
        console.error('错误: 未找到 transcript 文件');
        process.exit(1);
      }
      transcriptPath = latest;
      console.log(`使用最新 transcript: ${transcriptPath}`);
    } else {
      transcriptPath = args[1] || '';
    }

    if (!transcriptPath) {
      console.error('错误: 请提供 transcript 路径');
      process.exit(1);
    }

    if (!fs.existsSync(transcriptPath)) {
      console.error(`错误: 文件不存在: ${transcriptPath}`);
      process.exit(1);
    }

    const startTime = Date.now();

    if (command === 'auto') {
      const result = await runAutoCompact(transcriptPath);
      console.log('\n✅ Auto Compact 完成');
      console.log(`   压缩前: ${result.beforeTokens} tokens`);
      console.log(`   压缩后: ${result.afterTokens} tokens`);
      console.log(`   节省: ${result.savedTokens} tokens`);
      console.log(`   边界: ${result.boundary}`);
      console.log(`   耗时: ${Date.now() - startTime}ms`);
    } else if (command === 'micro') {
      const result = await runMicroCompact(transcriptPath);
      console.log('\n✅ Micro Compact 完成');
      console.log(`   压缩前: ${result.beforeTokens} tokens`);
      console.log(`   压缩后: ${result.afterTokens} tokens`);
      console.log(`   节省: ${result.savedTokens} tokens`);
      console.log(`   边界: ${result.boundary}`);
      console.log(`   耗时: ${Date.now() - startTime}ms`);
    } else {
      console.error(`未知命令: ${command}`);
      process.exit(1);
    }
  })().catch(err => {
    console.error('执行失败:', err);
    process.exit(1);
  });
}

module.exports = { runAutoCompact, runMicroCompact, findLatestTranscript, parseTranscript, detectToolName, tokenizeBlocks, extractSummary };
