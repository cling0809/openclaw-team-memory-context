/**
 * context-guard.ts - Context Window 守卫
 *
 * 在每条消息后检查 context 使用情况
 * 如果 token 超过阈值，打印警告或触发 compact
 */

const fs = require('fs');
const path = require('path');
const { estimateTokens, getRemainingContext, getModelContextWindow } = require('./token-counter');
const { runAutoCompact } = require('./compact');
const { withRetry } = require('../scripts/withRetry');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function color(text, c) {
  return `${colors[c]}${text}${colors.reset}`;
}

async function checkContextStatus(transcriptPath, model) {
  model = model || 'gpt4';
  let currentTokens = 0;

  if (fs.existsSync(transcriptPath)) {
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    currentTokens = await estimateTokens(content);
  }

  const { remaining, maxTokens, usagePercent } = getRemainingContext(currentTokens, model);

  let status;
  const recommendations = [];

  if (usagePercent >= 90) {
    status = 'critical';
    recommendations.push('立即执行 compact，建议: node compact.ts auto <path>');
    recommendations.push('考虑拆分会话，避免 context 溢出');
  } else if (usagePercent >= 75) {
    status = 'warning';
    recommendations.push('即将达到 context 上限，建议执行 micro compact');
    recommendations.push('可用命令: node compact.ts micro <path>');
  } else {
    status = 'ok';
    recommendations.push('context 使用正常');
  }

  return {
    currentTokens,
    maxTokens,
    usagePercent,
    status,
    recommendations,
    model,
    timestamp: new Date().toISOString()
  };
}

function printContextStatus(status) {
  const barLen = 30;
  const filled = Math.round((status.usagePercent / 100) * barLen);
  const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

  const time = new Date(status.timestamp).toLocaleTimeString('zh-CN', { hour12: false });

  console.log('');
  console.log(color(`┌─────────────────────────────────────────────────────┐`, 'gray'));
  console.log(color(`│  Context Guard  [${time}]`, 'blue'));
  console.log(color(`├─────────────────────────────────────────────────────┤`, 'gray'));

  const barColor = status.status === 'critical' ? 'red'
    : status.status === 'warning' ? 'yellow' : 'green';
  console.log(color(`│  [${bar}]`, barColor));

  const usedStr = `${status.currentTokens.toLocaleString()}`.padStart(12);
  const maxStr = `${status.maxTokens.toLocaleString()}`.padEnd(12);
  console.log(color(`│    使用: ${usedStr} / ${maxStr}  (${status.usagePercent}%)`, 'gray'));

  const statusIcon = status.status === 'critical' ? '🔴 CRITICAL'
    : status.status === 'warning' ? '🟡 WARNING' : '🟢 OK';
  const statusColor = status.status === 'critical' ? 'red'
    : status.status === 'warning' ? 'yellow' : 'green';
  console.log(color(`│    状态: ${statusIcon}`, statusColor));

  if (status.recommendations.length > 0) {
    console.log(color(`├─────────────────────────────────────────────────────┤`, 'gray'));
    for (const rec of status.recommendations.slice(0, 3)) {
      console.log(color(`│  💡 ${rec}`, 'gray'));
    }
  }

  console.log(color(`└─────────────────────────────────────────────────────┘`, 'gray'));
  console.log('');
}

function supportsColor() {
  return process.stdout.isTTY || process.env.FORCE_COLOR;
}

function log(...args) {
  if (!supportsColor()) {
    console.log(...args.map(a =>
      typeof a === 'string' ? a.replace(/\x1b\[\d+m/g, '') : a
    ));
  } else {
    console.log(...args);
  }
}

async function runGuardCheck(transcriptPath, model, options) {
  model = model || 'gpt4';
  options = options || {};

  const {
    warningPercent = 75,
    criticalPercent = 90,
    autoCompact = false
  } = options;

  const status = await checkContextStatus(transcriptPath, model);

  printContextStatus(status);

  if (status.status === 'critical' && autoCompact && options.transcriptPath) {
    log(color(`\n⚠️  达到 critical 阈值，自动执行 compact...\n`, 'red'));

    try {
      const result = await withRetry(
        () => runAutoCompact(options.transcriptPath),
        { maxRetries: 3, baseDelayMs: 500 }
      );
      log(color(`✅ Auto Compact 完成: 节省 ${result.savedTokens} tokens`, 'green'));
    } catch (err) {
      log(color(`❌ Auto Compact 失败: ${err}`, 'red'));
    }
  }

  return status;
}

async function watchContext(transcriptPath, model, intervalMs) {
  model = model || 'gpt4';
  intervalMs = intervalMs || 30000;
  let lastSize = 0;

  const watcher = fs.watch(transcriptPath, async (eventType) => {
    if (eventType === 'change') {
      const stats = fs.statSync(transcriptPath);
      if (stats.size !== lastSize) {
        lastSize = stats.size;
        await runGuardCheck(transcriptPath, model);
      }
    }
  });

  await runGuardCheck(transcriptPath, model);

  const timer = setInterval(async () => {
    await runGuardCheck(transcriptPath, model);
  }, intervalMs);

  let stopped = false;
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    watcher.close();
    process.removeListener('SIGINT', cleanup);
  };

  process.on('SIGINT', cleanup);

  return cleanup;
}

function suggestModel(currentTokens) {
  const suggestions = [];

  if (currentTokens > 100000) {
    suggestions.push('claude-3-5-sonnet (200k context)');
    suggestions.push('claude-3-opus (200k context)');
  }

  if (currentTokens > 32000) {
    suggestions.push('gpt-4-turbo (128k context)');
    suggestions.push('gpt-4o (128k context)');
  }

  return suggestions;
}

function runTests() {
  console.log('\n🧪 context-guard.ts 单元测试\n');

  let passed = 0, failed = 0;
  function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.log(`  ❌ ${name}: ${e.message}`); failed++; }
  }
  function assertEqual(a, b, msg) {
    if (a !== b) throw new Error(`${msg}: expected ${b}, got ${a}`);
  }

  test('suggestModel 当前 100k+ tokens 时推荐 claude', () => {
    const sug = suggestModel(150000);
    assertEqual(sug.some(s => s.includes('claude')), true, 'should recommend claude');
  });

  test('suggestModel 当前 32k+ tokens 时推荐 gpt-4-turbo', () => {
    const sug = suggestModel(50000);
    assertEqual(sug.some(s => s.includes('gpt-4-turbo')), true, 'should recommend turbo');
  });

  test('suggestModel 当前 < 32k tokens 时返回空列表', () => {
    const sug = suggestModel(10000);
    assertEqual(sug.length, 0, 'should return empty');
  });

  test('color 函数正确包装颜色代码', () => {
    const result = color('hello', 'red');
    assertEqual(result.includes('\x1b[31m'), true, 'should include red code');
    assertEqual(result.includes('hello'), true, 'should include text');
    assertEqual(result.includes('\x1b[0m'), true, 'should include reset');
  });

  test('checkContextStatus 文件不存在时返回 usagePercent=0', async () => {
    const status = await checkContextStatus('/tmp/nonexistent-file-xyz-12345.txt');
    assertEqual(status.currentTokens, 0, 'should be 0');
    assertEqual(status.usagePercent, 0, 'should be 0');
    assertEqual(status.status, 'ok', 'should be ok');
  });

  test('checkContextStatus 真实文件能正常计算', async () => {
    const testFile = __filename;
    const status = await checkContextStatus(testFile);
    assertEqual(status.currentTokens > 0, true, 'should have tokens');
    assertEqual(status.maxTokens > 0, true, 'should have maxTokens');
    assertEqual(status.usagePercent >= 0, true, 'should have valid percent');
  });

  test('printContextStatus 正常状态输出不抛异常', () => {
    const status = {
      currentTokens: 50000,
      maxTokens: 128000,
      usagePercent: 39,
      status: 'ok',
      recommendations: ['context 使用正常'],
      model: 'gpt4',
      timestamp: new Date().toISOString()
    };
    printContextStatus(status);
  });

  test('printContextStatus warning 状态输出不抛异常', () => {
    const status = {
      currentTokens: 100000,
      maxTokens: 128000,
      usagePercent: 78,
      status: 'warning',
      recommendations: ['即将达到 limit'],
      model: 'gpt4',
      timestamp: new Date().toISOString()
    };
    printContextStatus(status);
  });

  console.log(`\n  测试结果: ${passed} 通过, ${failed} 失败\n`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    runTests();
    process.exit(0);
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Context Guard - Context Window 守卫
==================================
用法:
  node context-guard.ts <transcript-path> [model]
  node context-guard.ts --watch <transcript-path> [model]
  node context-guard.ts --auto <transcript-path> [model]

参数:
  transcript-path    transcript 文件路径
  model              模型名称 (默认: gpt4)
                    可选: claude, gpt4, minimax 等

选项:
  --watch            实时监控模式（每 30s 检查一次）
  --auto             达到 critical 时自动执行 compact
  --json             JSON 格式输出

示例:
  node context-guard.ts ./memory/transcripts/session-xxx.json
  node context-guard.ts ./memory/transcripts/session-xxx.json claude
  node context-guard.ts --watch ./memory/transcripts/session-xxx.json
  node context-guard.ts --auto ./memory/transcripts/session-xxx.json gpt4
`);
    process.exit(0);
  }

  const isWatch = args.includes('--watch');
  const isAuto = args.includes('--auto');
  const isJson = args.includes('--json');

  const cleanArgs = args.filter(a => !a.startsWith('--'));
  const transcriptPath = cleanArgs[0] || '';
  const model = cleanArgs[1] ||
    (cleanArgs[0] && cleanArgs[0].includes('claude') ? 'claude' : 'gpt4');

  if (!transcriptPath) {
    console.error('错误: 请提供 transcript 路径');
    console.error('用法: node context-guard.ts <path> [model]');
    process.exit(1);
  }

  if (!fs.existsSync(transcriptPath)) {
    console.error(`错误: 文件不存在: ${transcriptPath}`);
    process.exit(1);
  }

  if (isWatch) {
    console.log(color(`🔍 启动实时监控: ${transcriptPath}`, 'blue'));
    console.log(color(`   按 Ctrl+C 停止\n`, 'gray'));

    watchContext(transcriptPath, model).then(cleanup => {
      process.on('SIGINT', () => {
        console.log(color('\n\n👋 停止监控', 'blue'));
        cleanup();
        process.exit(0);
      });
    });
  } else {
    const options = { autoCompact: isAuto, transcriptPath };
    runGuardCheck(transcriptPath, model, options).then(status => {
      if (isJson) {
        console.log(JSON.stringify(status, null, 2));
      }
      if (status.status === 'critical') {
        process.exit(1);
      }
    }).catch(err => {
      console.error('检查失败:', err);
      process.exit(1);
    });
  }
}
module.exports = { checkContextStatus };
