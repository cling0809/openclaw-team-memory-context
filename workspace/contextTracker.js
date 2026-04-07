/**
 * contextTracker.js — 小龙虾上下文追踪器
 *
 * 注意：当前正式主线已迁移到 dist/runtime 治理链路。
 * 本文件仅保留为实验/参考实现，不应再被视为生产时的上下文治理入口。
 * 参照 Claude Code 的 context.ts + compact.ts 设计
 *
 * Claude Code 关键发现：
 * - System prompt: 4200 tokens（固定）
 * - MEMORY.md: 前200行或25KB（取较小者）≈ 680 tokens
 * - Skill descriptions: ~450 tokens（只有一行描述，不加载正文）
 * - MCP tools: ~120 tokens（deferred，按需加载）
 * - Project CLAUDE.md: ~1800 tokens
 */

const CONTEXT_BUDGET = {
  SYSTEM_PROMPT: 4200,
  MEMORY_MD: 680,
  MCP_TOOLS: 120,
  SKILL_DESCRIPTIONS: 450,
  PROJECT_CLAUDE: 1800,
  ENVIRONMENT_INFO: 280,
  RESERVED_OUTPUT: 2000,  // 预留输出空间
}

// 压缩触发阈值
const TRIGGERS = {
  MICRO: { turns: 30, description: '30轮对话后微压缩' },
  AUTO: { tokens: 80000, description: '80K tokens时自动压缩' },
  WARNING: { tokens: 65000, description: '65K tokens时警告' },
}

// 估算消息token（混合语言估算）
function estimateTokens(text) {
  if (!text) return 0
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  const otherChars = text.length - chineseChars - englishWords
  return Math.ceil(chineseChars * 2 + englishWords * 1.3 + otherChars * 1)
}

// 计算当前上下文总量
function calculateContextUsage(messages, options = {}) {
  const {
    includeSystemPrompt = true,
    includeMemory = true,
    includeSkills = true,
  } = options

  let total = 0
  const breakdown = {}

  if (includeSystemPrompt) {
    breakdown.systemPrompt = CONTEXT_BUDGET.SYSTEM_PROMPT
    total += breakdown.systemPrompt
  }
  if (includeMemory) {
    breakdown.memoryMd = CONTEXT_BUDGET.MEMORY_MD
    total += breakdown.memoryMd
  }
  if (includeSkills) {
    breakdown.skillDescriptions = CONTEXT_BUDGET.SKILL_DESCRIPTIONS
    total += breakdown.skillDescriptions
  }

  breakdown.mcpTools = CONTEXT_BUDGET.MCP_TOOLS
  total += breakdown.mcpTools

  breakdown.environmentInfo = CONTEXT_BUDGET.ENVIRONMENT_INFO
  total += breakdown.environmentInfo

  breakdown.messages = messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content) + estimateTokens(msg.name || '')
  }, 0)
  total += breakdown.messages

  const effectiveWindow = 200000 - CONTEXT_BUDGET.RESERVED_OUTPUT
  const percentUsed = ((total / effectiveWindow) * 100).toFixed(1)

  return {
    total: Math.round(total),
    percentUsed,
    breakdown,
    effectiveWindow,
    triggers: {
      micro: total > effectiveWindow - effectiveWindow * 0.1,
      auto: total > TRIGGERS.AUTO.tokens,
      warning: total > TRIGGERS.WARNING.tokens,
    },
  }
}

// 生成上下文状态报告
function getContextStatus(messages, options) {
  const usage = calculateContextUsage(messages, options)

  const status = { level: 'NORMAL', color: '🟢', actions: [] }

  if (usage.triggers.warning) {
    status.level = 'WARNING'
    status.color = '🟡'
    status.actions.push('考虑使用 /compact 命令')
  }
  if (usage.triggers.auto) {
    status.level = 'CRITICAL'
    status.color = '🔴'
    status.actions.push('立即触发 autoCompact！')
  }

  return {
    ...status,
    ...usage,
    recommendation: status.actions.length > 0
      ? status.actions.join(', ')
      : '上下文使用正常',
  }
}

// 判断是否需要压缩
function shouldCompact(messages, threshold = TRIGGERS.AUTO.tokens) {
  const usage = calculateContextUsage(messages)
  return usage.total > threshold
}

// 压缩策略选择
function chooseCompactStrategy(messages) {
  const usage = calculateContextUsage(messages)

  if (usage.total > TRIGGERS.AUTO.tokens) return 'autoCompact'
  if (usage.breakdown.messages > CONTEXT_BUDGET.SYSTEM_PROMPT * 5) return 'microCompact'
  return null
}

module.exports = {
  CONTEXT_BUDGET,
  TRIGGERS,
  estimateTokens,
  calculateContextUsage,
  getContextStatus,
  shouldCompact,
  chooseCompactStrategy,
}

// CLI 入口：node contextTracker.js [session_json_file]
if (require.main === module) {
  const args = process.argv.slice(2);
  const sessionFile = args[0];

  let messages = [];
  if (sessionFile) {
    try {
      const content = require('fs').readFileSync(sessionFile, 'utf8');
      const data = JSON.parse(content);
      messages = Array.isArray(data) ? data : (data.messages || []);
    } catch (e) {
      console.error(`无法读取 ${sessionFile}: ${e.message}`);
      process.exit(1);
    }
  } else {
    // 无参数时生成示例
    messages = [
      { role: 'user', content: '这是一条示例消息，用来测试上下文占用。'.repeat(50) },
      { role: 'assistant', content: '这是回复，内容占位符。'.repeat(50) },
    ];
  }

  const report = getContextStatus(messages);
  console.log('\n📊 上下文状态报告');
  console.log('='.repeat(40));
  console.log(`${report.color} 状态: ${report.level}`);
  console.log(`🔢 总 token 估算: ${report.total}`);
  console.log(`📈 已用窗口: ${report.percentUsed}%`);
  console.log(`💡 建议: ${report.recommendation}`);
  console.log('\n明细：');
  Object.entries(report.breakdown).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} tokens`);
  });
}
