/**
 * skillImprovement.js
 * 
 * 自动分析对话历史，识别 skill 表现，生成改进建议并写入 skill 文件。
 * 
 * 设计原则：
 * - 累积分析（每5轮），不做即时干预
 * - 只改 frontmatter 的 quality_notes，不改正文
 * - 用小模型做 side-query，降低 token 消耗
 * - 写入格式统一，便于后续检索
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

function parsePathList(value) {
  return String(value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveSkillDirs() {
  const configured = parsePathList(process.env.OPENCLAW_SKILL_DIRS);
  if (configured.length > 0) return configured;

  const openclawHome = process.env.OPENCLAW_HOME || path.join(os.homedir(), '.openclaw');
  const workspaceDir = process.env.OPENCLAW_WORKSPACE || path.join(openclawHome, 'workspace');
  const sharedDirs = parsePathList(process.env.OPENCLAW_SHARED_SKILLS_DIRS);

  return [
    path.join(workspaceDir, 'skills'),
    path.join(openclawHome, 'skills'),
    ...sharedDirs,
  ];
}

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  // 分析周期（每N轮对话分析一次）
  ANALYSIS_INTERVAL: 5,
  
  // skill 文件所在目录
  SKILL_DIRS: resolveSkillDirs(),
  
  // 每次最多分析多少轮对话
  MAX_TURNS_TO_ANALYZE: 50,
  
  // quality_notes 最大行数（超过则修剪旧内容）
  MAX_QUALITY_NOTES_LINES: 100,

  // 单次最多更新多少个 skill，避免一轮分析把所有 skill 都改一遍
  MAX_SKILLS_PER_PASS: 8,
  
  // 小模型配置（用于 side-query）
  SMALL_MODEL: {
    provider: 'minimax',
    model: 'MiniMax-M2',
  },
};

const STRATEGIC_CORE_SKILLS = [
  'team-router',
  'memory-keeper',
  'context-management',
  'evidence-first',
  'self-check',
  'flow-design',
];

// ============================================================
// 核心函数
// ============================================================

/**
 * 判断是否需要运行 skill 改进分析
 * 
 * @param {number} conversationTurns - 当前对话轮数
 * @returns {boolean}
 */
function shouldRunSkillImprovement(conversationTurns) {
  return conversationTurns > 0 && conversationTurns % CONFIG.ANALYSIS_INTERVAL === 0;
}

/**
 * 解析 skill 文件，提取 frontmatter 和正文
 * 
 * @param {string} filePath - skill 文件路径
 * @returns {{ frontmatter: object|null, body: string, raw: string }}
 */
function parseSkillFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n/);
  
  if (!frontmatterMatch) {
    return { frontmatter: null, body: raw, raw };
  }
  
  const frontmatterStr = frontmatterMatch[1];
  const body = raw.slice(frontmatterMatch[0].length);
  
  // 简单的 YAML 解析（只处理基本格式）
  const frontmatter = parseSimpleYaml(frontmatterStr);
  
  return { frontmatter, body, raw };
}

/**
 * 简单的 YAML frontmatter 解析
 * 只支持基本格式：key: value | key: |
 * 
 * @param {string} yamlStr
 * @returns {object}
 */
function parseSimpleYaml(yamlStr) {
  const result = {};
  const lines = yamlStr.split('\n');
  let currentKey = null;
  let currentValue = [];
  let inMultiline = false;
  
  for (const line of lines) {
    // 检查多行开始
    const multilineStart = line.match(/^(\w+):\s*\|$/);
    if (multilineStart) {
      if (currentKey) {
        result[currentKey] = currentValue.join('\n').trim();
      }
      currentKey = multilineStart[1];
      currentValue = [];
      inMultiline = true;
      continue;
    }
    
    if (inMultiline) {
      // 检查多行是否结束（遇到非缩进的新 key）
      if (line.match(/^\w+:/)) {
        result[currentKey] = currentValue.join('\n').trim();
        currentValue = [];
        inMultiline = false;
        
        // 重新解析这一行
        const simpleMatch = line.match(/^(\w+):\s*(.*)$/);
        if (simpleMatch) {
          currentKey = simpleMatch[1];
          const val = simpleMatch[2].trim();
          if (val) {
            result[currentKey] = val;
            currentKey = null;
          }
        }
      } else {
        currentValue.push(line.replace(/^\s+/, ''));
      }
    } else {
      const simpleMatch = line.match(/^(\w+):\s*(.*)$/);
      if (simpleMatch) {
        const key = simpleMatch[1];
        const val = simpleMatch[2].trim();
        if (val) {
          result[key] = val;
        }
      }
    }
  }
  
  if (currentKey) {
    result[currentKey] = currentValue.join('\n').trim();
  }
  
  return result;
}

/**
 * 序列化 frontmatter 为 YAML 格式
 * 
 * @param {object} frontmatter
 * @returns {string}
 */
function serializeFrontmatter(frontmatter) {
  const lines = [];
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) {
      // 多行值
      lines.push(`${key}: |`);
      for (const l of value.split('\n')) {
        lines.push(`  ${l}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  
  return `---\n${lines.join('\n')}\n---\n`;
}

/**
 * 从 skill 文件路径提取 skill 名称
 * 
 * @param {string} filePath
 * @returns {string}
 */
function extractSkillName(filePath) {
  const parsed = path.parse(filePath);
  return parsed.name; // e.g., "memory-keeper" from "memory-keeper/SKILL.md"
}

/**
 * 收集所有 skill 文件
 * 
 * @returns {Array<{name: string, path: string, frontmatter: object, body: string}>}
 */
function collectAllSkills() {
  const skills = [];
  
  for (const dir of CONFIG.SKILL_DIRS) {
    if (!fs.existsSync(dir)) continue;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = path.join(dir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;
      
      const { frontmatter, body } = parseSkillFile(skillPath);
      skills.push({
        name: entry.name,
        path: skillPath,
        frontmatter: frontmatter || {},
        body,
      });
    }
  }
  
  return skills;
}

function normalizeSkillNameList(names) {
  return [...new Set(
    (Array.isArray(names) ? names : [])
      .map(name => typeof name === 'string' ? name.trim().toLowerCase() : '')
      .filter(Boolean)
  )];
}

function resolveAutoTargetSkills(analysis, allSkills) {
  const available = new Map(allSkills.map(skill => [skill.name.toLowerCase(), skill.name]));
  const selected = [];
  const seen = new Set();

  const add = (name) => {
    const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
    const canonical = available.get(key);
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    selected.push(canonical);
  };

  for (const skill of analysis.goodSkills || []) {
    add(skill.name);
  }

  for (const suggestion of analysis.suggestions || []) {
    const text = `${suggestion.finding || ''} ${suggestion.suggestion || ''}`.toLowerCase();
    for (const skill of allSkills) {
      if (text.includes(skill.name.toLowerCase())) add(skill.name);
    }
  }

  for (const strategic of STRATEGIC_CORE_SKILLS) {
    add(strategic);
    if (selected.length >= CONFIG.MAX_SKILLS_PER_PASS) break;
  }

  return selected.slice(0, CONFIG.MAX_SKILLS_PER_PASS);
}

/**
 * 从对话历史中提取 skill 调用信息
 * 
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Map<string, {count: number, examples: Array<string>}>}
 */
function extractSkillUsage(messages) {
  const usage = new Map();
  
  // skill 调用模式：引用某个 skill 名称
  const skillPattern = /(?:使用|调用|按照|from)\s+(\w+[-]?\w*)\s*(?:skill|技能)/gi;
  
  // 工具调用模式：使用了某个工具
  const toolPattern = /(?:tool|工具):\s*(\w+[-]?\w*)/gi;
  
  for (const msg of messages) {
    const content = msg.content || '';
    
    // 查找 skill 引用
    let match;
    while ((match = skillPattern.exec(content)) !== null) {
      const skillName = match[1].toLowerCase();
      if (!usage.has(skillName)) {
        usage.set(skillName, { count: 0, examples: [] });
      }
      usage.get(skillName).count++;
      if (usage.get(skillName).examples.length < 3) {
        usage.get(skillName).examples.push(content.slice(0, 200));
      }
    }
    
    // 查找工具引用
    while ((match = toolPattern.exec(content)) !== null) {
      const toolName = match[1].toLowerCase();
      if (!usage.has(toolName)) {
        usage.set(toolName, { count: 0, examples: [] });
      }
      usage.get(toolName).count++;
    }
  }
  
  return usage;
}

/**
 * 分析对话历史，识别表现好的 skill 和有问题的 skill
 * 
 * @param {Array<{role: string, content: string}>} recentMessages
 * @param {Array} allSkills
 * @returns {{goodSkills: Array, badSkills: Array, suggestions: Array, newPatterns: Array}}
 */
function analyzeConversationPatterns(recentMessages, allSkills) {
  const goodSkills = [];
  const badSkills = [];
  const suggestions = [];
  const newPatterns = [];
  
  const skillUsage = extractSkillUsage(recentMessages);
  const skillNames = new Set(allSkills.map(s => s.name.toLowerCase()));
  
  // 统计各类模式
  let codeBlocks = 0;
  let toolCalls = 0;
  let longExplanations = 0;
  let shortReplies = 0;
  
  const positiveIndicators = ['很好', '不错', '解决了', '成功了', '✓', '✅', 'perfect', 'great'];
  const negativeIndicators = ['不对', '不是', '错了', '不行', '有问题', '奇怪', '✗', '❌', 'failed', 'error'];
  
  for (const msg of recentMessages) {
    const content = msg.content || '';
    
    // 统计代码块
    const codeBlockMatches = content.match(/```[\s\S]*?```/g);
    if (codeBlockMatches) codeBlocks += codeBlockMatches.length;
    
    // 工具调用计数
    const toolMatches = content.match(/工具[：:]?\s*(\w+)/g);
    if (toolMatches) toolCalls += toolMatches.length;
    
    // 长短回复统计
    if (content.length > 500) longExplanations++;
    if (content.length < 50) shortReplies++;
    
    // 情绪分析
    const hasPositive = positiveIndicators.some(ind => content.includes(ind));
    const hasNegative = negativeIndicators.some(ind => content.includes(ind));
    
    // 检查是否有新需求模式（用户描述新场景）
    if (msg.role === 'user') {
      const newNeedPatterns = [
        /第一次|从来|没做过/i,
        /帮我调研|帮我研究/i,
        /有没有.*方案/i,
        /除了.*还有什么/i,
      ];
      
      for (const pattern of newNeedPatterns) {
        if (pattern.test(content)) {
          newPatterns.push({
            pattern: pattern.source,
            content: content.slice(0, 100),
          });
          break;
        }
      }
    }
  }
  
  // 分析 skill 表现
  for (const [skillName, data] of skillUsage.entries()) {
    if (data.count >= 3) {
      goodSkills.push({
        name: skillName,
        callCount: data.count,
        examples: data.examples,
      });
    }
  }
  
  // 生成改进建议
  if (shortReplies > longExplanations * 2) {
    suggestions.push({
      type: 'response_style',
      finding: '回复偏短，可能缺乏必要的上下文和解释',
      suggestion: '增加回复的信息密度，提供更多证据和细节',
    });
  }
  
  if (codeBlocks === 0 && toolCalls === 0) {
    suggestions.push({
      type: 'tool_usage',
      finding: '本次对话没有产生可交付的代码或工具调用',
      suggestion: '下次遇到实现类任务时，主动产出代码或工具调用结果',
    });
  }
  
  if (newPatterns.length > 2) {
    suggestions.push({
      type: 'new_requirements',
      finding: `发现 ${newPatterns.length} 个潜在新需求模式`,
      suggestion: '考虑为这些新场景创建或扩展对应的 skill',
    });
  }
  
  // 检查 skill 覆盖缺口
  const calledLower = new Set([...skillUsage.keys()].map(k => k.toLowerCase()));
  const uncalledSkills = allSkills.filter(s => !calledLower.has(s.name.toLowerCase()));
  
  if (uncalledSkills.length > allSkills.length * 0.5) {
    suggestions.push({
      type: 'skill_coverage',
      finding: `${uncalledSkills.length} 个 skill 在本次对话中未被调用`,
      suggestion: '可能存在 skill 调用遗漏，或这些 skill 不适合当前场景',
    });
  }
  
  return {
    goodSkills,
    badSkills,
    suggestions,
    newPatterns: [...new Set(newPatterns.map(p => p.pattern))],
    stats: {
      codeBlocks,
      toolCalls,
      longExplanations,
      shortReplies,
      totalMessages: recentMessages.length,
    },
  };
}

/**
 * 生成改进记录条目
 * 
 * @param {object} analysis - 分析结果
 * @param {number} turnCount - 当前对话轮数
 * @returns {string}
 */
function generateQualityNoteEntry(analysis, turnCount) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const lines = [`## ${dateStr} 改进（第${turnCount}轮）`];
  
  // 统计摘要
  if (analysis.stats) {
    lines.push('');
    lines.push(`**统计**: ${analysis.stats.totalMessages}条消息, ${analysis.stats.codeBlocks}个代码块, ${analysis.stats.toolCalls}次工具调用`);
  }
  
  // 表现好的 skill
  if (analysis.goodSkills && analysis.goodSkills.length > 0) {
    lines.push('');
    lines.push('**表现好的 skill**:');
    for (const s of analysis.goodSkills) {
      lines.push(`- ${s.name}: 调用${s.callCount}次`);
    }
  }
  
  // 改进建议
  if (analysis.suggestions && analysis.suggestions.length > 0) {
    lines.push('');
    lines.push('**改进建议**:');
    for (const sug of analysis.suggestions) {
      lines.push(`- [${sug.type}] ${sug.finding}`);
      lines.push(`  → ${sug.suggestion}`);
    }
  }
  
  // 新需求模式
  if (analysis.newPatterns && analysis.newPatterns.length > 0) {
    lines.push('');
    lines.push('**新需求信号**:');
    for (const p of analysis.newPatterns) {
      lines.push(`- 匹配模式: \`${p}\``);
    }
  }
  
  return lines.join('\n');
}

/**
 * 追加 quality_notes 到 skill 文件
 * 
 * @param {string} skillPath - skill 文件路径
 * @param {string} noteEntry - 新的 quality_note 条目
 * @returns {boolean} 是否成功
 */
function appendQualityNote(skillPath, noteEntry) {
  try {
    const { frontmatter, body, raw } = parseSkillFile(skillPath);
    
    // 构建新的 frontmatter
    const newFrontmatter = { ...frontmatter };
    
    // 获取或创建 quality_notes
    const existingNotes = frontmatter?.quality_notes || '';
    const timestamp = new Date().toISOString().split('T')[0];
    
    // 如果已有 notes，检查是否当天已有记录（避免重复）
    if (existingNotes && existingNotes.includes(timestamp)) {
      // 已有今天记录，先删除旧的
      const lines = existingNotes.split('\n');
      const filteredLines = [];
      let skipUntilNextDate = false;
      
      for (const line of lines) {
        if (line.startsWith(`## ${timestamp}`)) {
          skipUntilNextDate = true;
          continue;
        }
        if (skipUntilNextDate && line.startsWith('## ')) {
          skipUntilNextDate = false;
        }
        if (!skipUntilNextDate) {
          filteredLines.push(line);
        }
      }
      
      newFrontmatter.quality_notes = filteredLines.join('\n').trim();
    }
    
    // 追加新条目
    const combinedNotes = existingNotes 
      ? `${existingNotes}\n\n${noteEntry}`
      : noteEntry;
    
    // 限制行数
    const noteLines = combinedNotes.split('\n');
    let finalNotes = combinedNotes;
    if (noteLines.length > CONFIG.MAX_QUALITY_NOTES_LINES) {
      finalNotes = noteLines.slice(-CONFIG.MAX_QUALITY_NOTES_LINES).join('\n');
    }
    
    newFrontmatter.quality_notes = finalNotes;
    
    // 序列化并写回
    const newFrontmatterStr = serializeFrontmatter(newFrontmatter);
    const newContent = newFrontmatterStr + body;
    
    fs.writeFileSync(skillPath, newContent, 'utf8');
    return true;
  } catch (err) {
    console.error(`[skillImprovement] 写入 quality_notes 失败: ${skillPath}`, err.message);
    return false;
  }
}

/**
 * 分析并改进所有相关 skill
 * 
 * @param {Array<{role: string, content: string}>} recentMessages - 最近的消息历史
 * @param {Array} allSkills - 所有 skill 信息
 * @param {object} options - 可选配置
 * @returns {object} 分析结果摘要
 */
async function analyzeAndImproveSkills(recentMessages, allSkills, options = {}) {
  const {
    dryRun = false,      // 仅分析，不写入
    targetSkills = null, // 指定特定 skill，为 null 表示全部
    model = null,        // 自定义模型配置
    turnCountOverride = null,
  } = options;
  
  // 限制分析的轮数
  const messagesToAnalyze = recentMessages.slice(-CONFIG.MAX_TURNS_TO_ANALYZE);
  
  // 执行分析
  const analysis = analyzeConversationPatterns(messagesToAnalyze, allSkills);
  
  // 生成改进记录
  const turnCount = Number.isFinite(turnCountOverride)
    ? Math.max(0, Math.floor(turnCountOverride))
    : recentMessages.length;
  const noteEntry = generateQualityNoteEntry(analysis, turnCount);
  const normalizedTargets = normalizeSkillNameList(targetSkills);
  const autoTargets = resolveAutoTargetSkills(analysis, allSkills);
  const effectiveTargets = normalizedTargets.length > 0 ? normalizedTargets : autoTargets;
  
  const results = {
    analysis,
    notes: [],
    errors: [],
    turnCount,
    dryRun,
    targetedSkills: effectiveTargets,
  };
  
  // 确定要更新的 skill
  const skillsToUpdate = effectiveTargets.length > 0
    ? allSkills.filter(s => effectiveTargets.includes(s.name.toLowerCase()) || effectiveTargets.includes(s.name))
    : [];
  
  // 为每个相关 skill 写入改进记录
  for (const skill of skillsToUpdate) {
    if (!dryRun) {
      const success = appendQualityNote(skill.path, noteEntry);
      if (success) {
        results.notes.push({
          skill: skill.name,
          path: skill.path,
          status: 'written',
        });
      } else {
        results.errors.push({
          skill: skill.name,
          path: skill.path,
          error: '写入失败',
        });
      }
    } else {
      results.notes.push({
        skill: skill.name,
        path: skill.path,
        status: 'dry_run',
        note: noteEntry,
      });
    }
  }
  
  return results;
}

/**
 * 手动触发 skill 改进分析
 * 
 * @param {Array} recentMessages - 最近消息
 * @param {object} options - 配置选项
 * @returns {Promise<object>}
 */
async function triggerSkillReview(recentMessages, options = {}) {
  const allSkills = collectAllSkills();
  
  return analyzeAndImproveSkills(recentMessages, allSkills, {
    ...options,
    dryRun: options.dryRun ?? true, // 手动触发默认 dryRun
  });
}

/**
 * 执行自动 skill 改进（在心跳中调用）
 * 
 * @param {number} conversationTurns - 当前对话轮数
 * @param {Array} recentMessages - 最近消息
 * @returns {Promise<object|null>} - 如果触发则返回结果，否则 null
 */
async function autoSkillImprovement(conversationTurns, recentMessages) {
  if (!shouldRunSkillImprovement(conversationTurns)) {
    return null;
  }
  
  const allSkills = collectAllSkills();
  
  return analyzeAndImproveSkills(recentMessages, allSkills, {
    dryRun: false,
    turnCountOverride: conversationTurns,
  });
}

/**
 * 获取指定 skill 的 quality_notes 历史
 * 
 * @param {string} skillName - skill 名称
 * @returns {string|null}
 */
function getSkillQualityNotes(skillName) {
  const allSkills = collectAllSkills();
  const skill = allSkills.find(s => s.name === skillName);
  
  if (!skill) return null;
  
  return skill.frontmatter?.quality_notes || null;
}

/**
 * 清理指定 skill 的 quality_notes
 * 
 * @param {string} skillName
 * @param {number} keepLastN - 保留最近 N 条记录
 * @returns {boolean}
 */
function clearSkillQualityNotes(skillName, keepLastN = 0) {
  const allSkills = collectAllSkills();
  const skill = allSkills.find(s => s.name === skillName);
  
  if (!skill) return false;
  
  const { frontmatter, body, raw } = parseSkillFile(skill.path);
  
  if (!frontmatter?.quality_notes) return true; // 已经是空的
  
  if (keepLastN > 0) {
    const lines = frontmatter.quality_notes.split('\n');
    const entries = [];
    let currentEntry = [];
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentEntry.length > 0) {
          entries.push(currentEntry.join('\n'));
        }
        currentEntry = [line];
      } else {
        currentEntry.push(line);
      }
    }
    
    if (currentEntry.length > 0) {
      entries.push(currentEntry.join('\n'));
    }
    
    const keepEntries = entries.slice(-keepLastN);
    frontmatter.quality_notes = keepEntries.join('\n\n');
  } else {
    delete frontmatter.quality_notes;
  }
  
  const newFrontmatterStr = serializeFrontmatter(frontmatter);
  fs.writeFileSync(skill.path, newFrontmatterStr + body, 'utf8');
  
  return true;
}

/**
 * 生成 skill 改进报告（用于展示给用户）
 * 
 * @param {object} analysisResults - analyzeAndImproveSkills 的返回值
 * @returns {string}
 */
function formatImprovementReport(analysisResults) {
  const { analysis, notes, errors, turnCount, dryRun, targetedSkills } = analysisResults;
  
  const lines = [];
  lines.push('## Skill 改进报告');
  lines.push('');
  lines.push(`分析轮数: ${turnCount} 轮`);
  lines.push(`模式: ${dryRun ? '🟡 预览（未写入）' : '🟢 自动改进（已写入）'}`);
  lines.push(`目标 skills: ${(Array.isArray(targetedSkills) && targetedSkills.length > 0) ? targetedSkills.join(', ') : '无明确目标（本轮未写入）'}`);
  lines.push('');
  
  // 统计
  if (analysis.stats) {
    lines.push('### 统计摘要');
    lines.push(`- 消息数: ${analysis.stats.totalMessages}`);
    lines.push(`- 代码块: ${analysis.stats.codeBlocks}`);
    lines.push(`- 工具调用: ${analysis.stats.toolCalls}`);
    lines.push(`- 详细回复: ${analysis.stats.longExplanations}`);
    lines.push(`- 简短回复: ${analysis.stats.shortReplies}`);
    lines.push('');
  }
  
  // 表现好的 skill
  if (analysis.goodSkills && analysis.goodSkills.length > 0) {
    lines.push('### ✅ 表现好的 skill');
    for (const s of analysis.goodSkills) {
      lines.push(`- **${s.name}**: 调用${s.callCount}次`);
    }
    lines.push('');
  }
  
  // 改进建议
  if (analysis.suggestions && analysis.suggestions.length > 0) {
    lines.push('### 💡 改进建议');
    for (const sug of analysis.suggestions) {
      lines.push(`**${sug.type}**: ${sug.finding}`);
      lines.push(`→ ${sug.suggestion}`);
      lines.push('');
    }
  }
  
  // 写入结果
  if (notes.length > 0) {
    lines.push('### 📝 写入记录');
    for (const n of notes) {
      lines.push(`- ${n.skill}: ${n.status === 'written' ? '✅ 已写入' : '🟡 预览'}`);
    }
    lines.push('');
  }
  
  // 错误
  if (errors.length > 0) {
    lines.push('### ❌ 错误');
    for (const e of errors) {
      lines.push(`- ${e.skill}: ${e.error}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 核心函数
  shouldRunSkillImprovement,
  analyzeAndImproveSkills,
  autoSkillImprovement,
  triggerSkillReview,
  
  // 工具函数
  collectAllSkills,
  extractSkillUsage,
  analyzeConversationPatterns,
  parseSkillFile,
  appendQualityNote,
  getSkillQualityNotes,
  clearSkillQualityNotes,
  formatImprovementReport,
  
  // 配置
  CONFIG,
};
