const PANEL_ID = "buli-team-panel";

// ── 不良人总谱 · 席位映射（从 teamTaskStore.js 统一读取） ──────────────────────
// Tranche 1: Roster 和 Status 不再重复定义，从 window.__buLiangRoster 读取
const BU_LIANG_ROSTER = window.__buLiangRoster || {
  // 主帅
  main: {
    seatId: '天暗星',
    displayName: '不良帅·李星云',
    fullTitle: '不良帅·李星云（天暗星）',
    roleType: '帅',
    rankOrder: 0,
    agentId: 'main',
    isCanonConfirmed: true,
  },
  // 常驻天罡（官方确认）
  'agent:天祐星': { seatId:'天祐星', displayName:'石瑶',    fullTitle:'天祐星·石瑶',   roleType:'天罡', rankOrder:7,  agentId:'agent:天祐星', isCanonConfirmed:true },
  'agent:天魁星': { seatId:'天魁星', displayName:'袁天罡',  fullTitle:'天魁星·袁天罡', roleType:'天罡', rankOrder:1,  agentId:'agent:天魁星', isCanonConfirmed:true },
  'agent:天立星': { seatId:'天立星', displayName:'阳叔子',  fullTitle:'天立星·阳叔子', roleType:'天罡', rankOrder:3,  agentId:'agent:天立星', isCanonConfirmed:true },
  'agent:天损星': { seatId:'天损星', displayName:'陆佑劫',  fullTitle:'天损星·陆佑劫', roleType:'天罡', rankOrder:4,  agentId:'agent:天损星', isCanonConfirmed:true },
  'agent:天巧星': { seatId:'天巧星', displayName:'上官云阙',fullTitle:'天巧星·上官云阙',roleType:'天罡', rankOrder:5,  agentId:'agent:天巧星', isCanonConfirmed:true },
  'agent:天捷星': { seatId:'天捷星', displayName:'温韬',    fullTitle:'天捷星·温韬',   roleType:'天罡', rankOrder:6,  agentId:'agent:天捷星', isCanonConfirmed:true },
  'agent:天慧星': { seatId:'天慧星', displayName:'慧明',    fullTitle:'天慧星·慧明',   roleType:'天罡', rankOrder:8,  agentId:'agent:天慧星', isCanonConfirmed:true },
  'agent:天孤星': { seatId:'天孤星', displayName:'蚩笠',    fullTitle:'天孤星·蚩笠',   roleType:'天罡', rankOrder:9,  agentId:'agent:天孤星', isCanonConfirmed:true },
  'agent:天伤星': { seatId:'天伤星', displayName:'蚩离',    fullTitle:'天伤星·蚩离',   roleType:'天罡', rankOrder:10, agentId:'agent:天伤星', isCanonConfirmed:true },
  'agent:天罪星': { seatId:'天罪星', displayName:'镜心魔',  fullTitle:'天罪星·镜心魔', roleType:'天罡', rankOrder:11, agentId:'agent:天罪星', isCanonConfirmed:true },
  'agent:天速星': { seatId:'天速星', displayName:'段成天',  fullTitle:'天速星·段成天', roleType:'天罡', rankOrder:12, agentId:'agent:天速星', isCanonConfirmed:true },
  'agent:天藏星': { seatId:'天藏星', displayName:'三千院',  fullTitle:'天藏星·三千院', roleType:'天罡', rankOrder:13, agentId:'agent:天藏星', isCanonConfirmed:true },
  // 补全席位（待官方确认，使用 rankOrder 20+ 区分）
  'agent:天威星': { seatId:'天威星', displayName:'—',      fullTitle:'天威星',         roleType:'天罡', rankOrder:20, agentId:'agent:天威星', isCanonConfirmed:false },
  'agent:天勇星': { seatId:'天勇星', displayName:'—',      fullTitle:'天勇星',         roleType:'天罡', rankOrder:21, agentId:'agent:天勇星', isCanonConfirmed:false },
  'agent:天雄星': { seatId:'天雄星', displayName:'—',      fullTitle:'天雄星',         roleType:'天罡', rankOrder:22, agentId:'agent:天雄星', isCanonConfirmed:false },
  'agent:天微星': { seatId:'天微星', displayName:'—',      fullTitle:'天微星',         roleType:'天罡', rankOrder:23, agentId:'agent:天微星', isCanonConfirmed:false },
  'agent:天究星': { seatId:'天究星', displayName:'—',      fullTitle:'天究星',         roleType:'天罡', rankOrder:24, agentId:'agent:天究星', isCanonConfirmed:false },
  'agent:天暴星': { seatId:'天暴星', displayName:'—',      fullTitle:'天暴星',         roleType:'天罡', rankOrder:25, agentId:'agent:天暴星', isCanonConfirmed:false },
  'agent:天退星': { seatId:'天退星', displayName:'—',      fullTitle:'天退星',         roleType:'天罡', rankOrder:26, agentId:'agent:天退星', isCanonConfirmed:false },
  'agent:天满星': { seatId:'天满星', displayName:'—',      fullTitle:'天满星',         roleType:'天罡', rankOrder:27, agentId:'agent:天满星', isCanonConfirmed:false },
  'agent:天剑星': { seatId:'天剑星', displayName:'—',      fullTitle:'天剑星',         roleType:'天罡', rankOrder:28, agentId:'agent:天剑星', isCanonConfirmed:false },
  'agent:天阖星': { seatId:'天阖星', displayName:'—',      fullTitle:'天阖星',         roleType:'天罡', rankOrder:29, agentId:'agent:天阖星', isCanonConfirmed:false },
  'agent:天异星': { seatId:'天异星', displayName:'—',      fullTitle:'天异星',         roleType:'天罡', rankOrder:30, agentId:'agent:天异星', isCanonConfirmed:false },
  'agent:天牢星': { seatId:'天牢星', displayName:'—',      fullTitle:'天牢星',         roleType:'天罡', rankOrder:31, agentId:'agent:天牢星', isCanonConfirmed:false },
  // ── rankOrder 2：袁天罡（天罡星别名） ─────────────────────────────────────
  'agent:天罡星': { seatId:'天罡星', displayName:'袁天罡',  fullTitle:'天罡星·袁天罡', roleType:'天罡', rankOrder:2,  agentId:'agent:天罡星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  // coder/research/frontend/qa/reviewer/dev/code-assist 等开发角色默认席位
  coder:          { seatId:'天祐星', displayName:'石瑶',      fullTitle:'天祐星·石瑶',       roleType:'天罡', rankOrder:7,  agentId:'agent:天祐星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  research:       { seatId:'天慧星', displayName:'慧明',      fullTitle:'天慧星·慧明',       roleType:'天罡', rankOrder:8,  agentId:'agent:天慧星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  frontend:       { seatId:'天巧星', displayName:'上官云阙',  fullTitle:'天巧星·上官云阙',  roleType:'天罡', rankOrder:5,  agentId:'agent:天巧星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  qa:             { seatId:'天损星', displayName:'陆佑劫',   fullTitle:'天损星·陆佑劫',    roleType:'天罡', rankOrder:4,  agentId:'agent:天损星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  reviewer:       { seatId:'天罪星', displayName:'镜心魔',    fullTitle:'天罪星·镜心魔',     roleType:'天罡', rankOrder:11, agentId:'agent:天罪星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  dev:            { seatId:'天捷星', displayName:'温韬',      fullTitle:'天捷星·温韬',       roleType:'天罡', rankOrder:6,  agentId:'agent:天捷星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'code-assist':  { seatId:'天速星', displayName:'段成天',    fullTitle:'天速星·段成天',     roleType:'天罡', rankOrder:12, agentId:'agent:天速星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  // ── 补全 rankOrder 14-19（36星序列中间段） ───────────────────────────────
  'agent:天机星': { seatId:'天机星', displayName:'待考',   fullTitle:'天机星·待考',      roleType:'天罡', rankOrder:14, agentId:'agent:天机星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天闲星': { seatId:'天闲星', displayName:'待考',   fullTitle:'天闲星·待考',      roleType:'天罡', rankOrder:15, agentId:'agent:天闲星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天玄星': { seatId:'天玄星', displayName:'待考',   fullTitle:'天玄星·待考',      roleType:'天罡', rankOrder:16, agentId:'agent:天玄星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天寿星': { seatId:'天寿星', displayName:'待考',   fullTitle:'天寿星·待考',      roleType:'天罡', rankOrder:17, agentId:'agent:天寿星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天佑星': { seatId:'天佑星', displayName:'待考',   fullTitle:'天佑星·待考',      roleType:'天罡', rankOrder:18, agentId:'agent:天佑星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天空星': { seatId:'天空星', displayName:'待考',   fullTitle:'天空星·待考',      roleType:'天罡', rankOrder:19, agentId:'agent:天空星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  // ── 补全 rankOrder 32-36（36星序列末尾） ──────────────────────────────────
  'agent:天哭星': { seatId:'天哭星', displayName:'待考',   fullTitle:'天哭星·待考',      roleType:'天罡', rankOrder:32, agentId:'agent:天哭星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天笑星': { seatId:'天笑星', displayName:'待考',   fullTitle:'天笑星·待考',      roleType:'天罡', rankOrder:33, agentId:'agent:天笑星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天牢星': { seatId:'天牢星', displayName:'待考',   fullTitle:'天牢星·待考',      roleType:'天罡', rankOrder:34, agentId:'agent:天牢星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天隐星': { seatId:'天隐星', displayName:'待考',   fullTitle:'天隐星·待考',      roleType:'天罡', rankOrder:35, agentId:'agent:天隐星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天退星': { seatId:'天退星', displayName:'待考',   fullTitle:'天退星·待考',      roleType:'天罡', rankOrder:36, agentId:'agent:天退星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
};

// ── 不良人状态标签映射（从 teamTaskStore.js 统一读取）──────────────────────────
const BU_LIANG_STATUS = window.__buLiangStatus || {
  live:       '行令中',
  queued:     '候令',
  running:    '行令中',
  done:       '已回呈',
  failed:     '折损',
  idle:       '候令',
  timed_out:  '失联',
  aborted:    '撤令',
};

// 阶段映射和 timeline 事件常量
const PHASE_LABELS = window.__phaseLabels || {
  planning:'正在拆解', research:'正在研究', synthesis:'正在汇总',
  executing:'工部承办中', verifying:'核验中', reviewing:'终审中', finalizing:'最终收尾',
};
const TIMELINE_EVENTS = window.__timelineEvents || {};

// 通过 agentId / role 查找不良人显示名
function getSeatDisplay(agentIdOrRole) {
  if (!agentIdOrRole) return '待定席位';
  const key = String(agentIdOrRole).trim();
  const entry = BU_LIANG_ROSTER[key];
  if (entry) return entry.fullTitle;
  // 模糊匹配：去掉 agent: 前缀
  const fallback = BU_LIANG_ROSTER['agent:' + key] || BU_LIANG_ROSTER[key.replace('agent:', '')];
  if (fallback) return fallback.fullTitle;
  return key;
}

// ── 天罡席位角色颜色映射 ─────────────────────────────────────────────────────
// coder=蓝(blue) / research=绿(green) / qa=橙(orange) / reviewer=红(red) / frontend=紫(purple)
const __ROLE_COLOR_AGENTS = {
  'agent:天祐星': 'coder',    // 石瑶
  'agent:天慧星': 'research',  // 慧明
  'agent:天巧星': 'frontend',  // 上官云阙
  'agent:天损星': 'qa',        // 陆佑劫
  'agent:天罪星': 'reviewer',  // 镜心魔
  'agent:天捷星': 'dev',       // 温韬
  'agent:天速星': 'code-assist', // 段成天
};

function getSeatRoleColor(child) {
  if (!child) return '';
  const agentKey = child.agentId ? String(child.agentId).trim() : '';
  const roleKey = child.role ? String(child.role).trim() : '';
  // 优先用 agentId 查表
  const role = __ROLE_COLOR_AGENTS[agentKey] || __ROLE_COLOR_AGENTS[roleKey] || '';
  return role;
}

function getSeatSessionKey(child) {
  if (!child) return '';
  return child.sessionKey || child.key || child.sessionKeyPrefix || child.session?.key || '';
}

function formatSeatLastTs(ca) {
  if (!ca?.lastTs) return '';
  const diff = Date.now() - ca.lastTs;
  if (diff < 5000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  return `${Math.floor(diff / 3600000)}小时前`;
}

// teamTaskStore: Observable Store
// P0-a-3: 防御性等待 window.__teamTaskStore 就绪（最多 3 次 × 100ms）
let __teamStore = null;
let __storeAttempts = 0;
while (__storeAttempts < 3 && __teamStore === null) {
  __teamStore = window.__teamTaskStore ?? null;
  if (__teamStore === null && __storeAttempts < 2) {
    const sync = window.__teamTaskStore; // 触发同步访问后再检测
    if (sync === undefined) {
      // 使用 MessageChannel 做最小化等待（约 100ms）
      const mc = new MessageChannel();
      mc.port1.onmessage = () => {};
      mc.port2.postMessage('');
    }
  }
  __storeAttempts++;
}
if (__teamStore === null) {
  // store 可能晚于 panel 注入；这里保持静默，后续轮询会自动接管。
}
const __teamHelpers = window.__teamTaskHelpers ?? null;
const teamTaskStore = __teamStore;
const syncFromSessions = __teamHelpers?.syncFromSessions ?? null;
const getTimeline = __teamHelpers?.getTimeline ?? null;
const STORAGE_KEY = "openclaw.bulieren.panel.v2";

// ── 实时活动追踪器 (借鉴 Claude Code ProgressTracker / AgentProgressLine) ────
const ActivityTracker = {
  _state: {
    runStartedAt: null,
    lastRunId: null,
    currentTool: null,
    currentToolDesc: null,
    toolUseCount: 0,
    recentActivities: [],
    childActivities: new Map(),
    lastMessageCount: 0,
    isStreaming: false,
  },
  TOOL_LABELS: {
    Read:'阅览', Write:'书写', Edit:'修改', Bash:'执令',
    Search:'搜寻', Grep:'检索', ListDir:'巡查', Glob:'探查',
    WebFetch:'飞鸽传书', TodoRead:'查阅令单', TodoWrite:'落笔令单',
    Task:'派遣天罡', SubAgent:'遣使', Agent:'遣使',
    read_file:'阅览', write_file:'书写', edit_file:'修改',
    replace_string_in_file:'修改', multi_replace_string_in_file:'批改',
    run_command:'执令', search:'搜寻', list_dir:'巡查',
    semantic_search:'搜寻', grep_search:'检索', file_search:'探查',
    run_in_terminal:'执令', create_file:'新建', fetch_webpage:'飞鸽传书',
    mcp:'密令通道',
  },
  getToolLabel(toolName) {
    if (!toolName) return '';
    if (this.TOOL_LABELS[toolName]) return this.TOOL_LABELS[toolName];
    const lower = toolName.toLowerCase();
    for (const [key, label] of Object.entries(this.TOOL_LABELS)) {
      if (lower.includes(key.toLowerCase())) return label;
    }
    return toolName;
  },
  getToolDesc(toolName, input) {
    if (!input || typeof input !== 'object') return this.getToolLabel(toolName);
    const lower = (toolName || '').toLowerCase();
    if (lower.includes('read') || lower.includes('edit') || lower.includes('write') || lower.includes('replace') || lower.includes('create')) {
      const path = input.file_path || input.path || input.filePath || '';
      if (path) return `${this.getToolLabel(toolName)} ${path.split('/').slice(-2).join('/')}`;
    }
    if (lower.includes('bash') || lower.includes('command') || lower.includes('terminal')) {
      const cmd = input.command || input.cmd || '';
      if (cmd) return `执令 ${cmd.slice(0, 40)}`;
    }
    if (lower.includes('search') || lower.includes('grep')) {
      const query = input.query || input.pattern || input.text || '';
      if (query) return `搜寻 "${query.slice(0, 30)}"`;
    }
    if (lower.includes('task') || lower.includes('agent') || lower.includes('subagent')) {
      const desc = input.description || input.task || input.prompt || '';
      if (desc) return `派遣 ${desc.slice(0, 30)}`;
    }
    if (lower.includes('fetch') || lower.includes('web')) {
      const url = input.url || (Array.isArray(input.urls) ? input.urls[0] : '') || '';
      if (url) return `飞鸽 ${url.slice(0, 40)}`;
    }
    return this.getToolLabel(toolName);
  },
  update(app) {
    const s = this._state;
    const runId = app?.chatRunId || null;
    const messages = Array.isArray(app?.chatMessages) ? app.chatMessages : [];
    const now = Date.now();
    if (runId !== s.lastRunId) {
      if (runId) {
        s.runStartedAt = now;
        s.toolUseCount = 0;
        s.currentTool = null;
        s.currentToolDesc = null;
        s.recentActivities = [];
      } else {
        s.runStartedAt = null;
        s.currentTool = null;
        s.currentToolDesc = null;
      }
      s.lastRunId = runId;
    }
    s.isStreaming = !!(app?.chatStream && typeof app.chatStream === 'string' && app.chatStream.length > 0);
    if (messages.length !== s.lastMessageCount) {
      s.lastMessageCount = messages.length;
      let toolCount = 0;
      let lastTool = null;
      let lastInput = null;
      const recent = messages.slice(-6);
      for (const msg of recent) {
        if (msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            toolCount++;
            lastTool = block.name;
            lastInput = block.input;
          }
        }
      }
      if (lastTool && lastTool !== s.currentTool) {
        s.currentTool = lastTool;
        s.currentToolDesc = this.getToolDesc(lastTool, lastInput);
        s.toolUseCount = toolCount;
        s.recentActivities.unshift({ toolName: lastTool, desc: s.currentToolDesc, ts: now });
        if (s.recentActivities.length > 8) s.recentActivities.length = 8;
      } else if (lastTool) {
        s.toolUseCount = toolCount;
      }
    }
    if (s.isStreaming && !s.runStartedAt) s.runStartedAt = now;
    return s;
  },
  updateChildActivities(sessionsResult) {
    const map = this._state.childActivities;
    const sessions = Array.isArray(sessionsResult?.sessions)
      ? sessionsResult.sessions
      : Array.isArray(sessionsResult)
        ? sessionsResult
        : [];
    if (!Array.isArray(sessions)) return;
    const seenKeys = new Set();
    for (const sess of sessions) {
      const key = String(sess.key || '');
      if (!key || !/:subagent:/i.test(key)) continue;
      seenKeys.add(key);
      const agentId = sess.agentId || (key.match(/^agent:([^:]+):subagent:/i)?.[1]) || sess.role || 'unknown';
      const status = normalizeRunStatus(sess.status || '');
      const toolCalls = sess.usage?.toolUsage?.totalCalls ?? 0;
      const tools = Array.isArray(sess.usage?.toolUsage?.tools) ? sess.usage.toolUsage.tools : [];
      const lastToolObj = tools.length > 0 ? tools[tools.length - 1] : null;
      const tokens = sess.usage?.totalTokens ?? (sess.inputTokens ?? 0) + (sess.outputTokens ?? 0);
      map.set(key, {
        agentId,
        sessionKey: key,
        status,
        toolCalls,
        lastTool: lastToolObj?.name || lastToolObj?.toolName || null,
        tokens,
        model: sess.model || null,
        updatedAt: sess.updatedAt || sess.updated || sess.lastActivityAt || sess.endedAt || Date.now(),
      });
    }
    for (const key of Array.from(map.keys())) {
      if (!seenKeys.has(key)) {
        map.delete(key);
      }
    }
  },
  getElapsed() {
    const s = this._state;
    if (!s.runStartedAt) return null;
    const secs = Math.floor((Date.now() - s.runStartedAt) / 1000);
    if (secs < 60) return `${secs}秒`;
    const mins = Math.floor(secs / 60);
    return `${mins}分${secs % 60}秒`;
  },
  isActive() { return !!(this._state.runStartedAt || this._state.isStreaming); },
  getSnapshot() {
    const s = this._state;
    return {
      isActive: this.isActive(),
      elapsed: this.getElapsed(),
      currentTool: s.currentTool,
      currentToolDesc: s.currentToolDesc,
      toolUseCount: s.toolUseCount,
      recentActivities: [...s.recentActivities],
      isStreaming: s.isStreaming,
      childActivities: new Map(s.childActivities),
    };
  },
  getChildActivity(sessionKey) {
    return this._state.childActivities.get(sessionKey) || null;
  },
};

function hasTrackedLiveChildActivities(activitySnapshot) {
  const childActivities = activitySnapshot?.childActivities;
  if (!(childActivities instanceof Map)) return false;
  for (const activity of childActivities.values()) {
    const status = normalizeRunStatus(activity?.status || '');
    if (status === 'live' || status === 'queued') {
      return true;
    }
  }
  return false;
}

function hasActiveTeamChildren(state) {
  const children = Array.isArray(state?.children) ? state.children : [];
  return children.some((child) => {
    const status = getChildDisplayStatus(child);
    return status === 'live' || status === 'queued';
  });
}

// ── 渲染缓存（防 innerHTML 抖动）──────────────────────────────────────────
// 比对 HTML 字符串，相同则跳过 innerHTML 赋值，杜绝 DOM 重建导致的闪烁/动画重启
const _renderCache = {};
function stableRender(el, html, cacheKey) {
  if (!el) return false;
  if (_renderCache[cacheKey] === html) return false;   // 内容未变，跳过
  el.innerHTML = html;
  _renderCache[cacheKey] = html;
  return true;
}

const DEFAULT_SECTION_STATE = {
  current: true,
  tasktree: true,
  handoff: true,
  team: true,
  sessions: false,
  actions: false,
  events: false,
};

class CircularBuffer {
  constructor(limit = 5) {
    this.limit = Math.max(1, limit);
    this.items = [];
  }
  clear() {
    this.items = [];
  }
  push(item) {
    this.items.push(item);
    if (this.items.length > this.limit) this.items.shift();
  }
  toArray() {
    return this.items.slice();
  }
}

function readPanelState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writePanelState(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

function formatAgo(ts) {
  if (!ts) return "—";
  try {
    const tsNum = Number(ts);
    if (isNaN(tsNum)) return "—";
    const diff = Date.now() - tsNum;
    if (diff < 0) return "刚刚";
    const s = Math.floor(diff / 1000);
    if (s < 60) return "刚刚";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "分钟前";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "小时前";
    const d = Math.floor(h / 24);
    if (d < 7) return d + "天前";
    return new Date(tsNum).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function getMessageText(message) {
  if (!message) return "";
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function animateNumber(el, target, duration = 400) {
  const start = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    el.textContent = Math.round(start + (target - start) * easeOutExpo(progress));
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* inferTeamState() 已删除 — 用 teamTaskStore 替代文本猜测 */

function getApp() {
  return qs("openclaw-app");
}

function getIntegratedRightConsole() {
  return qs("aside.right-console, .right-console", getApp() || document);
}

// ── teamTaskStore 辅助 ────────────────────────────────────────────────────────
// 从 store 读取子智能体列表，兼容 orchestratoinResult 格式
function getStoreChildren() {
  if (!teamTaskStore) return null;
  const state = teamTaskStore.getState();
  if (!state.children || state.children.length === 0) return null;
  return state.children.map(child => ({
    agentId: child.agentId,
    role: child.role,
    sessionKey: child.sessionKey,
    status: child.status,
    task: child.taskSummary,
    summary: child.summary || '',
    resultDigest: child.resultDigest || '',
    runtimeStatus: child.status,
  }));
}

// 返回 store 中的 phase / objective / currentWorker / nextWorker
function getStoreTaskMeta() {
  if (!teamTaskStore) return null;
  const s = teamTaskStore.getState();
  if (!s.objective && (!s.children || s.children.length === 0)) return null;
  return {
    phase: s.phase,
    objective: s.objective,
    currentWorker: s.currentWorker,
    nextWorker: s.nextWorker,
    lastHandoverReason: s.lastHandoverReason,
    lead: s.lead,
    support: s.support,
    verify: s.verify,
    review: s.review,
    status: s.status,
  };
}

function getComposer() {
  return qs("textarea") || qs("input[type='text']");
}

function setComposerValue(text, send = false) {
  const input = getComposer();
  if (!input) return;
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  if (send) {
    const sendButton = qsa("button").find((btn) => /发送|Send/i.test(btn.textContent || ""));
    sendButton?.click();
  }
}

function ensureStyles() {
  let style = qs(`#${PANEL_ID}-style`);
  if (!style) {
    style = document.createElement("style");
    style.id = `${PANEL_ID}-style`;
    document.head.appendChild(style);
  }
  style.textContent = `
    body.lpt-workbench > #${PANEL_ID} {
      pointer-events: none !important;
    }
    body.lpt-workbench > #${PANEL_ID} > * {
      pointer-events: auto !important;
    }
    /* ── 强制布局兜底：即使外部 CSS 失效，也保持左 tab 右内容 ── */
    #${PANEL_ID}.buli-integrated-host {
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      height: 100% !important;
      box-sizing: border-box !important;
    }
    #${PANEL_ID} .buli-body {
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      flex: 1 1 0% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    #${PANEL_ID} .buli-main {
      display: flex !important;
      flex-direction: row !important;
      align-items: stretch !important;
      width: 100% !important;
      flex: 1 1 0% !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }
    #${PANEL_ID} .buli-tab-bar {
      flex: 0 0 88px !important;
      width: 88px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      justify-content: flex-start !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      border-right: 1px solid rgba(201,168,76,.12) !important;
      border-bottom: none !important;
      padding: 4px 0 !important;
      box-sizing: border-box !important;
    }
    #${PANEL_ID} .buli-scroll {
      flex: 1 1 0% !important;
      width: calc(100% - 88px) !important;
      min-width: 0 !important;
      min-height: 0 !important;
      display: block !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      box-sizing: border-box !important;
    }

    /* ── Tranche 15: 军令Tab任务树 (Claude Code 风格) ── */

    /* 根容器：强制块流 */
    #${PANEL_ID} .buli-army-root {
      display: block !important; width: 100% !important; box-sizing: border-box !important;
    }

    /* ── §1 状态头 ─── */
    #${PANEL_ID} .buli-army-hdr {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 12px; margin-bottom: 8px;
      border-radius: var(--buli-radius-md, 10px);
      background: var(--buli-card-bg, rgba(17,24,43,0.60));
      border: 1px solid var(--buli-card-border, rgba(201,168,76,0.08));
    }
    #${PANEL_ID} .buli-army-hdr.on {
      border-color: var(--buli-status-live-border, rgba(224,191,104,0.28));
      background: var(--buli-status-live-bg, rgba(224,191,104,0.06));
    }
    #${PANEL_ID} .buli-army-dot-big {
      width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
      background: var(--buli-status-idle, #5a6580);
    }
    #${PANEL_ID} .buli-army-hdr.on .buli-army-dot-big {
      background: var(--buli-status-live, #e0bf68);
      box-shadow: 0 0 6px var(--buli-status-live-glow, rgba(224,191,104,.4));
      animation: bp-pulse 2s infinite;
    }
    #${PANEL_ID} .buli-army-hdr-main { flex: 1; min-width: 0; }
    #${PANEL_ID} .buli-army-hdr-name {
      font-size: 14px; font-weight: 700;
      color: var(--buli-text-accent, #e0bf68);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #${PANEL_ID} .buli-army-hdr-meta {
      font-size: 11px; color: var(--buli-text-3, #5a6580); margin-top: 3px;
    }
    #${PANEL_ID} .buli-army-hdr.on .buli-army-hdr-meta { color: var(--buli-text-2, #9da8c0); }
    #${PANEL_ID} .buli-army-hdr-phase { margin-top: 6px; }

    /* ── §2 当前操作行 ── */
    #${PANEL_ID} .buli-army-action {
      display: block !important; width: 100% !important; box-sizing: border-box !important;
      font-size: 11px; color: var(--buli-text-2); padding: 4px 8px; margin-bottom: 8px;
      background: var(--buli-tool-bg, rgba(201,168,76,.04));
      border-left: 2px solid var(--buli-tool-border, rgba(201,168,76,.15));
      border-radius: 0 3px 3px 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ── §3 军令目标卡 ── */
    #${PANEL_ID} .buli-army-obj {
      display: block !important; width: 100% !important; box-sizing: border-box !important;
      padding: 10px 12px; margin-bottom: 10px;
      border-radius: var(--buli-radius-md, 10px);
      background: var(--buli-card-bg, rgba(17,24,43,0.60));
      border: 1px solid var(--buli-card-border, rgba(201,168,76,0.08));
    }
    #${PANEL_ID} .buli-army-obj-label {
      font-size: 10px; font-weight: 700; color: var(--buli-text-3, #5a6580);
      text-transform: uppercase; letter-spacing: .08em; margin-bottom: 6px;
    }
    #${PANEL_ID} .buli-army-obj-text {
      font-size: 12px; color: var(--buli-text); line-height: 1.5; word-break: break-word;
    }

    /* ── §4 段落分隔 ── */
    #${PANEL_ID} .buli-army-section {
      display: flex !important; align-items: center; gap: 6px;
      width: 100% !important; box-sizing: border-box !important;
      font-size: 10px; font-weight: 700; color: var(--buli-text-3, #5a6580);
      text-transform: uppercase; letter-spacing: .08em;
      margin: 10px 0 6px;
    }
    #${PANEL_ID} .buli-army-section::after {
      content: ''; flex: 1; height: 1px;
      background: var(--buli-border, rgba(201,168,76,.08));
    }

    /* ── §5 任务树 ── */
    #${PANEL_ID} .buli-army-tree {
      display: block !important; width: 100% !important;
      box-sizing: border-box !important; margin-bottom: 4px;
    }
    #${PANEL_ID} .buli-army-task {
      display: block !important; width: 100% !important; box-sizing: border-box !important;
      margin-bottom: 4px; border-radius: var(--buli-radius-sm, 6px);
      border: 1px solid var(--buli-card-border, rgba(201,168,76,0.08));
      overflow: hidden;
    }
    #${PANEL_ID} .buli-army-task.live { border-color: var(--buli-status-live-border, rgba(224,191,104,0.22)); }
    #${PANEL_ID} .buli-army-task.done { border-color: var(--buli-status-done-border, rgba(74,163,111,0.22)); opacity: 0.75; }
    #${PANEL_ID} .buli-army-task.failed { border-color: var(--buli-status-fail-border, rgba(192,74,74,0.28)); }
    /* 任务卡头部：两行布局（行1: 图标+名  行2: 角色+徽标） */
    #${PANEL_ID} .buli-army-task-hdr {
      display: block !important;
      padding: 7px 8px 5px;
      background: var(--buli-card-bg, rgba(17,24,43,0.60));
    }
    #${PANEL_ID} .buli-army-task.live .buli-army-task-hdr { background: var(--buli-status-live-bg, rgba(224,191,104,0.06)); }
    #${PANEL_ID} .buli-army-task.done .buli-army-task-hdr { background: var(--buli-status-done-bg, rgba(74,163,111,0.06)); }
    #${PANEL_ID} .buli-army-task.failed .buli-army-task-hdr { background: var(--buli-status-fail-bg, rgba(192,74,74,0.06)); }
    /* 行1：图标 + 任务名 */
    #${PANEL_ID} .buli-army-task-row1 {
      display: flex !important; align-items: center; gap: 5px;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .buli-army-task-icon {
      font-size: 12px; flex-shrink: 0; width: 14px; text-align: center;
      color: var(--buli-text-3, #5a6580); line-height: 1;
    }
    #${PANEL_ID} .buli-army-task.live .buli-army-task-icon { color: var(--buli-status-live, #e0bf68); }
    #${PANEL_ID} .buli-army-task.done .buli-army-task-icon { color: var(--buli-status-done, #4aa36f); }
    #${PANEL_ID} .buli-army-task.failed .buli-army-task-icon { color: var(--buli-status-fail, #c04a4a); }
    #${PANEL_ID} .buli-army-task-name {
      font-size: 12px; font-weight: 600; color: var(--buli-text); flex: 1; min-width: 0;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      line-height: 1.3;
    }
    /* 行2：角色名（左）+ 状态徽标（右）*/
    #${PANEL_ID} .buli-army-task-row2 {
      display: flex !important; align-items: center;
      justify-content: space-between; gap: 4px;
      padding-left: 19px;
    }
    #${PANEL_ID} .buli-army-task-agent {
      font-size: 10px; color: var(--buli-text-3, #7888a5);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      flex: 1; min-width: 0;
    }
    #${PANEL_ID} .buli-army-task-badge {
      font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
      flex-shrink: 0; white-space: nowrap;
      color: var(--buli-text-3); background: rgba(90,101,128,0.12);
    }
    #${PANEL_ID} .buli-army-task-badge.live { color: var(--buli-status-live); background: var(--buli-status-live-bg); }
    #${PANEL_ID} .buli-army-task-badge.done { color: var(--buli-status-done); background: var(--buli-status-done-bg); }
    #${PANEL_ID} .buli-army-task-badge.failed { color: var(--buli-status-fail); background: var(--buli-status-fail-bg); }
    /* 当前工具行（任务节点内展开） */
    #${PANEL_ID} .buli-army-task-tool {
      padding: 3px 8px 4px 30px;
      font-size: 11px; color: var(--buli-tool-text, rgba(224,191,104,.55));
      background: rgba(0,0,0,0.12);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    /* 任务摘要（done/failed 时展开） */
    #${PANEL_ID} .buli-army-task-summary {
      padding: 3px 8px 5px 30px;
      font-size: 11px; color: var(--buli-text-2, #9da8c0); line-height: 1.4;
      background: rgba(0,0,0,0.08);
    }

    /* ── §6 上下文压力条 ── */
    #${PANEL_ID} .buli-army-pressure {
      display: block !important; width: 100% !important; margin-bottom: 10px;
    }
    #${PANEL_ID} .buli-army-pbar {
      height: 4px; border-radius: 999px;
      background: var(--buli-bg-surface-2, #151d31); overflow: hidden;
    }
    #${PANEL_ID} .buli-army-pfill {
      height: 100%; border-radius: 999px;
      transition: width 200ms ease, background 120ms ease;
      background: var(--buli-status-done, #4aa36f);
    }
    #${PANEL_ID} .buli-army-pfill.warn { background: var(--buli-warn, #d0923d); }
    #${PANEL_ID} .buli-army-pfill.critical { background: var(--buli-status-fail, #c04a4a); }
    #${PANEL_ID} .buli-army-plabel {
      display: flex !important; justify-content: space-between;
      margin-top: 2px; font-size: 10px; color: var(--buli-text-3, #5a6580);
    }

    /* ── §7 活动时间线 ── */
    #${PANEL_ID} .buli-army-events {
      display: block !important; width: 100% !important;
    }
    #${PANEL_ID} .buli-army-ev {
      display: flex !important; gap: 8px; padding: 3px 0;
      font-size: 11px; color: var(--buli-text-2); line-height: 1.4;
      border-bottom: 1px solid var(--buli-bar-border, rgba(201,168,76,.04));
    }
    #${PANEL_ID} .buli-army-ev.latest { color: var(--buli-text); font-weight: 500; }
    #${PANEL_ID} .buli-army-ev-t {
      flex-shrink: 0; min-width: 36px;
      font-size: 10px; color: var(--buli-text-3); font-variant-numeric: tabular-nums;
    }
    #${PANEL_ID} .buli-army-ev-d { flex: 1; min-width: 0; word-break: break-word; }

    /* ── §8 交接 / 空态 ── */
    #${PANEL_ID} .buli-army-handoff {
      display: block !important; width: 100% !important;
      font-size: 11px; color: var(--buli-text-2); line-height: 1.5;
      word-break: break-word;
    }

    /* ── t12 通用（驿报/案卷共用）── */
    #${PANEL_ID} .t12-tool {
      font-size: 11px; color: var(--buli-text-2); padding: 4px 6px; margin: 4px 0;
      background: var(--buli-tool-bg, rgba(201,168,76,.04));
      border-left: 2px solid var(--buli-tool-border, rgba(201,168,76,.15));
      border-radius: 0 3px 3px 0; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    #${PANEL_ID} .t12-obj {
      font-size: 12px; color: var(--buli-text); padding: 4px 0;
      line-height: 1.5; word-break: break-word;
    }
    #${PANEL_ID} .t12-ev {
      display: flex; gap: 8px; padding: 2px 0;
      font-size: 11px; color: var(--buli-text-2); line-height: 1.4;
    }
    #${PANEL_ID} .t12-ev.latest { color: var(--buli-text); font-weight: 500; }
    #${PANEL_ID} .t12-evtime {
      flex-shrink: 0; min-width: 32px; text-align: right;
      font-size: 10px; color: var(--buli-text-3); font-variant-numeric: tabular-nums;
      padding-top: 1px;
    }
  `;
}

function buildPanel() {
  ensureStyles();

  const integratedHost = getIntegratedRightConsole();
  const existing = qs(`#${PANEL_ID}`);
  const hasPaneShell = !!existing?.querySelector?.('.buli-main');
  const hasTabStage = !!existing?.querySelector?.('.buli-tab-content[data-tab-content="army"], .buli-tab-content[data-tab="army"]');

  if (!integratedHost && existing?.matches?.(`aside#${PANEL_ID}`) && hasPaneShell && hasTabStage) {
    return existing;
  }

  if (!integratedHost && existing?.matches?.(`aside#${PANEL_ID}`) && (!hasPaneShell || !hasTabStage)) {
    existing.remove();
  }

  const root = integratedHost || createEl("aside");
  root.id = PANEL_ID;
  if (integratedHost) {
    document.body.classList.remove("lpt-workbench");
    root.classList.add("buli-integrated-host");
    root.innerHTML = "";
  }
  const state = readPanelState();
  if (!integratedHost && state.open) root.classList.add("open");

  const handle = createEl("button", "buli-handle", "⬡");
  handle.title = "打开/收起不良人总谱";
  const body = createEl("section", "buli-body");
  const scroll = createEl("div", "buli-scroll");
  handle.style.pointerEvents = "auto";
  body.style.pointerEvents = "auto";

  body.innerHTML = `
    <div class="buli-head">
      <div>
        <div class="buli-title">不良人总谱</div>
        <div class="buli-subtitle">不良帅·李星云（天暗星）</div>
      </div>
    </div>
    <div class="buli-main">
      <div class="buli-tab-bar">
        <button class="buli-tab active" data-tab="army"><span class="buli-tab-icon">◈</span><span class="buli-tab-lbl">军令</span><span class="buli-tab-count zero" data-tab-count="army"></span></button>
        <button class="buli-tab" data-tab="stars"><span class="buli-tab-icon">✦</span><span class="buli-tab-lbl">天罡</span><span class="buli-tab-count zero" data-tab-count="stars"></span></button>
        <button class="buli-tab" data-tab="dispatches"><span class="buli-tab-icon">◎</span><span class="buli-tab-lbl">驿报</span><span class="buli-tab-count zero" data-tab-count="dispatches"></span></button>
        <button class="buli-tab" data-tab="archive"><span class="buli-tab-icon">≡</span><span class="buli-tab-lbl">案卷</span><span class="buli-tab-count zero" data-tab-count="archive"></span></button>
      </div>
    </div>
  `;

  // 4 个 Tab Content Area
  const tabContent = {
    army:       createEl('div', 'buli-tab-content active', ''),
    stars:      createEl('div', 'buli-tab-content', ''),
    dispatches: createEl('div', 'buli-tab-content', ''),
    archive:    createEl('div', 'buli-tab-content', ''),
  };
  Object.entries(tabContent).forEach(([id, el]) => {
    el.setAttribute('data-tab-content', id);
    el.style.cssText = id === 'army'
      ? 'display:block;width:100%;padding-top:10px;'
      : 'display:none;';
  });

  scroll.innerHTML = '';
  scroll.appendChild(tabContent.army);
  scroll.appendChild(tabContent.stars);
  scroll.appendChild(tabContent.dispatches);
  scroll.appendChild(tabContent.archive);

  // scroll 插入 .buli-main wrapper（与 tab-bar 并列）
  const mainWrapper = body.querySelector('.buli-main');
  const headEl = body.querySelector('.buli-head');
  const tabBarEl = body.querySelector('.buli-tab-bar');
  mainWrapper.appendChild(scroll);

  // 运行时强制内联布局，避免旧样式链继续把内容压进左列
  body.style.cssText = 'display:flex;flex-direction:column;width:100%;flex:1 1 0%;min-height:0;box-sizing:border-box;padding:14px 0 0 0;border-left:none;background:transparent;overflow:hidden;';
  if (headEl) {
    headEl.style.cssText = 'flex:0 0 auto;padding:0 16px 6px 16px;margin:0 0 6px 0;box-sizing:border-box;';
  }
  if (mainWrapper) {
    mainWrapper.style.cssText = 'display:flex;flex-direction:row;align-items:stretch;flex:1 1 0%;width:100%;min-height:0;overflow:hidden;box-sizing:border-box;';
  }
  if (tabBarEl) {
    tabBarEl.style.cssText = 'flex:0 0 88px;width:88px;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;overflow-y:auto;overflow-x:hidden;gap:0;background:transparent;border-right:1px solid rgba(201,168,76,0.12);border-bottom:none;box-shadow:none;padding:4px 0;box-sizing:border-box;';
  }
  scroll.style.cssText = 'flex:1 1 0%;width:calc(100% - 88px);min-width:0;min-height:0;display:block;overflow-y:auto;overflow-x:hidden;padding:6px 16px 10px 12px;box-sizing:border-box;';
  body.querySelectorAll('.buli-tab').forEach((btn) => {
    const isActive = btn.classList.contains('active');
    btn.style.cssText = `flex:0 0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:12px 6px;background:${isActive ? 'rgba(201,168,76,0.06)' : 'transparent'};border:none;border-right:2px solid ${isActive ? 'var(--buli-liujin, #c9a84c)' : 'transparent'};border-radius:0;box-shadow:none;cursor:pointer;transition:color 120ms, background 120ms;white-space:nowrap;position:relative;color:${isActive ? 'var(--buli-liujin-2, #e0bf68)' : 'rgba(157,168,192,0.72)'};`;
  });
  body.querySelectorAll('.buli-tab-icon').forEach((el) => {
    el.style.cssText = 'font-size:13px;line-height:1;color:inherit;opacity:0.8;';
  });
  body.querySelectorAll('.buli-tab-lbl').forEach((el) => {
    el.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:0.04em;color:inherit;line-height:1.2;text-align:center;';
  });
  if (integratedHost) {
    root.append(body);
  } else {
    root.append(handle, body);
    document.body.appendChild(root);
    document.body.classList.add("lpt-workbench");

    handle.addEventListener("click", () => {
      root.classList.toggle("open");
      writePanelState({ ...readPanelState(), open: root.classList.contains("open") });
    });
  }

  // ── Tranche 14: 暗桩台网格化 — 注入 .shell 网格 ──────────────────────
  buildAnkuangtai();

  // ── Tranche 14: 中栏运行状态条 ──────────────────────────────────────────
  buildStatusBar();

  return root;
}

/**
 * Tranche 14: 暗桩台 — 作为 .shell 的网格子元素
 */
function buildAnkuangtai() {
  const shell = qs('.shell', getApp() || document);
  if (!shell || qs('.buli-ankuangtai', shell)) return;

  const bar = createEl('div', 'buli-ankuangtai');
  bar.innerHTML = `
    <div class="buli-ankuangtai-header">
      <div class="buli-ankuangtai-title">
        <span>暗桩台</span>
        <span class="buli-ankuangtai-badge" data-akt-count>0</span>
      </div>
      <span class="buli-ankuangtai-toggle">▲</span>
    </div>
    <div class="buli-ankuangtai-filters">
      <span class="buli-akt-filter active" data-akt-filter="all">全部</span>
      <span class="buli-akt-filter" data-akt-filter="tool">工具</span>
      <span class="buli-akt-filter" data-akt-filter="agent">子智能体</span>
      <span class="buli-akt-filter" data-akt-filter="error">错误</span>
      <span class="buli-akt-filter" data-akt-filter="rework">返工</span>
    </div>
    <div class="buli-ankuangtai-rows" data-akt-rows></div>
  `;
  shell.appendChild(bar);

  // 暗桩台展开/收起
  const header = qs('.buli-ankuangtai-header', bar);
  header.addEventListener('click', () => {
    bar.classList.toggle('open');
  });

  // 暗桩台过滤器
  bar.addEventListener('click', (e) => {
    const filter = e.target.closest('.buli-akt-filter');
    if (!filter) return;
    bar.querySelectorAll('.buli-akt-filter').forEach(f => f.classList.remove('active'));
    filter.classList.add('active');
  });
}

/**
 * Tranche 14: 中栏运行状态条 — 注入 .content 顶部
 */
function buildStatusBar() {
  const content = qs('.content', getApp() || document);
  if (!content || qs('.buli-status-bar', content)) return;

  const bar = createEl('div', 'buli-status-bar');
  bar.innerHTML = `
    <span class="buli-status-dot"></span>
    <span class="buli-status-agent">候令</span>
    <span class="buli-status-tool"></span>
    <span class="buli-status-phase"></span>
    <span class="buli-status-pill"></span>
    <span class="buli-status-stats"></span>
  `;
  content.insertBefore(bar, content.firstChild);
}

/**
 * Tranche 14: 更新运行状态条
 */
function updateStatusBar(app, archiveRuntime = null) {
  const bar = qs('.buli-status-bar', getApp() || document);
  if (!bar) return;

  const activity = ActivityTracker.getSnapshot();
  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const sessionSnapshot = archiveRuntime?.snapshot || pickSessionSnapshot(app?.sessionsResult, app?.sessionKey || state?.sessionKey || '');
  const pressureMeta = getArchivePressureMeta(sessionSnapshot, state?.contextPressure ?? 0);
  const isRunning = !!(app?.chatRunId);
  const anyActive = activity.isActive || isRunning || activity.isStreaming;

  bar.classList.toggle('active', anyActive || pressureMeta.state === 'warm' || pressureMeta.warn);

  const agentEl = qs('.buli-status-agent', bar);
  const toolEl = qs('.buli-status-tool', bar);
  const phaseEl = qs('.buli-status-phase', bar);
  const pillEl = qs('.buli-status-pill', bar);
  const statsEl = qs('.buli-status-stats', bar);

  if (agentEl) {
    const agentName = state?.currentWorker
      ? getSeatDisplay(state.currentWorker)
      : (app?.agentId ? getSeatDisplay(app.agentId) : '不良帅');
    agentEl.textContent = anyActive ? agentName : '候令';
  }

  if (toolEl) {
    toolEl.textContent = anyActive
      ? (activity.currentToolDesc || (activity.isStreaming ? '思考中…' : ''))
      : (pressureMeta.state !== 'healthy' ? pressureMeta.label : '');
  }

  if (phaseEl) {
    const phase = state?.phase;
    const phaseLabel = PHASE_LABELS[phase || ''] || (pressureMeta.state !== 'healthy' ? pressureMeta.label : '');
    phaseEl.textContent = phaseLabel;
    phaseEl.style.display = phaseLabel ? '' : 'none';
  }

  // ── Tranche 15: Status bar pill — active subagent count ──────────────────
  if (pillEl) {
    const children = Array.isArray(state?.children) ? state.children : [];
    const liveCount = children.filter(c => getChildDisplayStatus(c) === 'live').length;
    if (liveCount > 0) {
      pillEl.textContent = `不良人 ${liveCount}`;
      pillEl.style.display = '';
      pillEl.style.cssText = 'background:rgba(201,168,76,0.18);color:#8a6c28;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:600;letter-spacing:0.02em;margin-left:4px;white-space:nowrap;vertical-align:middle;cursor:default;';
    } else {
      pillEl.style.display = 'none';
    }
  }

  if (statsEl) {
    const parts = [];
    if (pressureMeta.percent > 0) parts.push(`上下文${pressureMeta.percent}%`);
    if (pressureMeta.recommendedAction && pressureMeta.recommendedAction !== 'none') parts.push(pressureMeta.actionLabel);
    if (state?.currentTrancheId) parts.push(`tranche ${state.currentTrancheId}`);
    if (state?.latestBoundaryId) parts.push(`boundary ${compactText(state.latestBoundaryId, 16)}`);
    if (anyActive && activity.elapsed) parts.push(activity.elapsed);
    if (activity.toolUseCount > 0) parts.push(`${activity.toolUseCount}工具`);
    const msgCount = Array.isArray(app?.chatMessages) ? app.chatMessages.length : 0;
    if (msgCount > 0) parts.push(`${msgCount}消息`);
    statsEl.textContent = parts.join(' · ');
  }
}

const NATIVE_NAV_TEXT_MAP = {
  聊天: '驿报',
  控制: '军机',
  代理: '天罡',
  设置: '机枢',
  概述: '军情总览',
  频道: '驿路',
  实例: '外探分舵',
  会话: '案卷',
  使用情况: '用度',
  定时任务: '暗哨',
  技能: '秘术',
  节点: '据点',
  配置: '规制',
  文档: '卷宗',
};

function removeInjectedLeftNav() {
  qsa('.lpt-left-nav', document.body).forEach(node => node.remove());
}

function themeNativeNavigation(root = document) {
  const brandEyebrow = qs('.sidebar-brand__eyebrow', root);
  if (brandEyebrow) brandEyebrow.textContent = '天罡谱';

  const brandTitle = qs('.sidebar-brand__title', root);
  if (brandTitle) brandTitle.textContent = '不良人总谱';

  const versionLabel = qs('.sidebar-version__label', root);
  if (versionLabel) versionLabel.textContent = '行令';

  qsa('.nav-section__label-text, .nav-item__text, .dashboard-header__breadcrumb-current', root).forEach((node) => {
    const raw = String(node.textContent || '').trim();
    const mapped = NATIVE_NAV_TEXT_MAP[raw];
    if (mapped && raw !== mapped) {
      node.textContent = mapped;
    }
  });
}

// [Tranche 13] ensureSectionShell + setBodyHtml 已移除 — 所有渲染通过 stableRender 直接操作 Tab Content

async function fetchAgents(app) {
  if (!app?.client || !app.connected) return null;
  try {
    return await app.client.request("agents.list", {});
  } catch {
    return null;
  }
}

async function fetchSessions(app, options = {}) {
  if (!app?.client || !app.connected) return null;
  try {
    return await app.client.request("sessions.list", {
      includeGlobal: true,
      includeUnknown: false,
      limit: 100,
      ...options,
    });
  } catch {
    return null;
  }
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[,_\s%]/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function formatTokenCount(value) {
  const number = toFiniteNumber(value);
  if (number == null) return '—';
  if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`;
  return `${Math.round(number)}`;
}

const PRESSURE_STATE_TEXT = {
  healthy: '上下文稳态',
  warm: '上下文升温',
  hot: '上下文高压',
  critical: '上下文临界',
};

const PRESSURE_ACTION_TEXT = {
  none: '无需处置',
  compact: '建议压缩',
  spawn_new_session: '建议新案卷',
  force_split: '建议强制分案',
};

function normalizePressureState(value) {
  const state = String(value || '').trim().toLowerCase();
  if (state === 'healthy' || state === 'warm' || state === 'hot' || state === 'critical') return state;
  return '';
}

function derivePressureState(percent) {
  if (percent >= 82) return 'critical';
  if (percent >= 65) return 'hot';
  if (percent >= 45) return 'warm';
  return 'healthy';
}

function getArchivePressureMeta(snapshot, fallbackPressure = 0) {
  const rawPercent = toFiniteNumber(snapshot?.pressurePercent);
  const percent = rawPercent == null
    ? getArchivePressure(snapshot, fallbackPressure)
    : Math.max(0, Math.min(100, Math.round(rawPercent)));
  const state = normalizePressureState(snapshot?.pressureState) || derivePressureState(percent);
  const recommendedAction = String(snapshot?.recommendedAction || '').trim().toLowerCase()
    || (state === 'hot' ? 'compact' : state === 'critical' ? 'spawn_new_session' : 'none');
  return {
    percent,
    state,
    label: PRESSURE_STATE_TEXT[state] || PRESSURE_STATE_TEXT.healthy,
    recommendedAction,
    actionLabel: PRESSURE_ACTION_TEXT[recommendedAction] || recommendedAction || PRESSURE_ACTION_TEXT.none,
    warn: state === 'hot' || state === 'critical',
  };
}

function formatArchiveCompactionSummary(snapshot) {
  const count = Math.max(0, Math.round(toFiniteNumber(snapshot?.compactionCount) || 0));
  const mode = String(snapshot?.compactionMode || '').trim().toLowerCase();
  const modeLabel = mode === 'auto_soft'
    ? '自动轻压'
    : mode === 'auto_hard'
      ? '自动硬压'
      : mode === 'pre_spawn'
        ? '分案前压缩'
        : mode
          ? '手动压缩'
          : '';
  const lastCompactedAt = snapshot?.lastCompactedAt || 0;
  const parts = [];
  if (count > 0) parts.push(`#${count}`);
  if (modeLabel) parts.push(modeLabel);
  if (lastCompactedAt) parts.push(formatTime(lastCompactedAt));
  return parts.join(' · ');
}

function formatCompactionModeLabel(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'auto_soft') return '自动轻压';
  if (normalized === 'auto_hard') return '自动硬压';
  if (normalized === 'pre_spawn') return '分案前压缩';
  return normalized;
}

function formatBoundaryDigest(snapshot) {
  const boundaryId = firstMeaningfulText(snapshot?.latestBoundaryId, snapshot?.latestBoundary?.boundaryId);
  if (!boundaryId) return '';
  const parts = [boundaryId];
  const trancheId = firstMeaningfulText(snapshot?.currentTrancheId, snapshot?.latestBoundary?.trancheId);
  const modeLabel = formatCompactionModeLabel(snapshot?.latestBoundaryMode || snapshot?.latestBoundary?.mode || '');
  const summaryRef = firstMeaningfulText(snapshot?.latestBoundarySummaryRef, snapshot?.latestBoundary?.summaryRef);
  if (trancheId) parts.push(`tranche ${trancheId}`);
  if (modeLabel) parts.push(modeLabel);
  if (summaryRef) parts.push(summaryRef.split(/[\\/]/).pop() || summaryRef);
  return compactText(parts.join(' · '), 120);
}

function formatHandoffDigest(packet) {
  if (!packet || typeof packet !== 'object') return '';
  const parts = [];
  const rootTaskId = firstMeaningfulText(packet.rootTaskId, packet.rootId);
  const resumeTaskId = firstMeaningfulText(packet.resumeTaskId, packet.taskId, packet.trancheTaskId);
  const sessionKey = firstMeaningfulText(packet.sessionKey, packet.childSessionKey);
  const objective = firstMeaningfulText(packet.currentObjectiveDigest, packet.objective, packet.summary);
  if (rootTaskId) parts.push(`root ${rootTaskId}`);
  if (resumeTaskId) parts.push(`续接 ${resumeTaskId}`);
  if (sessionKey) parts.push(sessionKey);
  if (objective) parts.push(compactText(objective, 48));
  return compactText(parts.join(' · '), 140);
}

function pickSessionSnapshot(sessionsResult, sessionKey) {
  if (!sessionKey) return null;
  const sessions = Array.isArray(sessionsResult?.sessions)
    ? sessionsResult.sessions
    : Array.isArray(sessionsResult)
      ? sessionsResult
      : [];
  const session = sessions.find((item) => {
    const key = item?.key || item?.sessionKey || item?.id || '';
    return String(key) === String(sessionKey);
  });
  if (!session) return null;
  return {
    key: session.key || session.sessionKey || sessionKey,
    sessionId: session.sessionId || '',
    totalTokens: toFiniteNumber(session.totalTokens ?? session.usage?.totalTokens),
    contextTokens: toFiniteNumber(session.contextTokens ?? session.modelContextWindow ?? session.contextWindow ?? session.usage?.contextTokens),
    contextWindow: toFiniteNumber(session.contextWindow ?? session.modelContextWindow ?? session.contextTokens),
    pressurePercent: toFiniteNumber(session.pressurePercent),
    pressureState: session.pressureState || '',
    recommendedAction: session.recommendedAction || '',
    lastCompactedAt: session.lastCompactedAt || 0,
    compactionCount: toFiniteNumber(session.compactionCount),
    preCompactTokens: toFiniteNumber(session.preCompactTokens),
    postCompactTokens: toFiniteNumber(session.postCompactTokens),
    compactionMode: session.compactionMode || '',
    compactionSummaryRef: session.compactionSummaryRef || '',
    latestBoundaryId: session.latestBoundaryId || session.latestBoundary?.boundaryId || '',
    latestBoundaryAt: session.latestBoundaryAt || session.latestBoundary?.createdAt || 0,
    latestBoundaryMode: session.latestBoundaryMode || session.latestBoundary?.mode || '',
    latestBoundarySummaryRef: session.latestBoundarySummaryRef || session.latestBoundary?.summaryRef || '',
    latestBoundary: session.latestBoundary || null,
    currentTrancheId: session.currentTrancheId || session.latestBoundary?.trancheId || '',
    currentObjectiveDigest: session.currentObjectiveDigest || session.objective || '',
    openIssuesDigest: session.openIssuesDigest || '',
    latestHandoffPacket: session.latestHandoffPacket || session.latestBoundary?.handoffPacket || null,
    estimatedCostUsd: toFiniteNumber(session.estimatedCostUsd ?? session.usage?.cost?.total),
    updatedAt: session.updatedAt || session.updated || session.lastActivityAt || session.endedAt || session.startedAt || Date.now(),
    status: normalizeRunStatus(session.status || ''),
    model: session.model || null,
    raw: session,
  };
}

function buildSessionAliasSet(...values) {
  const aliases = new Set();
  const add = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (aliases.has(lower)) return;
    aliases.add(lower);

    if (lower === 'main' || lower === 'agent:main:main' || lower === 'webchat:g-agent-main-main') {
      aliases.add('main');
      aliases.add('agent:main:main');
      aliases.add('webchat:g-agent-main-main');
      return;
    }

    const webchatDashboardMatch = lower.match(/^webchat:g-agent-main-dashboard-(.+)$/i);
    if (webchatDashboardMatch) {
      const suffix = webchatDashboardMatch[1];
      aliases.add(`dashboard:${suffix}`);
      aliases.add(`main:dashboard:${suffix}`);
      aliases.add(`agent:main:dashboard:${suffix}`);
      return;
    }

    if (lower.startsWith('dashboard:')) {
      const suffix = lower.slice('dashboard:'.length);
      aliases.add(`main:dashboard:${suffix}`);
      aliases.add(`agent:main:dashboard:${suffix}`);
      aliases.add(`webchat:g-agent-main-dashboard-${suffix}`);
      return;
    }

    if (lower.startsWith('main:dashboard:')) {
      const suffix = lower.slice('main:dashboard:'.length);
      aliases.add(`dashboard:${suffix}`);
      aliases.add(`agent:main:dashboard:${suffix}`);
      aliases.add(`webchat:g-agent-main-dashboard-${suffix}`);
      return;
    }

    if (lower.startsWith('agent:main:dashboard:')) {
      const suffix = lower.slice('agent:main:dashboard:'.length);
      aliases.add(`dashboard:${suffix}`);
      aliases.add(`main:dashboard:${suffix}`);
      aliases.add(`webchat:g-agent-main-dashboard-${suffix}`);
    }
  };

  values.flat().forEach(add);
  return aliases;
}

function isMainSessionAliasSet(aliases) {
  return aliases.has('main') || aliases.has('agent:main:main') || aliases.has('webchat:g-agent-main-main');
}

function isDashboardSessionAlias(alias) {
  const value = String(alias || '').trim().toLowerCase();
  return (
    value.startsWith('dashboard:') ||
    value.startsWith('main:dashboard:') ||
    value.startsWith('agent:main:dashboard:') ||
    /^webchat:g-agent-main-dashboard-/.test(value)
  );
}

function getSessionChannelKey(sess) {
  return String(sess?.channel || sess?.origin?.provider || sess?.origin?.surface || '').trim().toLowerCase();
}

function getSessionUpdatedAt(sess) {
  const values = [sess?.updatedAt, sess?.updated, sess?.lastActivityAt, sess?.endedAt, sess?.startedAt, sess?.createdAt];
  for (const value of values) {
    const num = Number(value || 0);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function isSubagentSessionRecord(sess) {
  const key = String(sess?.key || '');
  const kind = String(sess?.kind || sess?.type || '').toLowerCase();
  const role = String(sess?.role || '').toLowerCase();
  return /:subagent:/i.test(key) || kind === 'subagent' || role === 'subagent';
}

function findRelatedDashboardSession(sessionsInput, activeSessionKey) {
  const activeAliases = buildSessionAliasSet(activeSessionKey);
  if (activeAliases.size === 0 || !isMainSessionAliasSet(activeAliases)) {
    return null;
  }

  const sessions = Array.isArray(sessionsInput?.sessions)
    ? sessionsInput.sessions
    : Array.isArray(sessionsInput) ? sessionsInput : [];
  const parentSessions = sessions.filter((sess) => !isSubagentSessionRecord(sess));
  const activeParent = parentSessions.find((sess) => {
    const aliases = buildSessionAliasSet(sess?.key, sess?.displayName, sess?.label);
    for (const alias of aliases) {
      if (activeAliases.has(alias)) return true;
    }
    return false;
  }) || null;
  const activeChannel = getSessionChannelKey(activeParent);
  const recentWindowMs = 30 * 60 * 1000;
  const now = Date.now();

  const candidates = parentSessions.filter((sess) => {
    const aliases = buildSessionAliasSet(sess?.key, sess?.displayName, sess?.label);
    let dashboard = false;
    for (const alias of aliases) {
      if (isDashboardSessionAlias(alias)) {
        dashboard = true;
        break;
      }
    }
    if (!dashboard) return false;

    const childCount = Array.isArray(sess?.childSessions) ? sess.childSessions.filter(Boolean).length : 0;
    const status = normalizeRunStatus(sess?.status);
    const updatedAt = getSessionUpdatedAt(sess);
    const sameChannel = !activeChannel || getSessionChannelKey(sess) === activeChannel;
    const recentEnough = updatedAt > 0 && (now - updatedAt) <= recentWindowMs;
    return sameChannel && (childCount > 0 || status === 'live' || status === 'queued' || recentEnough);
  });

  candidates.sort((a, b) => {
    const statusA = normalizeRunStatus(a?.status);
    const statusB = normalizeRunStatus(b?.status);
    const weightA = statusA === 'live' ? 3 : statusA === 'queued' ? 2 : 1;
    const weightB = statusB === 'live' ? 3 : statusB === 'queued' ? 2 : 1;
    if (weightA !== weightB) return weightB - weightA;
    const childCountA = Array.isArray(a?.childSessions) ? a.childSessions.filter(Boolean).length : 0;
    const childCountB = Array.isArray(b?.childSessions) ? b.childSessions.filter(Boolean).length : 0;
    if (childCountA !== childCountB) return childCountB - childCountA;
    return getSessionUpdatedAt(b) - getSessionUpdatedAt(a);
  });

  return candidates[0] || null;
}

function buildScopedSessionAliasSet(sessionsInput, activeSessionKey) {
  const sessions = Array.isArray(sessionsInput?.sessions)
    ? sessionsInput.sessions
    : Array.isArray(sessionsInput) ? sessionsInput : [];
  const aliases = buildSessionAliasSet(activeSessionKey);
  const relatedDashboard = findRelatedDashboardSession(sessions, activeSessionKey);
  if (relatedDashboard) {
    buildSessionAliasSet(
      relatedDashboard?.key,
      relatedDashboard?.displayName,
      relatedDashboard?.label,
    ).forEach((alias) => aliases.add(alias));
  }
  return aliases;
}

function collectScopedChildSessionKeys(sessionsInput, activeSessionKey) {
  const sessions = Array.isArray(sessionsInput?.sessions)
    ? sessionsInput.sessions
    : Array.isArray(sessionsInput) ? sessionsInput : [];
  const activeAliases = buildScopedSessionAliasSet(sessions, activeSessionKey);
  if (activeAliases.size === 0) return [];
  const keys = new Set();
  sessions.forEach((sess) => {
    const childSessions = Array.isArray(sess?.childSessions) ? sess.childSessions : [];
    if (childSessions.length === 0) return;
    const parentAliases = buildSessionAliasSet(sess?.key, sess?.displayName, sess?.label);
    let match = false;
    for (const alias of parentAliases) {
      if (activeAliases.has(alias)) {
        match = true;
        break;
      }
    }
    if (!match) return;
    childSessions.forEach((key) => {
      const text = String(key || '').trim();
      if (text) keys.add(text);
    });
  });
  return [...keys];
}

function getArchivePressure(snapshot, fallbackPressure = 0) {
  const totalTokens = toFiniteNumber(snapshot?.totalTokens);
  const contextTokens = toFiniteNumber(snapshot?.contextTokens);
  if (totalTokens != null && contextTokens != null && contextTokens > 0) {
    return Math.max(0, Math.min(100, Math.round((totalTokens / contextTokens) * 100)));
  }
  const fallback = toFiniteNumber(fallbackPressure);
  return fallback == null ? 0 : Math.max(0, Math.min(100, Math.round(fallback)));
}

function normalizeCompactionPhase(status) {
  const value = String(
    typeof status === 'string'
      ? status
      : status?.phase || status?.status || '',
  ).trim().toLowerCase();
  if (!value) return '';
  if (/(retry|waiting_retry|backoff)/.test(value)) return 'retrying';
  if (/(complete|completed|done|success|succeeded|finished)/.test(value)) return 'complete';
  if (/(active|running|started|compacting|in_progress|pending)/.test(value)) return 'active';
  if (/(fail|error|aborted|cancelled|canceled)/.test(value)) return 'failed';
  return value;
}

function getArchiveCompactionMeta(compactionStatus, isLoading) {
  const phase = normalizeCompactionPhase(compactionStatus);
  const detail = firstMeaningfulText(
    compactionStatus?.message,
    compactionStatus?.detail,
    compactionStatus?.summary,
    compactionStatus?.text,
  );
  if (phase === 'active') {
    return {
      label: '压缩中',
      detail: detail || '正在整理当前案卷上下文',
      warn: true,
      advice: '压缩中',
    };
  }
  if (phase === 'retrying') {
    return {
      label: '压缩重试中',
      detail: detail || '正在重新尝试压缩上下文',
      warn: true,
      advice: '重试中',
    };
  }
  if (phase === 'complete') {
    return {
      label: '压缩完成',
      detail: detail || (isLoading ? '正在刷新最新统计' : '案卷统计已同步'),
      warn: false,
      advice: isLoading ? '刷新中' : '压缩完成',
    };
  }
  if (phase === 'failed') {
    return {
      label: '压缩未完成',
      detail: detail || '压缩链路遇到阻塞，可稍后重试',
      warn: true,
      advice: '稍后重试',
    };
  }
  if (isLoading) {
    return {
      label: '统计刷新中',
      detail: '正在更新当前会话上下文统计',
      warn: false,
      advice: '刷新中',
    };
  }
  return null;
}

async function fetchTeamOrchestration(app, sessionKey = app?.sessionKey) {
  if (!app?.client || !app.connected || !sessionKey) return null;
  try {
    return await app.client.request("sessions.team_orchestration", { sessionKey });
  } catch {
    return null;
  }
}

function normalizeRunStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return "idle";
  if (/(running|live|working|stream|started|active)/.test(value)) return "live";
  if (/(accepted|queued|pending|waiting|created|ready)/.test(value)) return "queued";
  if (/(done|complete|completed|finished|ok|success|succeeded|synced)/.test(value)) return "done";
  if (/(timeout|timed_out)/.test(value)) return "timed_out";
  if (/(aborted|cancelled|canceled)/.test(value)) return "aborted";
  if (/(fail|error)/.test(value)) return "failed";
  return "idle";
}

function runStatusLabel(status) {
  const normalized = normalizeRunStatus(status);
  return BU_LIANG_STATUS[normalized] ?? '候令';
}

const UNKNOWN_PANEL_TEXTS = new Set(['任务描述未知', '—', 'unknown', 'null', 'undefined', 'text']);
const SIGNAL_META = {
  task_started: { icon: '▶', kind: 'agent' },
  task_completed: { icon: '✓', kind: 'agent' },
  task_failed: { icon: '✗', kind: 'error' },
  task_handoff: { icon: '⇄', kind: 'agent' },
  task_progress: { icon: '●', kind: 'tool' },
  task_rework_requested: { icon: '↻', kind: 'rework' },
  task_retested: { icon: '↺', kind: 'rework' },
  task_closed: { icon: '✓', kind: 'agent' },
  auto_compact_started: { icon: '≈', kind: 'tool' },
  auto_compact_completed: { icon: '⇢', kind: 'tool' },
  compact_boundary_created: { icon: '⛶', kind: 'agent' },
  tranche_resumed: { icon: '↬', kind: 'agent' },
  queued: { icon: '○', kind: 'agent' },
};

function compactText(value, maxLen = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function compactMultilineText(value, maxLen = 2400) {
  const text = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!text) return '';
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function firstMeaningfulText(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = compactText(value);
    if (!text) continue;
    const lower = text.toLowerCase();
    if (UNKNOWN_PANEL_TEXTS.has(text) || UNKNOWN_PANEL_TEXTS.has(lower)) continue;
    return text;
  }
  return '';
}

function collectTextFragmentsDeep(input, out = [], depth = 0, seen = new WeakSet()) {
  if (input == null || depth > 5) return out;
  if (typeof input === 'string') {
    const text = compactMultilineText(input, 2400);
    if (text) out.push(text);
    return out;
  }
  if (typeof input !== 'object') return out;
  if (seen.has(input)) return out;
  seen.add(input);
  if (Array.isArray(input)) {
    input.forEach((item) => collectTextFragmentsDeep(item, out, depth + 1, seen));
    return out;
  }
  const preferredKeys = ['text', 'content', 'value', 'markdown', 'message', 'summary', 'result', 'output', 'body'];
  preferredKeys.forEach((key) => {
    if (key in input) collectTextFragmentsDeep(input[key], out, depth + 1, seen);
  });
  Object.values(input).forEach((value) => collectTextFragmentsDeep(value, out, depth + 1, seen));
  return out;
}

function resolveAgentIdFromSeatLabel(label) {
  const text = String(label || '').trim();
  if (!text) return '';
  for (const entry of Object.values(BU_LIANG_ROSTER)) {
    const fullTitle = String(entry?.fullTitle || '').trim();
    const seatId = String(entry?.seatId || '').trim();
    const displayName = String(entry?.displayName || '').trim();
    if (!fullTitle && !seatId && !displayName) continue;
    if (
      text === fullTitle ||
      text === seatId ||
      text === displayName ||
      text.startsWith(`${seatId}·`) ||
      text.includes(fullTitle) ||
      (displayName && text.includes(displayName))
    ) {
      return String(entry.agentId || '').trim();
    }
  }
  return '';
}

function normalizeChatDerivedStatus(text) {
  const value = String(text || '').trim();
  if (!value) return 'queued';
  if (/(折损|失败|出错|报错)/.test(value)) return 'failed';
  if (/(失联|超时)/.test(value)) return 'timed_out';
  if (/(撤令|中止|取消)/.test(value)) return 'aborted';
  if (/(搜索中|执行中|行令中|研究中|扫描中|汇总中|处理中|进行中|待回传|等回传中)/.test(value)) return 'live';
  if (/(已回呈|已完成|完成|回传|已返回|已结束)/.test(value)) return 'done';
  if (/(候令|待命|待起行|等待)/.test(value)) return 'queued';
  return 'queued';
}

const CHAT_TEAM_SIGNAL_RE = /(sessions_spawn|sessions_yield|天罡|子代理|子会话|派工|分派|军令|分道齐进|并进|回呈|回传|超时|失联|折损|扫描|研究|评审|汇总)/;
const CHAT_SEAT_RE = /(不良帅(?:·[\u4e00-\u9fffA-Za-z0-9_-]{1,16})?|天[\u4e00-\u9fff]{1,3}星(?:·[\u4e00-\u9fffA-Za-z0-9_-]{1,16})?)/g;
const CHAT_OVERALL_DONE_RE = /(全部回传|悉数回传|均已回传|回传完毕|军情汇总完毕|汇总完毕|裁断结束|评审完毕|结案|全部完成|任务完成)/;

function isTerminalChatStatus(status) {
  return ['done', 'failed', 'timed_out', 'aborted'].includes(normalizeRunStatus(status));
}

function extractSeatLabelsFromLine(line) {
  const text = String(line || '');
  const matches = Array.from(text.matchAll(CHAT_SEAT_RE)).map((match) => String(match[1] || '').trim()).filter(Boolean);
  return Array.from(new Set(matches));
}

function collectChatSurfaceMessages(limit = 18) {
  if (typeof document === 'undefined') return [];
  const thread = document.querySelector('.chat-main .chat-thread') || document.querySelector('.chat-thread');
  if (!thread) return [];
  const lines = Array.from(thread.querySelectorAll('.chat-line')).slice(-limit);
  const messages = [];
  lines.forEach((line) => {
    const role = line.classList.contains('user') ? 'user' : (line.classList.contains('assistant') ? 'assistant' : '');
    if (!role) return;
    const bubble = line.querySelector('.chat-bubble') || line;
    const raw = String(bubble.innerText || bubble.textContent || '');
    const text = compactMultilineText(raw, 4000);
    if (!text) return;
    messages.push({ role, content: [{ type: 'text', text }] });
  });
  return messages;
}

function deriveTeamStateFromMessageList(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const textPool = [];
  messages.slice(-36).forEach((msg) => {
    collectTextFragmentsDeep(msg, textPool);
  });
  const joinedText = textPool.join('\n');
  if (!CHAT_TEAM_SIGNAL_RE.test(joinedText)) {
    return null;
  }

  let objective = '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg?.role !== 'user') continue;
    const parts = collectTextFragmentsDeep(msg, [])
      .map((part) => String(part || '').trim())
      .filter((part) => {
        if (!part) return false;
        if (/^\/(?:new|reset)\b/i.test(part)) return false;
        if (/^A new session was started via \/new or \/reset/i.test(part)) return false;
        if (/BEGIN_OPENCLAW_INTERNAL_CONTEXT|END_OPENCLAW_INTERNAL_CONTEXT/.test(part)) return false;
        return true;
      });
    objective = firstMeaningfulText(...parts);
    if (objective) break;
  }

  const allLines = textPool
    .flatMap((block) => String(block || '').split(/\n+/))
    .map((line) => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const lines = allLines.slice(-180);
  let inferredActiveStatus = /(正在并进|分道齐进|等回传中|等待.*回传|搜索中|扫描中|研究中|执行中|行令中|正在拆解|正在分析)/.test(lines.join('\n'))
    ? '行令中'
    : '候令';

  const isStatusLike = (value) => {
    const text = String(value || '').trim();
    return !!text && (
      normalizeChatDerivedStatus(text) !== 'queued' ||
      /(候令|待命|等待|超时|失联|折损|失败|撤令|已遣出|已回呈|已回传|进行中|搜索中|扫描中|待回传|待命中)/.test(text)
    );
  };

  const childrenByAgent = new Map();
  const upsertChild = (seatLabel, taskText, statusText, order) => {
    const seat = String(seatLabel || '').trim();
    if (!seat) return;
    const agentId = resolveAgentIdFromSeatLabel(seat);
    const key = agentId || seat;
    const prev = childrenByAgent.get(key) || null;
    const task = compactText(String(taskText || '').trim(), 72);
    const statusTextNorm = String(statusText || '').trim();
    const nextStatus = normalizeChatDerivedStatus(statusTextNorm || inferredActiveStatus);
    const prevStatus = normalizeRunStatus(prev?.status || prev?.runtimeStatus);
    const nextIsTerminal = isTerminalChatStatus(nextStatus);
    const prevIsTerminal = isTerminalChatStatus(prevStatus);
    const hasExplicitStatus = !!statusTextNorm && (
      normalizeChatDerivedStatus(statusTextNorm) !== 'queued' ||
      /(候令|待命|等待|待起行|超时|失联|折损|失败|撤令|已回呈|已回传|行令中|搜索中|扫描中|研究中|进行中|待回传)/.test(statusTextNorm)
    );
    const shouldTakeStatus = !prev ||
      (hasExplicitStatus && (
        order >= Number(prev?._statusOrder || -1) ||
        (nextIsTerminal && !prevIsTerminal)
      ));
    const mergedStatus = shouldTakeStatus ? nextStatus : (prevStatus || nextStatus);
    const mergedTask = task || prev?.taskSummary || prev?.task || '';
    const derivedTerminalSummary = nextStatus === 'done' ? mergedTask : '';
    const derivedTerminalError = ['failed', 'timed_out', 'aborted'].includes(nextStatus)
      ? compactText(statusTextNorm || mergedTask || '', 160)
      : '';
    childrenByAgent.set(key, {
      ...(prev || {}),
      agentId: agentId || seat,
      role: agentId || seat,
      sessionKey: prev?.sessionKey || '',
      status: mergedStatus,
      taskSummary: mergedTask,
      summary: nextStatus === 'done'
        ? (prev?.summary || derivedTerminalSummary)
        : '',
      resultDigest: nextStatus === 'done' ? (prev?.resultDigest || '') : '',
      error: nextIsTerminal ? (derivedTerminalError || prev?.error || '') : '',
      runtimeStatus: mergedStatus,
      lastActivityAt: Date.now(),
      _derivedFromChat: true,
      _statusOrder: shouldTakeStatus ? order : Number(prev?._statusOrder || order),
      _lineOrder: order,
    });
  };

  let latestObjectiveLine = '';
  let latestOverallDoneOrder = -1;
  lines.forEach((line, order) => {
    if (/(正在并进|分道齐进|等回传中|等待.*回传|搜索中|扫描中|研究中|执行中|行令中|正在拆解|正在分析)/.test(line)) {
      inferredActiveStatus = '行令中';
    }
    if (/(当前阶段|下一棒|当前策略|等待.*回传|汇总|对比|扫描|任务板|分道齐进|军令目标|目标)/.test(line)) {
      latestObjectiveLine = line;
    }
    if (CHAT_OVERALL_DONE_RE.test(line)) {
      latestOverallDoneOrder = order;
    }

    const tableParts = line
      .split('|')
      .map((part) => String(part || '').trim())
      .filter(Boolean);
    if (tableParts.length >= 2 && /^(?:天[\u4e00-\u9fff]{1,3}星|不良帅)/.test(tableParts[0])) {
      const seatLabel = extractSeatLabelsFromLine(tableParts[0])[0] || tableParts[0];
      const second = tableParts[1] || '';
      const third = tableParts[2] || '';
      const secondLooksStatus = isStatusLike(second);
      const thirdLooksStatus = isStatusLike(third);
      if (!secondLooksStatus && thirdLooksStatus) {
        upsertChild(seatLabel, second, third, order);
        return;
      }
      if (secondLooksStatus && !thirdLooksStatus) {
        upsertChild(seatLabel, third, second, order);
        return;
      }
      if (/^(research|reviewer|coder|qa|frontend|developer|dev|main)$/i.test(second) && third) {
        upsertChild(seatLabel, third, inferredActiveStatus, order);
        return;
      }
      if (third) {
        upsertChild(seatLabel, second, thirdLooksStatus ? third : inferredActiveStatus, order);
        return;
      }
      upsertChild(seatLabel, second, inferredActiveStatus, order);
      return;
    }

    const arrowMatch = line.match(/(?:^|[•●\-🔵⚪]\s*)((?:天[\u4e00-\u9fff]{1,3}星|不良帅)[^\s>：:]{0,16})\s*(?:->|→|：|:)\s*([^()]{2,80})/);
    if (arrowMatch) {
      upsertChild(arrowMatch[1].trim(), arrowMatch[2].trim(), inferredActiveStatus, order);
      return;
    }

    const seatLabels = extractSeatLabelsFromLine(line);
    if (seatLabels.length > 0) {
      const explicitStatus = normalizeChatDerivedStatus(line);
      const hasExplicitStatus = isStatusLike(line);
      seatLabels.forEach((seatLabel) => {
        const afterSeat = compactText(
          line
            .replace(seatLabel, '')
            .replace(/^[•●\-🔵⚪\s:：>-]+/, '')
            .trim(),
          88,
        );
        const taskText = hasExplicitStatus
          ? afterSeat
              .replace(/^(?:已回呈|已回传|已完成|完成|执行中|搜索中|扫描中|研究中|折损|失败|失联|超时|撤令|中止|待命|候令|待回传)\s*/g, '')
              .trim()
          : afterSeat;
        upsertChild(
          seatLabel,
          taskText,
          hasExplicitStatus ? line : inferredActiveStatus,
          order,
        );
      });
    }
  });

  if (!objective) {
    const objectiveLine = latestObjectiveLine || lines.find((line) => /(?:下一棒|当前策略|等待.*回传|汇总|对比|扫描|任务板|分道齐进|军令目标|目标)/.test(line));
    if (objectiveLine) objective = compactText(objectiveLine.replace(/^[•\-]+/, '').trim(), 96);
  }

  const normalizedChildren = Array.from(childrenByAgent.values())
    .sort((a, b) => Number(b?._lineOrder || 0) - Number(a?._lineOrder || 0))
    .map((child) => {
      if (latestOverallDoneOrder >= 0) {
        const status = normalizeRunStatus(child?.status || child?.runtimeStatus);
        const isMainSeat = String(child?.agentId || child?.role || '').trim() === 'main';
        const taskText = firstMeaningfulText(child?.taskSummary, child?.task, child?.summary);
        if (isMainSeat && !String(child?.sessionKey || '').trim()) {
          return null;
        }
        if (['live', 'queued', 'idle'].includes(status)) {
          return {
            ...child,
            status: 'done',
            runtimeStatus: 'done',
            summary: child.summary || (isGenericDerivedTask(taskText) ? '本轮已回呈' : (taskText || '本轮已回呈')),
            resultDigest: child.resultDigest || '',
            error: '',
          };
        }
      }
      return child;
    })
    .filter(Boolean);

  const children = normalizedChildren
    .map((child) => ({
      agentId: child.agentId,
      role: child.role,
      sessionKey: child.sessionKey,
      status: child.status,
      taskSummary: child.taskSummary,
      summary: child.summary,
      resultDigest: child.resultDigest,
      runtimeStatus: child.runtimeStatus,
      lastActivityAt: child.lastActivityAt,
      _derivedFromChat: true,
    }));

  if (!objective && children.length === 0) {
    return null;
  }

  if (!objective) {
    objective = children.length > 0
      ? (children.some((child) => normalizeRunStatus(child.status) === 'live')
          ? '团队军令执行中'
          : '本轮天罡已回呈')
      : '团队军令执行中';
  }

  const liveChildren = children.filter((child) => normalizeRunStatus(child.status) === 'live');
  const queuedChildren = children.filter((child) => normalizeRunStatus(child.status) === 'queued');

  return {
    objective: objective || '团队军令执行中',
    currentObjectiveDigest: objective || '团队军令执行中',
    phase: liveChildren.length > 0 ? 'executing' : (queuedChildren.length > 0 ? 'planning' : ''),
    currentWorker: liveChildren[0]?.agentId || null,
    children,
  };
}

function deriveTeamStateFromChatMessages(app) {
  const messageDerived = deriveTeamStateFromMessageList(Array.isArray(app?.chatMessages) ? app.chatMessages : []);
  const domDerived = deriveTeamStateFromMessageList(collectChatSurfaceMessages());
  const score = (state) => {
    if (!state) return -1;
    const children = Array.isArray(state.children) ? state.children.length : 0;
    const live = Array.isArray(state.children) ? state.children.filter((child) => getChildDisplayStatus(child) === 'live').length : 0;
    const objectiveScore = String(state.currentObjectiveDigest || state.objective || '').trim() ? 2 : 0;
    return children * 10 + live * 2 + objectiveScore;
  };
  return score(domDerived) >= score(messageDerived) ? domDerived : messageDerived;
}

function isGenericDerivedTask(text) {
  const value = String(text || '').trim();
  return /^(执行中，待回传|已接令，待起行|本轮已回呈|执行超时|执令受阻|已撤令|待命中)$/.test(value);
}

function mergeChatDerivedChildren(prevChildren, derivedChildren) {
  const baseChildren = Array.isArray(prevChildren) ? prevChildren : [];
  const nextChildren = Array.isArray(derivedChildren) ? derivedChildren : [];
  if (baseChildren.length === 0) return nextChildren.slice();
  if (nextChildren.length === 0) return baseChildren.slice();

  const merged = baseChildren.map((child) => ({ ...child }));
  const indexByKey = new Map();
  merged.forEach((child, index) => {
    const key = String(child?.agentId || child?.role || child?.sessionKey || '').trim();
    if (key) indexByKey.set(key, index);
  });

  nextChildren.forEach((child) => {
    const mergeKey = String(child?.agentId || child?.role || child?.sessionKey || '').trim();
    if (!mergeKey) {
      merged.push({ ...child });
      return;
    }
    const existingIndex = indexByKey.get(mergeKey);
    if (existingIndex == null) {
      indexByKey.set(mergeKey, merged.length);
      merged.push({ ...child });
      return;
    }

    const existing = merged[existingIndex] || {};
    const existingStatus = normalizeRunStatus(existing?.status || existing?.runtimeStatus);
    const incomingStatus = normalizeRunStatus(child?.status || child?.runtimeStatus);
    const taskChanged = !!child?.taskSummary && !!existing?.taskSummary && child.taskSummary !== existing.taskSummary;
    const freshRedispatch = ['live', 'queued'].includes(incomingStatus)
      && isTerminalChatStatus(existingStatus)
      && (!!taskChanged || Number(child?.lastActivityAt || 0) >= Number(existing?.lastActivityAt || 0));
    const takeIncomingStatus = isTerminalChatStatus(incomingStatus)
      || (!isTerminalChatStatus(existingStatus) && incomingStatus !== 'idle')
      || freshRedispatch;
    const useIncomingTask = !!child?.taskSummary && (
      !existing?.taskSummary ||
      isGenericDerivedTask(existing.taskSummary) ||
      taskChanged
    );
    const incomingAt = Number(child?.lastActivityAt || 0);
    const existingAt = Number(existing?.lastActivityAt || 0);
    const incomingIsNewer = incomingAt >= existingAt;
    const refreshOutcome = freshRedispatch || (
      incomingStatus !== 'idle' && (
        incomingIsNewer ||
        (isTerminalChatStatus(incomingStatus) && !isTerminalChatStatus(existingStatus))
      )
    );
    const clearPreviousOutcome = freshRedispatch || (
      ['failed', 'timed_out', 'aborted'].includes(incomingStatus) && refreshOutcome
    );

    merged[existingIndex] = {
      ...existing,
      ...child,
      sessionKey: existing.sessionKey || child.sessionKey || '',
      status: takeIncomingStatus ? (child.status || child.runtimeStatus || existing.status) : existing.status,
      runtimeStatus: takeIncomingStatus ? (child.runtimeStatus || child.status || existing.runtimeStatus) : (existing.runtimeStatus || existing.status),
      taskSummary: useIncomingTask ? child.taskSummary : (existing.taskSummary || child.taskSummary || ''),
      summary: clearPreviousOutcome
        ? (child.summary || '')
        : refreshOutcome
          ? (child.summary || existing.summary || '')
          : (existing.summary || child.summary || ''),
      resultDigest: clearPreviousOutcome
        ? (child.resultDigest || '')
        : refreshOutcome
          ? (child.resultDigest || existing.resultDigest || '')
          : (existing.resultDigest || child.resultDigest || ''),
      error: freshRedispatch
        ? ''
        : refreshOutcome
          ? (child.error || existing.error || '')
          : (existing.error || child.error || ''),
      lastActivityAt: Math.max(
        Number(existing.lastActivityAt || 0),
        Number(child.lastActivityAt || 0),
      ),
    };
  });

  return merged;
}

function getTrackedChildActivity(child) {
  const sessionKey = getSeatSessionKey(child);
  return sessionKey ? ActivityTracker.getChildActivity(sessionKey) : null;
}

function getChildDisplayStatus(child) {
  const tracked = getTrackedChildActivity(child);
  const explicit = normalizeRunStatus(child?.status || child?.runtimeStatus);
  if (['done', 'failed', 'timed_out', 'aborted'].includes(explicit)) return explicit;
  if (tracked && ['done', 'failed', 'timed_out', 'aborted'].includes(tracked.status)) return tracked.status;
  if (tracked?.status === 'live') return 'live';
  if (explicit === 'live') return 'live';
  if (tracked?.status === 'queued') return 'queued';
  return explicit !== 'idle' ? explicit : normalizeRunStatus(tracked?.status);
}

function getChildTaskText(child, status = getChildDisplayStatus(child)) {
  const explicit = firstMeaningfulText(child?.task, child?.taskSummary);
  if (explicit) return explicit;
  if (status === 'live') return '执行中，待回传';
  if (status === 'queued') return '已接令，待起行';
  if (status === 'done') return '本轮已回呈';
  if (status === 'failed') return firstMeaningfulText(child?.error) || '执令受阻';
  if (status === 'timed_out') return '执行超时';
  if (status === 'aborted') return '已撤令';
  return '待命中';
}

function getChildSummaryText(child, status = getChildDisplayStatus(child)) {
  if (status === 'failed') return firstMeaningfulText(child?.error, child?.summary, child?.resultDigest, child?.taskSummary, child?.task) || '执令受阻';
  if (status === 'timed_out') return firstMeaningfulText(child?.error, child?.summary, child?.resultDigest, child?.taskSummary, child?.task) || '执行超时';
  if (status === 'aborted') return firstMeaningfulText(child?.error, child?.summary, child?.resultDigest, child?.taskSummary, child?.task) || '已撤令';
  const explicit = firstMeaningfulText(child?.summary, child?.resultDigest, child?.error, child?.taskSummary, child?.task);
  if (explicit) return explicit;
  if (status === 'done') return '会议已结束，无明确回传';
  if (status === 'live') return '执行中，待回传';
  if (status === 'queued') return '已接令，待起行';
  return '暂无动态';
}

function matchesStarsFilter(status, filter) {
  if (!filter || filter === '常驻' || filter === '全谱') return true;
  if (filter === '行令中') return status === 'live';
  if (filter === '已回呈') return status === 'done';
  if (filter === '候令') return status === 'queued' || status === 'idle';
  if (filter === '折损') return ['failed', 'timed_out', 'aborted'].includes(status);
  return true;
}

function buildOperationalSignals(state, events, fallbackChildren = []) {
  const stateChildren = Array.isArray(state?.children) ? state.children : [];
  const children = stateChildren.length > 0 ? stateChildren : fallbackChildren;
  const timeline = Array.isArray(state?.timeline) ? state.timeline : [];
  const signals = timeline.map(ev => {
    const meta = SIGNAL_META[ev.type] || { icon: '•', kind: 'agent' };
    const agentId = ev.agentId || 'system';
    return {
      source: 'timeline',
      kind: meta.kind,
      icon: meta.icon,
      agentId,
      agent: agentId === 'system' ? '系统' : getSeatDisplay(agentId),
      text: firstMeaningfulText(ev.content) || ev.type || '状态更新',
      ts: ev.ts || Date.now(),
    };
  });

  const childSignals = children.map(child => {
    const status = getChildDisplayStatus(child);
    const activity = getTrackedChildActivity(child);
    const agentId = child.agentId || child.role || 'unknown';
    const agent = getSeatDisplay(agentId);
    const ts = activity?.updatedAt || child.lastActivityAt || Date.now();
    const toolLabel = activity?.lastTool ? ActivityTracker.getToolLabel(activity.lastTool) : '';
    if (status === 'live') {
      return {
        source: 'child-live',
        kind: toolLabel ? 'tool' : 'agent',
        icon: toolLabel ? '⚙' : '▶',
        agentId,
        agent,
        text: toolLabel ? `正在${toolLabel}` : getChildTaskText(child, status),
        ts,
        live: true,
      };
    }
    if (status === 'queued') {
      return {
        source: 'child-queued',
        kind: 'agent',
        icon: '○',
        agentId,
        agent,
        text: getChildTaskText(child, status),
        ts,
      };
    }
    if (status === 'done') {
      return {
        source: 'child-done',
        kind: 'agent',
        icon: '✓',
        agentId,
        agent,
        text: getChildSummaryText(child, status),
        ts,
      };
    }
    if (['failed', 'timed_out', 'aborted'].includes(status)) {
      return {
        source: 'child-error',
        kind: 'error',
        icon: status === 'aborted' ? '■' : '✗',
        agentId,
        agent,
        text: getChildSummaryText(child, status),
        ts,
      };
    }
    return null;
  }).filter(Boolean);

  const merged = [...signals, ...childSignals];
  if (merged.length === 0 && events?.toArray) {
    const fallbackLocal = events.toArray()
      .map(item => {
        const title = compactText(item?.title, 24);
        const detail = compactText(item?.detail, 96);
        if (!title && !detail) return null;
        if (title === '会话变化' || title === '任务开始' || title === '任务结束') return null;
        return {
          source: 'local',
          kind: 'agent',
          icon: '•',
          agentId: 'system',
          agent: title || '系统',
          text: detail || title,
          ts: item?.ts || Date.now(),
        };
      })
      .filter(Boolean);
    merged.push(...fallbackLocal);
  }

  const seen = new Set();
  return merged
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .filter(signal => {
      const key = [signal.kind, signal.agentId, signal.text, signal.icon, signal.source].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getRenderableChildren(state, orchestrationResult) {
  const stateChildren = Array.isArray(state?.children) ? state.children : [];
  const orchestrationChildren = Array.isArray(orchestrationResult?.orchestration?.children)
    ? orchestrationResult.orchestration.children
    : [];

  const normalizeChild = (child) => {
    if (!child || typeof child !== 'object') return null;
    const sessionKey = getSeatSessionKey(child);
    if (!sessionKey || child.sessionKey === sessionKey) return child;
    return { ...child, sessionKey };
  };

  if (orchestrationChildren.length === 0) {
    return stateChildren.map(normalizeChild).filter(Boolean);
  }
  if (stateChildren.length === 0) {
    return orchestrationChildren.map(normalizeChild).filter(Boolean);
  }

  const merged = [];
  const indexByKey = new Map();
  const getMergeKey = (child, index) => {
    const sessionKey = getSeatSessionKey(child);
    if (sessionKey) return sessionKey;
    const agentId = String(child?.agentId || child?.role || 'unknown').trim();
    const summary = String(child?.taskSummary || child?.task || child?.summary || '').trim();
    return `${agentId}|${summary}|${index}`;
  };

  orchestrationChildren.forEach((child, index) => {
    const normalized = normalizeChild(child);
    if (!normalized) return;
    const mergeKey = getMergeKey(normalized, index);
    indexByKey.set(mergeKey, merged.length);
    merged.push(normalized);
  });

  stateChildren.forEach((child, index) => {
    const normalized = normalizeChild(child);
    if (!normalized) return;
    const mergeKey = getMergeKey(normalized, index);
    const existingIndex = indexByKey.get(mergeKey);
    if (existingIndex == null) {
      indexByKey.set(mergeKey, merged.length);
      merged.push(normalized);
      return;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      ...normalized,
      sessionKey: getSeatSessionKey(normalized) || getSeatSessionKey(existing),
    };
  });

  return merged;
}

function collectActiveChildSessionKeys(orchestrationResult) {
  const children = Array.isArray(orchestrationResult?.orchestration?.children)
    ? orchestrationResult.orchestration.children
    : [];
  return children.map((child) => getSeatSessionKey(child)).filter(Boolean);
}

/**
 * 从 sessions.list 中发现当前会话派出的子 agent（通过 spawnedBy 字段）。
 * 当 orchestration 文件不存在时，这是面板发现子 agent 的后备来源。
 */
function discoverChildrenFromSessions(sessionsResult, parentSessionKey) {
  if (!parentSessionKey) return [];
  const sessions = Array.isArray(sessionsResult?.sessions)
    ? sessionsResult.sessions
    : Array.isArray(sessionsResult) ? sessionsResult : [];
  const activeSessionAliases = buildScopedSessionAliasSet(sessions, parentSessionKey);
  const relatedChildSessionKeys = new Set(collectScopedChildSessionKeys(sessions, parentSessionKey));
  return sessions.filter(sess => {
    if (!sess?.key || !/:subagent:/.test(sess.key)) return false;
    if (relatedChildSessionKeys.has(String(sess.key || '').trim())) return true;
    const parentCandidates = buildSessionAliasSet([
      sess.spawnedBy,
      sess.parentSessionKey,
      sess.controllerSessionKey,
      sess.requesterSessionKey,
      sess.requesterDisplayKey,
      sess.orchestratorSessionKey,
      sess.ownerSessionKey,
      sess.sourceSessionKey,
    ]);
    if (activeSessionAliases.size === 0 || parentCandidates.size === 0) {
      return false;
    }
    for (const candidate of parentCandidates) {
      if (activeSessionAliases.has(candidate)) {
        return true;
      }
    }
    return false;
  }).map(sess => {
    const keyStr = String(sess.key || '');
    const agentMatch = keyStr.match(/^agent:([^:]+):subagent:/i);
    const agentId =
      pickSessionText(
        sess.agentId,
        sess.agent,
        sess.assistantAgentId,
        sess.ownerAgentId,
        sess.assistantId,
      ) ||
      agentMatch?.[1] ||
      pickSessionText(sess.role) ||
      'unknown';
    return {
      agentId,
      sessionKey: keyStr,
      key: keyStr,
      status: sess.status || 'unknown',
      runtimeStatus: sess.status || 'unknown',
      taskSummary: sess.taskSummary || sess.task || sess.title || sess.objective || sess.description || '',
      summary: sess.summary || sess.resultDigest || '',
      label: sess.label || sess.displayName || '',
      lastActivityAt: sess.updatedAt || sess.endedAt || sess.createdAt || Date.now(),
      _discoveredFromSessions: true,
    };
  });
}

/**
 * 用 sessions.list 的实时子 agent 信息补全/纠正 orchestrationResult，
 * 避免旧 orchestration children 把新派出的天罡挡住。
 */
function enrichOrchestrationFromSessions(orchestrationResult, sessionsResult, parentSessionKey) {
  const discovered = discoverChildrenFromSessions(sessionsResult, parentSessionKey);
  if (discovered.length === 0) return orchestrationResult;

  const base = orchestrationResult && typeof orchestrationResult === 'object' ? orchestrationResult : {};
  const existingChildren = Array.isArray(base?.orchestration?.children)
    ? base.orchestration.children
    : [];
  const merged = [];
  const indexBySessionKey = new Map();
  const indexByAgentId = new Map();

  const rememberIndexes = (child, index) => {
    const sessionKey = getSeatSessionKey(child);
    const agentId = String(child?.agentId || '').trim();
    if (sessionKey) indexBySessionKey.set(sessionKey, index);
    if (agentId) indexByAgentId.set(agentId, index);
  };

  existingChildren.forEach((child) => {
    if (!child || typeof child !== 'object') return;
    merged.push(child);
    rememberIndexes(child, merged.length - 1);
  });

  discovered.forEach((child) => {
    const sessionKey = getSeatSessionKey(child);
    const agentId = String(child?.agentId || '').trim();
    let existingIndex = sessionKey ? indexBySessionKey.get(sessionKey) : undefined;
    if (existingIndex == null && agentId) {
      const byAgentIndex = indexByAgentId.get(agentId);
      if (byAgentIndex != null) {
        const existing = merged[byAgentIndex];
        const existingStatus = normalizeRunStatus(existing?.status || existing?.runtimeStatus);
        const nextStatus = normalizeRunStatus(child?.status || child?.runtimeStatus);
        const existingTerminal = ['done', 'failed', 'timed_out', 'aborted', 'idle'].includes(existingStatus);
        const nextActive = nextStatus === 'live' || nextStatus === 'queued';
        const nextNewer = Number(child?.lastActivityAt || 0) >= Number(existing?.lastActivityAt || 0);
        if (existingTerminal && nextActive && nextNewer) {
          existingIndex = byAgentIndex;
        }
      }
    }
    if (existingIndex == null) {
      merged.push(child);
      rememberIndexes(child, merged.length - 1);
      return;
    }
    const existing = merged[existingIndex] || {};
    merged[existingIndex] = {
      ...existing,
      ...child,
      agentId: child.agentId || existing.agentId,
      sessionKey: sessionKey || getSeatSessionKey(existing),
      lastActivityAt: Math.max(
        Number(existing.lastActivityAt || 0),
        Number(child.lastActivityAt || 0),
      ),
    };
    rememberIndexes(merged[existingIndex], existingIndex);
  });

  return {
    ...base,
    ts: base.ts || Date.now(),
    found: true,
    orchestration: {
      ...(base.orchestration || {}),
      children: merged,
      _syntheticFromSessions: existingChildren.length === 0,
    },
  };
}

// [Tranche 13] Dead helpers removed: orchestrationRoleOf, summarizeChildTask,
// getOrchestrationLiveWorker, getOrchestrationNextWorker,
// buildOrchestrationOverview, resolveOrchestrationStages

async function switchSession(app, key) {
  if (!app || !key) return;
  const prevKey = app.sessionKey || '';
  app.sessionKey = key;
  if (typeof app.applySettings === "function" && app.settings) {
    app.applySettings({ ...app.settings, sessionKey: key, lastActiveSessionKey: key });
  }
  if (app.client && app.connected) {
    try {
      const history = await app.client.request("chat.history", { sessionKey: key, limit: 200 });
      app.chatMessages = Array.isArray(history?.messages) ? history.messages : [];
      app.chatThinkingLevel = history?.thinkingLevel ?? null;
      app.chatStream = null;
      app.chatRunId = null;
    } catch {}
  }
  if (typeof app.loadAssistantIdentity === "function") {
    try {
      await app.loadAssistantIdentity();
    } catch {}
  }
  // ── [Tranche 14 fix] 切换会话后立即触发 store 同步，清空旧 session 数据 ──
  if (syncFromSessions && prevKey && prevKey !== key) {
    try {
      const sessionsResult = await app.client.request("sessions.list", {});
      syncFromSessions(sessionsResult, {
        activeSessionKey: key,
        activeChildSessionKeys: [],
      });
    } catch {}
  }
}

// [Tranche 13] 旧 section 渲染函数全部移除:
// renderCurrent, renderTaskTree, renderHandoff, renderTeam, renderSessions, renderActions
// 所有渲染改用 4-Tab 新体系 (renderTabArmy/Stars/Dispatches/Archive)

// ── Tranche 3: 4-Tab Content Renderers ────────────────────────────────────────
const TAB_CONTENT_IDS = { army: 'army', stars: 'stars', dispatches: 'dispatches', archive: 'archive' };

function getTabContent(panel, tabId) {
  return qs(`.buli-tab-content[data-tab-content="${tabId}"]`, panel) ||
    qs(`.buli-tab-content[data-tab="${tabId}"]`, panel);
}

/**
 * Tab: 军令 — Claude Code 风格任务树 (Tranche 15)
 * §1 帅座状态头  §2 当前操作  §3 军令目标  §4 任务进展树  §5 压力条  §6 活动时间线  §7 交接
 */
function renderTabArmy(panel, app, orchestrationResult) {
  const el = getTabContent(panel, TAB_CONTENT_IDS.army);
  if (!el) return;

  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const orch = orchestrationResult?.orchestration;
  const chatDerived = deriveTeamStateFromChatMessages(app);
  const resolvedChildren = getRenderableChildren(state, orchestrationResult);
  const effectiveChildren = resolvedChildren.length > 0 ? resolvedChildren : (chatDerived?.children || []);
  const meta = state ? {
    phase: state.phase || chatDerived?.phase || orch?.phase || '', objective: state.objective || chatDerived?.objective || orch?.objective || '',
    currentWorker: state.currentWorker || chatDerived?.currentWorker || orch?.lead || null, nextWorker: state.nextWorker,
    lastHandoverReason: state.lastHandoverReason,
    iterationCount: state.iterationCount ?? 0, children: effectiveChildren,
    contextPressure: state.contextPressure ?? 0,
    pressureState: state.pressureState || 'healthy',
    recommendedAction: state.recommendedAction || 'none',
    currentTrancheId: state.currentTrancheId || '',
    currentObjectiveDigest: state.currentObjectiveDigest || state.objective || chatDerived?.currentObjectiveDigest || chatDerived?.objective || orch?.objective || '',
    openIssuesDigest: state.openIssuesDigest || '',
    latestBoundaryId: state.latestBoundaryId || '',
    latestBoundaryMode: state.latestBoundaryMode || '',
    latestBoundaryAt: state.latestBoundaryAt || 0,
    latestBoundarySummaryRef: state.latestBoundarySummaryRef || '',
  } : (chatDerived ? {
    phase: chatDerived.phase || '',
    objective: chatDerived.objective || '',
    currentWorker: chatDerived.currentWorker || null,
    nextWorker: null,
    lastHandoverReason: '',
    iterationCount: 0,
    children: chatDerived.children || [],
    contextPressure: 0,
    pressureState: 'healthy',
    recommendedAction: 'none',
    currentTrancheId: '',
    currentObjectiveDigest: chatDerived.currentObjectiveDigest || chatDerived.objective || '',
    openIssuesDigest: '',
    latestBoundaryId: '',
    latestBoundaryMode: '',
    latestBoundaryAt: 0,
    latestBoundarySummaryRef: '',
  } : (orch ? {
    phase: orch.phase, objective: orch.objective,
    currentWorker: orch.lead, nextWorker: null,
    lastHandoverReason: orch.lastHandoverReason || '',
    iterationCount: 0, children: orch.children || [],
    contextPressure: 0,
    pressureState: 'healthy',
    recommendedAction: 'none',
    currentTrancheId: '',
    currentObjectiveDigest: orch.objective || '',
    openIssuesDigest: '',
    latestBoundaryId: '',
    latestBoundaryMode: '',
    latestBoundaryAt: 0,
    latestBoundarySummaryRef: '',
  } : null));

  const activity = ActivityTracker.getSnapshot();
  const liveChildren = (meta?.children || []).filter(child => getChildDisplayStatus(child) === 'live');
  const msgCount = Array.isArray(app?.chatMessages) ? app.chatMessages.length : 0;
  const isRunning = !!(app?.chatRunId || app?.chatSending || activity.isStreaming || liveChildren.length > 0);
  const leadLiveChild = liveChildren[0] || null;
  const leadLiveActivity = leadLiveChild ? getTrackedChildActivity(leadLiveChild) : null;
  const anyActive = isRunning;
  const toolDetail = activity.currentToolDesc || (leadLiveActivity?.lastTool ? `正在${ActivityTracker.getToolLabel(leadLiveActivity.lastTool)}` : (leadLiveChild ? getChildTaskText(leadLiveChild, 'live') : (activity.isStreaming ? '思考中…' : '')));
  const phaseLabel = PHASE_LABELS[meta?.phase || ''] || meta?.phase || '';

  const agentName = leadLiveChild?.agentId
    ? getSeatDisplay(leadLiveChild.agentId)
    : meta?.currentWorker
      ? getSeatDisplay(meta.currentWorker)
    : (app?.agentId ? getSeatDisplay(app.agentId) : '不良帅·李星云');

  // 构建统计行
  const statsParts = [anyActive ? '行令中' : '候令'];
  statsParts.push('__ELAPSED__');
  if (msgCount > 0) statsParts.push(`${msgCount}消息`);
  if (activity.toolUseCount > 0) statsParts.push(`${activity.toolUseCount}工具`);

  // ── §1 帅座状态头 ──────────────────────────────────────────────────────
  let h = `<div class="buli-army-root">`;

  h += `<div class="buli-army-hdr ${anyActive ? 'on' : ''}">`;
  h += `<span class="buli-army-dot-big"></span>`;
  h += `<div class="buli-army-hdr-main">`;
  h += `<div class="buli-army-hdr-name">${escapeHtml(agentName)}</div>`;
  h += `<div class="buli-army-hdr-meta">${statsParts.join(' · ')}</div>`;
  if (phaseLabel) {
    h += `<div class="buli-army-hdr-phase"><span class="bp-phase-badge">${escapeHtml(phaseLabel)}${meta?.iterationCount > 0 ? ' · 第' + meta.iterationCount + '轮' : ''}</span></div>`;
  }
  h += `</div></div>`; // hdr-main, hdr

  // ── §2 当前操作行 ───────────────────────────────────────────────────────
  if (toolDetail) {
    h += `<div class="buli-army-action">▸ ${escapeHtml(toolDetail)}</div>`;
  }

  // ── §3 军令目标 ─────────────────────────────────────────────────────────
  const objText = meta?.currentObjectiveDigest || meta?.objective || (isRunning ? '执行中，等待回传…' : '暂无军令');
  h += `<div class="buli-army-obj">`;
  h += `<div class="buli-army-obj-label">军令目标</div>`;
  h += `<div class="buli-army-obj-text">${escapeHtml(objText)}</div>`;
  h += `</div>`;

  const strategicNotes = [];
  if (meta?.currentTrancheId) strategicNotes.push(`当前 tranche · ${meta.currentTrancheId}`);
  if (meta?.latestBoundaryId) {
    const boundaryParts = [`最近 boundary · ${compactText(meta.latestBoundaryId, 28)}`];
    if (meta.latestBoundaryMode) boundaryParts.push(formatCompactionModeLabel(meta.latestBoundaryMode));
    strategicNotes.push(boundaryParts.join(' · '));
  }
  if (meta?.latestBoundarySummaryRef) {
    const boundaryRef = meta.latestBoundarySummaryRef.split(/[\\/]/).pop() || meta.latestBoundarySummaryRef;
    strategicNotes.push(`摘要锚点 · ${compactText(boundaryRef, 40)}`);
  }
  if (meta?.openIssuesDigest) strategicNotes.push(`未结问题 · ${compactText(meta.openIssuesDigest, 84)}`);
  if (strategicNotes.length > 0) {
    h += strategicNotes.map(note => `<div class="buli-army-action">▸ ${escapeHtml(note)}</div>`).join('');
  }

  // ── §4 任务进展树（Claude Code 风格）───────────────────────────────────
  const children = meta?.children || [];
  if (children.length > 0) {
    h += `<div class="buli-army-section">任务进展</div>`;
    h += `<div class="buli-army-tree">`;

    const TASK_ICONS = { live: '◉', done: '✓', failed: '✗', timed_out: '✗', aborted: '■', queued: '○', idle: '○' };

    h += children.map(child => {
      const cs = getChildDisplayStatus(child);
      const icon = TASK_ICONS[cs] || '○';
      const childName = getSeatDisplay(child.agentId || child.role || 'unknown');
      const taskText = getChildTaskText(child, cs);
      const badge = runStatusLabel(cs);

      // 当前工具行（行令中时展开）
      const ca = getTrackedChildActivity(child);
      const toolLabel = (cs === 'live' && ca?.lastTool) ? ActivityTracker.getToolLabel(ca.lastTool) : '';
      const toolCalls = ca?.toolCalls || 0;

      // 结果摘要（回呈/折损时展开）
      const resultText = (cs === 'done' || cs === 'failed' || cs === 'timed_out' || cs === 'aborted')
        ? getChildSummaryText(child, cs)
        : '';

      let taskHtml = `<div class="buli-army-task ${cs}">`;
      taskHtml += `<div class="buli-army-task-hdr">`;
      // 行1：图标 + 任务名
      taskHtml += `<div class="buli-army-task-row1">`;
      taskHtml += `<span class="buli-army-task-icon">${icon}</span>`;
      taskHtml += `<span class="buli-army-task-name">${escapeHtml(taskText)}</span>`;
      taskHtml += `</div>`;
      // 行2：角色名（左）+ 状态徽标（右）
      taskHtml += `<div class="buli-army-task-row2">`;
      taskHtml += `<span class="buli-army-task-agent">${escapeHtml(childName)}</span>`;
      taskHtml += `<span class="buli-army-task-badge ${cs}">${escapeHtml(badge)}</span>`;
      taskHtml += `</div>`;
      taskHtml += `</div>`; // task-hdr

      if (cs === 'live' && toolLabel) {
        taskHtml += `<div class="buli-army-task-tool">└ ▶ ${escapeHtml(toolLabel)}${toolCalls > 1 ? ' ×' + toolCalls : ''}</div>`;
      } else if (cs === 'live' && activity.isStreaming && !toolLabel) {
        taskHtml += `<div class="buli-army-task-tool">└ 思考中…</div>`;
      }
      if (resultText && resultText !== taskText) {
        taskHtml += `<div class="buli-army-task-summary">└ ${escapeHtml(compactText(resultText, 80))}</div>`;
      }

      taskHtml += `</div>`; // task
      return taskHtml;
    }).join('');

    h += `</div>`; // tree

    // 下一棒提示
    if (meta?.nextWorker) {
      const nextName = getSeatDisplay(meta.nextWorker);
      h += `<div class="buli-army-action" style="margin-top:4px">→ 下一棒：${escapeHtml(nextName)}</div>`;
    }
  }

  // ── §5 上下文压力条 ─────────────────────────────────────────────────────
  const pressure = meta?.contextPressure || 0;
  if (pressure > 0) {
    const level = pressure > 90 ? 'critical' : pressure > 70 ? 'warn' : '';
    const advice = PRESSURE_ACTION_TEXT[meta?.recommendedAction || 'none'] || (pressure > 70 ? '建议 /compact' : pressure > 40 ? '压力中等' : '状态良好');
    h += `<div class="buli-army-pressure"><div class="buli-army-pbar"><div class="buli-army-pfill ${level}" style="width:${Math.min(pressure, 100)}%"></div></div><div class="buli-army-plabel"><span>上下文 ${pressure}%</span><span>${advice}</span></div></div>`;
  }

  // ── §6 活动时间线 ────────────────────────────────────────────────────────
  const recent = activity.recentActivities.slice(0, 6);
  if (recent.length) {
    h += `<div class="buli-army-section">最近活动</div>`;
    h += `<div class="buli-army-events">`;
    h += recent.map((a, i) =>
      `<div class="buli-army-ev${i === 0 ? ' latest' : ''}"><span class="buli-army-ev-t">${formatAgo(a.ts)}</span><span class="buli-army-ev-d">${escapeHtml(a.desc)}</span></div>`
    ).join('');
    h += `</div>`;
  }

  // ── §7 交接原因 ─────────────────────────────────────────────────────────
  if (meta?.lastHandoverReason) {
    h += `<div class="buli-army-section">交接</div>`;
    h += `<div class="buli-army-handoff">${escapeHtml(meta.lastHandoverReason)}</div>`;
  }

  h += `</div>`; // buli-army-root

  stableRender(el, h, 'tab-army');

  // 填充 __ELAPSED__ 占位
  const metaEl = el.querySelector('.buli-army-hdr-meta');
  if (metaEl && anyActive) {
    const elapsed = ActivityTracker.getElapsed() || '';
    const raw = metaEl.textContent;
    if (raw.includes('__ELAPSED__')) {
      metaEl.textContent = raw.replace('__ELAPSED__', elapsed);
    }
  }
}

/**
 * Tab: 天罡 — 紧凑席位列表 (Tranche 11)
 */
function renderTabStars(panel, app, agentsResult, orchestrationResult) {
  const el = getTabContent(panel, TAB_CONTENT_IDS.stars);
  if (!el) return;

  const orch = orchestrationResult?.orchestration;
  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const chatDerived = deriveTeamStateFromChatMessages(app);
  const children = (getRenderableChildren(state, orchestrationResult).slice().length
    ? getRenderableChildren(state, orchestrationResult).slice()
    : (chatDerived?.children || []).slice());
  const hasActiveContext = Boolean(
    (state?.objective && String(state.objective).trim()) ||
    (state?.currentObjectiveDigest && String(state.currentObjectiveDigest).trim()) ||
    (chatDerived?.objective && String(chatDerived.objective).trim()) ||
    (state?.currentWorker && String(state.currentWorker).trim()) ||
    (children && children.length > 0),
  );
  const activeFilter = readPanelState().starsFilter || '常驻';
  const visibleChildren = children.filter(child => matchesStarsFilter(getChildDisplayStatus(child), activeFilter));

  const seatRows = visibleChildren.map(child => {
    const status = getChildDisplayStatus(child);
    const seatName = getSeatDisplay(child.agentId || child.role || 'unknown');
    const isLive = status === 'live';
    const detail = getChildSummaryText(child, status);
    const ca = getTrackedChildActivity(child);
    const toolLabel = (isLive && ca?.lastTool) ? ActivityTracker.getToolLabel(ca.lastTool) : '';
    const tokens = ca?.tokens ? `${Math.round(ca.tokens / 1000)}k` : '';
    const roleColor = getSeatRoleColor(child);
    const sessionKey = getSeatSessionKey(child);
    const lastTsStr = formatSeatLastTs(ca);
    const iconEl = isLive
      ? `<div class="bp-seat-icon ${roleColor}" data-session-key="${escapeHtml(sessionKey)}">${seatName.charAt(0)}<span class="bp-live-dot"></span></div>`
      : `<div class="bp-seat-icon ${roleColor}" data-session-key="${escapeHtml(sessionKey)}">${seatName.charAt(0)}</div>`;
    const lastTsHtml = lastTsStr ? `<div class="bp-seat-time">${escapeHtml(lastTsStr)}</div>` : '';
    return `<div class="bp-seat ${status}" data-session-key="${escapeHtml(sessionKey)}">${iconEl}<div class="bp-seat-body"><div class="bp-seat-top"><span class="bp-seat-name">${escapeHtml(seatName)}</span><span class="bp-seat-badge ${status}">${escapeHtml(runStatusLabel(status))}</span></div>${detail ? `<div class="bp-seat-detail">${escapeHtml(detail)}</div>` : ''}${isLive && toolLabel ? `<div class="bp-seat-tool">${escapeHtml(toolLabel)}${tokens ? ` · ${tokens}` : ''}</div>` : ''}${lastTsHtml}</div></div>`;
  }).join('');

  const defaultSeats = [
    { id:'天暗星', name:'不良帅·李星云（天暗星）' },
    { id:'天魁星', name:'天魁星·袁天罡' },    { id:'天祐星', name:'天祐星·石瑶' },
    { id:'天捷星', name:'天捷星·温韬' },      { id:'天速星', name:'天速星·段成天' },
    { id:'天藏星', name:'天藏星·三千院' },    { id:'天罪星', name:'天罪星·镜心魔' },
    { id:'天巧星', name:'天巧星·上官云阙' },  { id:'天慧星', name:'天慧星·慧明' },
    { id:'天孤星', name:'天孤星·蚩笠' },      { id:'天伤星', name:'天伤星·蚩离' },
    { id:'天立星', name:'天立星·阳叔子' },    { id:'天损星', name:'天损星·陆佑劫' },
  ];
  const defaultHtml = defaultSeats.map(s =>
    `<div class="bp-seat queued"><div class="bp-seat-icon">${s.id.charAt(1)}</div><div class="bp-seat-body"><div class="bp-seat-top"><span class="bp-seat-name">${escapeHtml(s.name)}</span><span class="bp-seat-badge queued">候令</span></div></div></div>`
  ).join('');

  const filters = ['常驻', '全谱', '行令中', '已回呈', '候令', '折损'];
  const filterBar = filters.map(filter => `<button class="bp-filter${activeFilter === filter ? ' active' : ''}" data-filter="${filter}">${filter}</button>`).join('');
  const emptyHtml = `<div class="bp-empty">新局已开 · 尚未派出天罡</div>`;
  const seatsHtml = hasActiveContext ? (seatRows || defaultHtml) : emptyHtml;
  const h = `<div class="bp-filter-bar" style="display:flex;flex-direction:row;flex-wrap:wrap;gap:4px;margin-bottom:8px">${filterBar}</div><div class="bp-seats">${seatsHtml}</div>`;
  stableRender(el, h, 'tab-stars');

  // ── 天罡席位：点击 session key 复制 ───────────────────────────────────────
  el.querySelectorAll('.bp-seat[data-session-key]').forEach(seat => {
    seat.addEventListener('click', () => {
      const key = seat.dataset.sessionKey;
      if (!key) return;
      navigator.clipboard.writeText(key).then(() => {
        const original = seat.dataset.copied;
        seat.dataset.copied = '1';
        seat.querySelector('.bp-seat-name')?.setAttribute('data-copied', '1');
        setTimeout(() => {
          seat.dataset.copied = '';
          seat.querySelector('.bp-seat-name')?.removeAttribute('data-copied');
        }, 1500);
      }).catch(() => {});
    }, { passive: true });
  });
}

/**
 * Tab: 驿报 — 暗桩台活动流 (Tranche 13: 稳定实时流)
 * 融合 ActivityTracker 实时数据 + store timeline + 子代理活动 + 本地事件
 */
function renderTabDispatches(panel, events, orchestrationResult) {
  const el = getTabContent(panel, TAB_CONTENT_IDS.dispatches);
  if (!el) return;

  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const timeline = (state?.timeline || []).slice(0, 30);
  const children = getRenderableChildren(state, orchestrationResult);
  const activity = ActivityTracker.getSnapshot();
  const liveChild = children.find(child => getChildDisplayStatus(child) === 'live') || null;
  const allEvents = buildOperationalSignals(state, events, children).slice(0, 25);

  // ── 实时状态头：当前活动概览 ──
  let header = '';
  if (activity.isActive || activity.isStreaming || liveChild) {
    const agentName = liveChild?.agentId ? getSeatDisplay(liveChild.agentId) : (state?.currentWorker ? getSeatDisplay(state.currentWorker) : '不良帅');
    const toolDesc = activity.currentToolDesc || (activity.isStreaming ? '思考中…' : '');
    header += `<div class="bp-dispatch-live"><span class="bp-dispatch-dot on"></span><b>${escapeHtml(agentName)}</b>`;
    header += `<span class="bp-dispatch-stat">${activity.toolUseCount > 0 ? activity.toolUseCount + '工具' : ''}</span>`;
    header += `</div>`;
    if (toolDesc) header += `<div class="bp-dispatch-action">▸ ${escapeHtml(toolDesc)}</div>`;
  }
  const dispatchStrategicLine = [
    state?.currentTrancheId ? `tranche ${state.currentTrancheId}` : '',
    state?.latestBoundaryId ? `boundary ${compactText(state.latestBoundaryId, 20)}` : '',
    state?.openIssuesDigest ? compactText(state.openIssuesDigest, 56) : '',
  ].filter(Boolean).join(' · ');
  if (dispatchStrategicLine) {
    header += `<div class="bp-dispatch-action">▸ ${escapeHtml(dispatchStrategicLine)}</div>`;
  }

  // ── 渲染 ──
  let h = header;
  if (allEvents.length > 0) {
    h += allEvents.map(ev => {
      const liveClass = ev.live ? ' live' : '';
      return `<div class="bp-event${liveClass}"><div class="bp-event-head"><span class="bp-event-icon">${ev.icon}</span><span class="bp-event-agent">${escapeHtml(ev.agent)}</span><span class="bp-event-time">${formatTime(ev.ts)}</span></div>${ev.text ? `<div class="bp-event-text">${escapeHtml(ev.text)}</div>` : ''}</div>`;
    }).join('');
  } else {
    h += '<div class="bp-empty">暗桩待命 · 不良人总谱尚无驿报</div>';
  }

  // ── Tranche 14: 折损/返工专区 ──
  const failEvents = timeline.filter(ev =>
    ['task_failed', 'task_rework_requested', 'task_retested'].includes(ev.type)
  );
  if (failEvents.length > 0) {
    h += '<div class="bp-divider"><span>折损/返工</span></div>';
    h += failEvents.slice(0, 8).map(ev => {
      const icon = { task_failed: '✗', task_rework_requested: '↻', task_retested: '↺' }[ev.type] || '●';
      const label = { task_failed: '折损', task_rework_requested: '返工', task_retested: '重验' }[ev.type] || '';
      return `<div class="bp-alert-row"><span class="bp-row-dot"></span><span class="bp-row-text">${icon} ${escapeHtml(ev.agentId ? getSeatDisplay(ev.agentId) : '系统')} · ${escapeHtml(label)} ${escapeHtml(ev.content || '')}</span><span class="bp-row-time">${formatTime(ev.ts)}</span></div>`;
    }).join('');
  }

  // ── Tranche 14: 问题记录 ──
  const issues = state?.issues || [];
  const openIssues = issues.filter(i => !i.resolved);
  if (openIssues.length > 0) {
    h += '<div class="bp-divider"><span>问题记录</span></div>';
    h += openIssues.map(issue =>
      `<div class="bp-row warn"><span class="bp-row-dot"></span><span class="bp-row-text">${escapeHtml(issue.by || '未知')} 打回 · ${escapeHtml(issue.reason || '')}</span><span class="bp-row-time">${formatTime(issue.ts)}</span></div>`
    ).join('');
  }

  stableRender(el, h, 'tab-dispatches');
}

/**
 * Tab: 案卷 — 键值对 + 状态 (Tranche 11)
 */
function renderTabArchive(panel, app, orchestrationResult, archiveRuntime = null) {
  const el = getTabContent(panel, TAB_CONTENT_IDS.archive);
  if (!el) return;

  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const orch = orchestrationResult?.orchestration;
  const sessionKey = app?.sessionKey || state?.sessionKey || '—';
  const sessionSnapshot = archiveRuntime?.snapshot || pickSessionSnapshot(app?.sessionsResult, sessionKey);
  const agentDefaultModel = state?.agentDefaultModel || orch?.agentDefaultModel || '—';
  const sessionActualModel = state?.sessionActualModel || sessionSnapshot?.model || app?.assistantModel || '—';
  const model = sessionActualModel !== '—' ? sessionActualModel : agentDefaultModel;
  const totalTokens = toFiniteNumber(sessionSnapshot?.totalTokens);
  const contextTokens = toFiniteNumber(sessionSnapshot?.contextTokens);
  const storePressure = toFiniteNumber(state?.contextPressure);
  const pressureMeta = getArchivePressureMeta(sessionSnapshot, storePressure ?? 0);
  const contextPressure = pressureMeta.percent;
  const hasPressureMetric = toFiniteNumber(sessionSnapshot?.pressurePercent) != null
    || (totalTokens != null && contextTokens != null && contextTokens > 0)
    || (storePressure != null && storePressure > 0);
  const contextPressureText = hasPressureMetric ? `${contextPressure}%` : '未上报';
  const refreshedAt = archiveRuntime?.refreshedAt || sessionSnapshot?.updatedAt || 0;
  const compactionMeta = getArchiveCompactionMeta(
    archiveRuntime?.compactionStatus || app?.compactionStatus || null,
    !!archiveRuntime?.loading,
  );
  const issues = state?.issues || [];
  const openIssues = issues.filter(i => !i.resolved);
  const children = getRenderableChildren(state, orchestrationResult);
  const failedChildren = children.filter(c => ['failed','timed_out'].includes(normalizeRunStatus(c.status)));
  const errorSummary = failedChildren.map(c =>
    `${getSeatDisplay(c.agentId || c.role)}: ${c.error || '未知错误'}`
  ).join('\n');
  const compactionAdvice = compactionMeta?.advice || pressureMeta.actionLabel;
  const compactionSummary = formatArchiveCompactionSummary(sessionSnapshot);
  const boundaryDigest = formatBoundaryDigest({
    latestBoundaryId: firstMeaningfulText(sessionSnapshot?.latestBoundaryId, state?.latestBoundaryId),
    latestBoundaryMode: firstMeaningfulText(sessionSnapshot?.latestBoundaryMode, state?.latestBoundaryMode),
    latestBoundarySummaryRef: firstMeaningfulText(sessionSnapshot?.latestBoundarySummaryRef, state?.latestBoundarySummaryRef),
    currentTrancheId: firstMeaningfulText(sessionSnapshot?.currentTrancheId, state?.currentTrancheId),
    latestBoundary: sessionSnapshot?.latestBoundary || state?.latestBoundary || null,
  });
  const handoffDigest = formatHandoffDigest(sessionSnapshot?.latestHandoffPacket || state?.latestHandoffPacket);
  const currentTrancheId = firstMeaningfulText(sessionSnapshot?.currentTrancheId, state?.currentTrancheId);
  const objectiveDigest = firstMeaningfulText(sessionSnapshot?.currentObjectiveDigest, state?.currentObjectiveDigest, state?.objective);
  const openIssuesDigest = firstMeaningfulText(sessionSnapshot?.openIssuesDigest, state?.openIssuesDigest);
  const openIssueCount = openIssues.length || (openIssuesDigest ? 1 : 0);
  const compactDelta = (toFiniteNumber(sessionSnapshot?.preCompactTokens) != null && toFiniteNumber(sessionSnapshot?.postCompactTokens) != null)
    ? `${formatTokenCount(sessionSnapshot.preCompactTokens)} → ${formatTokenCount(sessionSnapshot.postCompactTokens)}`
    : '';
  const refreshText = refreshedAt
    ? `${formatTime(refreshedAt)}${archiveRuntime?.loading ? ' · 更新中' : ''}`
    : (archiveRuntime?.loading ? '更新中' : '—');

  let h = '';

  h += `<div class="bp-kv"><span class="bp-kv-label">案卷</span><span class="bp-kv-val">${escapeHtml(sessionKey)}</span></div>`;
  h += `<div class="bp-kv"><span class="bp-kv-label">模型</span><span class="bp-kv-val">${escapeHtml(model)}</span></div>`;
  if (totalTokens != null || contextTokens != null) {
    h += `<div class="bp-kv"><span class="bp-kv-label">令牌</span><span class="bp-kv-val">${formatTokenCount(totalTokens)} / ${formatTokenCount(contextTokens)}</span></div>`;
  }
  if (objectiveDigest) {
    h += `<div class="bp-kv"><span class="bp-kv-label">军令</span><span class="bp-kv-val">${escapeHtml(compactText(objectiveDigest, 72))}</span></div>`;
  }
  if (currentTrancheId) {
    h += `<div class="bp-kv"><span class="bp-kv-label">tranche</span><span class="bp-kv-val">${escapeHtml(currentTrancheId)}</span></div>`;
  }
  h += `<div class="bp-kv"><span class="bp-kv-label">上下文</span><span class="bp-kv-val${pressureMeta.warn ? ' warn' : ''}">${contextPressureText} · ${pressureMeta.label} · ${compactionAdvice}</span></div>`;
  if (compactionSummary) {
    h += `<div class="bp-kv"><span class="bp-kv-label">压缩</span><span class="bp-kv-val">${escapeHtml(compactionSummary)}</span></div>`;
  }
  if (boundaryDigest) {
    h += `<div class="bp-kv"><span class="bp-kv-label">boundary</span><span class="bp-kv-val">${escapeHtml(boundaryDigest)}</span></div>`;
  }
  if (handoffDigest) {
    h += `<div class="bp-kv"><span class="bp-kv-label">交接包</span><span class="bp-kv-val">${escapeHtml(handoffDigest)}</span></div>`;
  }
  if (openIssuesDigest) {
    h += `<div class="bp-kv"><span class="bp-kv-label">异议</span><span class="bp-kv-val warn">${escapeHtml(compactText(openIssuesDigest, 72))}</span></div>`;
  }
  if (compactDelta) {
    h += `<div class="bp-kv"><span class="bp-kv-label">回收</span><span class="bp-kv-val">${escapeHtml(compactDelta)}</span></div>`;
  }
  h += `<div class="bp-kv"><span class="bp-kv-label">刷新</span><span class="bp-kv-val">${escapeHtml(refreshText)}</span></div>`;

  // ── Tranche 14: 上下文压力条 ──
  if (hasPressureMetric && contextPressure > 0) {
    const level = pressureMeta.state === 'critical' ? 'critical' : pressureMeta.warn ? 'warn' : '';
    h += `<div class="bp-pressure"><div class="bp-pressure-bar"><div class="bp-pressure-fill ${level}" style="width:${Math.min(contextPressure, 100)}%"></div></div><div class="bp-pressure-label"><span>${pressureMeta.label} · ${contextPressureText}</span><span>${compactionAdvice}</span></div></div>`;
  }

  if (compactionMeta) {
    const archiveStateText = compactionMeta.detail
      ? `${compactionMeta.label} · ${compactionMeta.detail}`
      : compactionMeta.label;
    h += `<div class="bp-archive-status${compactionMeta.warn ? ' warn' : ''}">${escapeHtml(archiveStateText)}</div>`;
  }

  if (boundaryDigest) {
    h += `<div class="bp-archive-status">⛶ ${escapeHtml(boundaryDigest)}</div>`;
  }
  if (handoffDigest) {
    h += `<div class="bp-archive-status">↬ ${escapeHtml(handoffDigest)}</div>`;
  }
  if (openIssuesDigest) {
    h += `<div class="bp-archive-status warn">⚠ ${escapeHtml(compactText(openIssuesDigest, 96))}</div>`;
  }

  h += `<div class="bp-archive-status${openIssueCount > 0 ? ' warn' : ''}">${openIssueCount > 0 ? `⚠ ${openIssueCount} 未结案卷` : '✓ 案卷无异议'}</div>`;

  if (openIssues.length > 0) {
    h += openIssues.map(issue =>
      `<div class="bp-row warn"><span class="bp-row-dot"></span><span class="bp-row-text">${escapeHtml(issue.by || '未知')} 打回</span><span class="bp-row-time">${formatTime(issue.ts)}</span></div>`
    ).join('');
  }
  if (errorSummary) {
    h += `<div class="bp-divider"><span>折损摘要</span></div><div class="bp-code">${escapeHtml(errorSummary)}</div>`;
  }
  h += `<div class="bp-actions"><button class="bp-btn" data-fill="/status">案卷详情</button><button class="bp-btn" data-fill="/compact">压缩上下文</button><button class="bp-btn" data-fill="/team sync">同步回传</button></div>`;

  stableRender(el, h, 'tab-archive');
}

/**
 * Update tab badge counts (called every tick)
 */
function updateTabBadges(panel, orchestrationResult) {
  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const children = getRenderableChildren(state, orchestrationResult);
  const live = children.filter(c => getChildDisplayStatus(c) === 'live').length;
  const queued = children.filter(c => getChildDisplayStatus(c) === 'queued').length;
  const failed = children.filter(c => ['failed','timed_out','aborted'].includes(getChildDisplayStatus(c))).length;
  const dispatchCount = buildOperationalSignals(state, null, children).length;
  const openIssueCount = Array.isArray(state?.issues)
    ? (state.issues.filter(issue => !issue?.resolved).length || (state?.openIssuesDigest ? 1 : 0))
    : (state?.openIssuesDigest ? 1 : 0);

  const setCount = (tabId, count) => {
    const badge = panel.querySelector(`[data-tab-count="${tabId}"]`);
    if (!badge) return;
    badge.textContent = count;
    badge.classList.toggle('zero', count === 0);
  };
  setCount('army', live + queued);
  setCount('stars', children.length);
  setCount('dispatches', dispatchCount);
  setCount('archive', failed + openIssueCount);
}

/**
 * Tranche 14: 暗桩台 — 网格化底部面板实时数据
 */
function updateAnkuangtai(orchestrationResult) {
  const bar = qs('.buli-ankuangtai', getApp() || document);
  if (!bar) return;

  const rowsEl = qs('[data-akt-rows]', bar);
  const badgeEl = qs('[data-akt-count]', bar);
  if (!rowsEl) return;

  const state = teamTaskStore ? teamTaskStore.getState() : null;
  const signals = buildOperationalSignals(state, null, getRenderableChildren(state, orchestrationResult)).slice(0, 20);
  const activeFilter = qs('.buli-akt-filter.active', bar)?.getAttribute('data-akt-filter') || 'all';

  // 过滤
  const filtered = signals.filter(ev => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'tool') return ev.kind === 'tool';
    if (activeFilter === 'agent') return ev.kind === 'agent';
    if (activeFilter === 'error') return ev.kind === 'error';
    if (activeFilter === 'rework') return ev.kind === 'rework';
    return true;
  });

  // badge count
  if (badgeEl) {
    badgeEl.textContent = signals.length;
  }

  rowsEl.innerHTML = filtered.length > 0 ? filtered.map(ev => {
    const icon = ev.icon || '●';
    const agentLabel = ev.agent || (ev.agentId ? getSeatDisplay(ev.agentId) : '');
    const time = formatTime(ev.ts);
    return `<div class="buli-akt-row">
      <span class="buli-akt-time">${time}</span>
      <span class="buli-akt-icon">${icon}</span>
      <span class="buli-akt-content">${escapeHtml(ev.text || ev.content || '')}</span>
      <span class="buli-akt-agent">${escapeHtml(agentLabel)}</span>
    </div>`;
  }).join('') : '<div class="buli-akt-row"><span class="buli-akt-content" style="color:var(--buli-text-3)">暗桩待命，暂无活动</span></div>';
}

// [Tranche 13] renderEvents 已移除 — 驿报通过 renderTabDispatches 渲染

function attachEvents(panel, app, events) {
  // Tab switching (replaces old collapsible sections)
  panel.addEventListener("click", async (event) => {
    const tabBtn = event.target.closest(".buli-tab");
    if (tabBtn) {
      const tabId = tabBtn.getAttribute("data-tab");
      if (!tabId) return;
      // Switch active tab button
      panel.querySelectorAll(".buli-tab").forEach(btn => btn.classList.remove("active"));
      tabBtn.classList.add("active");
      // Switch active tab content — use inline style for bulletproof visibility
      const tabContentList = panel.querySelectorAll(".buli-tab-content");
      tabContentList.forEach(content => {
        content.classList.remove("active");
        const contentTab = content.getAttribute("data-tab-content") ||
          content.getAttribute("data-tab") ||
          (content === tabContentList[0] ? "army" :
           content === tabContentList[1] ? "stars" :
           content === tabContentList[2] ? "dispatches" : "archive");
        const isTarget = contentTab === tabId;
        content.classList.toggle("active", isTarget);
        content.style.cssText = isTarget
          ? 'display:block;width:100%;padding-top:10px;'
          : 'display:none;';
      });
      panel.querySelectorAll('.buli-tab').forEach((btn) => {
        const isActive = btn.classList.contains('active');
        btn.style.cssText = `flex:0 0 auto;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:12px 6px;background:${isActive ? 'rgba(201,168,76,0.06)' : 'transparent'};border:none;border-right:2px solid ${isActive ? 'var(--buli-liujin, #c9a84c)' : 'transparent'};border-radius:0;box-shadow:none;cursor:pointer;transition:color 120ms, background 120ms;white-space:nowrap;position:relative;color:${isActive ? 'var(--buli-liujin-2, #e0bf68)' : 'rgba(157,168,192,0.72)'};`;
      });
      // Persist last active tab
      const current = readPanelState();
      writePanelState({ ...current, activeTab: tabId });
      return;
    }

    const starsFilterBtn = event.target.closest('.bp-filter');
    if (starsFilterBtn) {
      const filterValue = starsFilterBtn.getAttribute('data-filter') || '常驻';
      panel.querySelectorAll('.bp-filter').forEach(btn => btn.classList.toggle('active', btn === starsFilterBtn));
      writePanelState({ ...readPanelState(), starsFilter: filterValue });
      delete _renderCache['tab-stars'];
      return;
    }

    const fill = event.target.closest("[data-fill]");
    if (fill) {
      setComposerValue(fill.getAttribute("data-fill"));
      return;
    }
    const agentPrompt = event.target.closest("[data-agent-prompt]");
    if (agentPrompt) {
      setComposerValue(agentPrompt.getAttribute("data-agent-prompt"));
      return;
    }
    const sessionBtn = event.target.closest("[data-session-key]");
    if (sessionBtn) {
      const key = sessionBtn.getAttribute("data-session-key");
      await switchSession(app, key);
      events.push({ ts: Date.now(), title: "切换会话", detail: key });
      return;
    }
  });
}

async function mountPanel() {
  const app = getApp();
  if (!app) return;
  let panel = buildPanel();
  const events = new CircularBuffer(5);
  const renderCache = Object.create(null);
  let lastSignature = "";
  let lastFetchAt = 0;
  let lastArchiveFetchAt = 0;
  let agentsResult = null;
  let sessionsResult = null;
  let orchestrationResult = null;
  let archiveSnapshot = null;
  let archiveRefreshPromise = null;
  let prevCompactionPhase = '';
  let lastCompactionCompleteAt = 0;
  let lastKnownSessionId = "";
  let prevSessionKey = "";
  let prevRunId = "";
  let lastInteractiveAt = 0;
  const eventsRendered = { current: false };

  const applySessionRollover = (snapshot, nowTs = Date.now()) => {
    const nextSessionId = String(snapshot?.sessionId || '').trim();
    if (!nextSessionId) return false;
    if (!lastKnownSessionId) {
      lastKnownSessionId = nextSessionId;
      return false;
    }
    if (lastKnownSessionId === nextSessionId) {
      return false;
    }
    lastKnownSessionId = nextSessionId;
    orchestrationResult = null;
    events.clear();
    for (const key of Object.keys(_renderCache)) delete _renderCache[key];
    if (app?.sessionKey) {
      events.push({ ts: nowTs, title: "新会话", detail: `${app.sessionKey} · ${nextSessionId.slice(-8)}` });
    }
    return true;
  };

  attachEvents(panel, app, events);

  const refreshArchiveSnapshot = async () => {
    if (!app?.sessionKey) {
      archiveSnapshot = null;
      lastArchiveFetchAt = Date.now();
      return null;
    }
    if (archiveRefreshPromise) return archiveRefreshPromise;
    archiveRefreshPromise = (async () => {
      const result = await fetchSessions(app, { limit: 24 });
      if (result) {
        sessionsResult = result;
        const nextArchiveSnapshot = pickSessionSnapshot(result, app.sessionKey);
        const sessionRolled = applySessionRollover(nextArchiveSnapshot);
        // 补充 orchestration（如果 orchestration 文件不存在）
        if (!sessionRolled) {
          const scopedOrchestrationSessionKey = findRelatedDashboardSession(result, app.sessionKey)?.key || app.sessionKey;
          if (!orchestrationResult && scopedOrchestrationSessionKey && scopedOrchestrationSessionKey !== app.sessionKey) {
            orchestrationResult = await fetchTeamOrchestration(app, scopedOrchestrationSessionKey);
          }
          orchestrationResult = enrichOrchestrationFromSessions(orchestrationResult, result, scopedOrchestrationSessionKey);
        }
        if (syncFromSessions) {
          try {
            const scopedChildSessionKeys = collectScopedChildSessionKeys(result, app.sessionKey);
            syncFromSessions(result, {
              activeSessionKey: app.sessionKey,
              activeChildSessionKeys: sessionRolled
                ? []
                : [...new Set([...collectActiveChildSessionKeys(orchestrationResult), ...scopedChildSessionKeys])],
            });
          } catch(e) { /* 静默 */ }
        }
        try { ActivityTracker.updateChildActivities(result); } catch(e) { /* 静默 */ }
        archiveSnapshot = nextArchiveSnapshot;
      }
      return archiveSnapshot;
    })()
      .catch(() => archiveSnapshot)
      .finally(() => {
        lastArchiveFetchAt = Date.now();
        archiveRefreshPromise = null;
      });
    return archiveRefreshPromise;
  };

  // ── Tranche 4: 中栏消息分层 — MutationObserver ──────────────────────────
  // 用 MutationObserver 检测新消息，给团队事件消息添加分层样式类
  const TEAM_MSG_PATTERNS = [
    { pattern: /(?:颁令|spawn|kickoff|任务开始)/i, cls: 'lpt-msg-kickoff' },
    { pattern: /(?:移文|handoff|交接|交给)/i, cls: 'lpt-msg-handoff' },
    { pattern: /(?:回呈|完成|done|result|已回传)/i, cls: 'lpt-msg-return' },
    { pattern: /(?:核验|verify|qa|测试|回归)/i, cls: 'lpt-msg-verify' },
    { pattern: /(?:折损|失败|fail|error|超时|timed.?out)/i, cls: 'lpt-msg-fail' },
  ];

  const classifyMessage = (el) => {
    const text = (el.textContent || '').slice(0, 300);
    for (const { pattern, cls } of TEAM_MSG_PATTERNS) {
      if (pattern.test(text)) {
        if (!el.classList.contains(cls)) el.classList.add(cls);
        return;
      }
    }
  };

  // 观察 openclaw-app 内新增消息（仅做 CSS 类标记，不修改 Lit 管理的 DOM 文本）
  const appEl = qs('openclaw-app');
  if (appEl) {
    const msgObserver = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== 1) continue;
          const msgs = node.matches?.('[class*="message"], [class*="chat-msg"], [class*="msg-"]')
            ? [node]
            : Array.from(node.querySelectorAll?.('[class*="message"], [class*="chat-msg"], [class*="msg-"]') || []);
          msgs.forEach(classifyMessage);
        }
      }
    });
    msgObserver.observe(appEl, { childList: true, subtree: true });
  }

  // Restore last active tab from localStorage
  const savedTab = readPanelState().activeTab;
  if (savedTab) {
    const savedTabBtn = panel.querySelector(`[data-tab="${savedTab}"]`);
    if (savedTabBtn) {
      panel.querySelectorAll(".buli-tab").forEach(b => b.classList.remove("active"));
      savedTabBtn.classList.add("active");
      // Set correct active class + inline style on tab content divs
      const tabContentList = panel.querySelectorAll(".buli-tab-content");
      const tabIds = ['army', 'stars', 'dispatches', 'archive'];
      tabContentList.forEach((tc, idx) => {
        const tid = tc.getAttribute("data-tab-content") || tc.getAttribute("data-tab") || tabIds[idx];
        const isTarget = tid === savedTab;
        tc.classList.toggle("active", isTarget);
        tc.style.cssText = isTarget
          ? 'display:block;width:100%;padding-top:10px;'
          : 'display:none;';
      });
    }
  }

  const remountIntoIntegratedHost = () => {
    const host = getIntegratedRightConsole();
    if (!host || panel === host || panel.parentElement === host) return;
    if (panel.parentElement === document.body) {
      panel.remove();
      panel = buildPanel();
      attachEvents(panel, app, events);
      for (const key of Object.keys(renderCache)) delete renderCache[key];
    }
  };

  const tick = async () => {
    remountIntoIntegratedHost();
    if (!app?.connected) {
      panel.style.display = "none";
      return;
    }
    panel.style.display = "flex";

    const now = Date.now();

    // ── 实时活动追踪（每次 tick 都更新，不等 API） ──
    ActivityTracker.update(app);
    const chatDerived = deriveTeamStateFromChatMessages(app);
    if (chatDerived && teamTaskStore?.setState && teamTaskStore?.getState) {
      const s = teamTaskStore.getState();
      const hasStoreContext = Boolean(
        (Array.isArray(s?.children) && s.children.length > 0) ||
        String(s?.objective || '').trim() ||
        String(s?.currentObjectiveDigest || '').trim(),
      );
      const mergedDerivedChildren = mergeChatDerivedChildren(s?.children || [], chatDerived.children || []);
      const derivedHasTerminal = mergedDerivedChildren.some((child) => isTerminalChatStatus(child?.status || child?.runtimeStatus));
      const shouldHydrateFromChat =
        !hasStoreContext ||
        (chatDerived.children?.length || 0) > (s?.children?.length || 0) ||
        derivedHasTerminal ||
        (!String(s?.objective || s?.currentObjectiveDigest || '').trim() && String(chatDerived.objective || chatDerived.currentObjectiveDigest || '').trim());
      if (shouldHydrateFromChat) {
        const nextChildren = mergeChatDerivedChildren(s?.children || [], chatDerived.children || []);
        const nextLiveChildren = nextChildren.filter((child) => getChildDisplayStatus(child) === 'live');
        const nextQueuedChildren = nextChildren.filter((child) => getChildDisplayStatus(child) === 'queued');
        const nextCurrentWorker = nextLiveChildren[0]?.agentId || null;
        const nextPhase = nextLiveChildren.length > 0 ? 'executing' : (nextQueuedChildren.length > 0 ? 'planning' : '');
        teamTaskStore.setState(prev => ({
          ...prev,
          sessionKey: app.sessionKey || prev.sessionKey || '',
          objective: chatDerived.objective || prev.objective || '',
          currentObjectiveDigest: chatDerived.currentObjectiveDigest || chatDerived.objective || prev.currentObjectiveDigest || '',
          currentWorker: nextCurrentWorker,
          nextWorker: nextQueuedChildren[0]?.agentId || null,
          phase: nextPhase,
          children: nextChildren,
          updatedAt: now,
        }));
      }
    }

    const signatureState = {
      sessionKey: app.sessionKey,
      agentId: app.assistantAgentId,
      connected: app.connected,
      sending: app.chatSending,
      runId: app.chatRunId,
      messageCount: Array.isArray(app.chatMessages) ? app.chatMessages.length : 0,
    };
    const blankFreshSession = signatureState.messageCount === 0 && !signatureState.sending && !signatureState.runId;
    if (blankFreshSession && teamTaskStore?.getState) {
      const s = teamTaskStore.getState();
      if (
        (Array.isArray(s?.children) && s.children.length > 0) ||
        (Array.isArray(s?.timeline) && s.timeline.length > 0) ||
        String(s?.objective || '').trim() ||
        String(s?.currentObjectiveDigest || '').trim() ||
        String(s?.currentWorker || '').trim()
      ) {
        teamTaskStore.setState(prev => ({
          ...prev,
          sessionKey: app.sessionKey || prev.sessionKey || '',
          sessionId: '',
          objective: '',
          currentObjectiveDigest: '',
          currentWorker: null,
          nextWorker: null,
          phase: '',
          children: [],
          timeline: [],
          issues: [],
          updatedAt: now,
        }));
      }
    }
    const signature = JSON.stringify(signatureState);

    if (signature !== lastSignature) {
      const prev = lastSignature ? JSON.parse(lastSignature) : null;
      lastInteractiveAt = now;
      if (prev?.sessionKey !== app.sessionKey) {
        lastKnownSessionId = "";
        if (app.sessionKey) {
          events.push({ ts: now, title: "会话变化", detail: app.sessionKey });
        }
        lastFetchAt = 0;
        lastArchiveFetchAt = 0;
        archiveSnapshot = null;
        orchestrationResult = null;
        agentsResult = null;
        sessionsResult = null;
      } else if ((Number(prev?.messageCount) || 0) > 0 && signatureState.messageCount === 0) {
        // /new 会清空消息但保留 sessionKey；强制本轮立即重取 sessions，避免旧天罡残留一整个刷新周期。
        if (teamTaskStore?.setState) {
          teamTaskStore.setState(s => ({
            ...s,
            sessionKey: app.sessionKey || s.sessionKey || '',
            sessionId: '',
            objective: '',
            currentObjectiveDigest: '',
            currentWorker: null,
            nextWorker: null,
            phase: '',
            children: [],
            timeline: [],
            issues: [],
            updatedAt: now,
          }));
        }
        lastFetchAt = 0;
        lastArchiveFetchAt = 0;
        archiveSnapshot = null;
        orchestrationResult = null;
        agentsResult = null;
        sessionsResult = null;
      }
      if (prev?.runId !== app.chatRunId) {
        events.push({ ts: now, title: app.chatRunId ? "任务开始" : "任务结束", detail: app.chatRunId || "本轮完成" });
      }
      lastSignature = signature;
    }

    const activeTabBtn = panel.querySelector(".buli-tab.active");
    const activeTabId = activeTabBtn ? activeTabBtn.getAttribute("data-tab") : "army";

    const activitySnapshot = ActivityTracker.getSnapshot();
    const storeState = teamTaskStore?.getState ? teamTaskStore.getState() : null;
    const hasLiveChildActivity = hasTrackedLiveChildActivities(activitySnapshot);
    const hasActiveChildren = hasActiveTeamChildren(storeState);
    if (app.chatSending || app.chatRunId) {
      lastInteractiveAt = now;
    }
    const recentlyInteractive = lastInteractiveAt > 0 && (now - lastInteractiveAt) < 30000;
    const dataRefreshInterval = (app.chatSending || app.chatRunId || activitySnapshot.isActive || activitySnapshot.isStreaming || hasLiveChildActivity || hasActiveChildren || recentlyInteractive)
      ? 2000
      : 12000;

    if ((now - lastFetchAt) >= dataRefreshInterval) {
      lastFetchAt = now;
      agentsResult = await fetchAgents(app);
      sessionsResult = await fetchSessions(app);
      const nextArchiveSnapshot = pickSessionSnapshot(sessionsResult, app.sessionKey);
      const sessionRolled = applySessionRollover(nextArchiveSnapshot, now);
      const scopedOrchestrationSessionKey = findRelatedDashboardSession(sessionsResult, app.sessionKey)?.key || app.sessionKey;
      orchestrationResult = (sessionRolled || blankFreshSession)
        ? null
        : await fetchTeamOrchestration(app, scopedOrchestrationSessionKey);
      // 当 orchestration 文件缺失时，从 sessions.list 的 spawnedBy 字段发现子 agent
      orchestrationResult = blankFreshSession
        ? null
        : enrichOrchestrationFromSessions(orchestrationResult, sessionsResult, scopedOrchestrationSessionKey);
      if (sessionsResult && syncFromSessions) {
        try {
          const scopedChildSessionKeys = collectScopedChildSessionKeys(sessionsResult, app.sessionKey);
          syncFromSessions(sessionsResult, {
            activeSessionKey: app.sessionKey,
            activeChildSessionKeys: (sessionRolled || blankFreshSession)
              ? []
              : [...new Set([...collectActiveChildSessionKeys(orchestrationResult), ...scopedChildSessionKeys])],
          });
        } catch(e) { /* store 未初始化，静默跳过 */ }
      }
      // ── 从 sessions 数据更新子 agent 活动缓存 ──
      if (sessionsResult) {
        try { ActivityTracker.updateChildActivities(sessionsResult); } catch(e) { /* 静默 */ }
        archiveSnapshot = nextArchiveSnapshot || archiveSnapshot;
        lastArchiveFetchAt = now;
      }
    }

    const compactionPhase = normalizeCompactionPhase(app?.compactionStatus || null);
    if (compactionPhase === 'complete' && prevCompactionPhase !== 'complete') {
      lastCompactionCompleteAt = now;
      lastArchiveFetchAt = 0;
    }
    const recentlyCompacted = lastCompactionCompleteAt > 0 && (now - lastCompactionCompleteAt) < 10000;
    const archiveHot = activeTabId === 'archive' || compactionPhase === 'active' || compactionPhase === 'retrying' || recentlyCompacted;
    const archiveRefreshInterval = (compactionPhase === 'active' || compactionPhase === 'retrying')
      ? 2000
      : activeTabId === 'archive'
        ? 4000
        : 8000;
    const archiveNeedsRefresh = archiveHot && !!app?.sessionKey && (
      !archiveSnapshot ||
      archiveSnapshot.key !== app.sessionKey ||
      (now - lastArchiveFetchAt) >= archiveRefreshInterval ||
      compactionPhase !== prevCompactionPhase
    );
    if (archiveNeedsRefresh) {
      if (activeTabId === 'archive' || compactionPhase === 'complete') {
        await refreshArchiveSnapshot();
      } else {
        void refreshArchiveSnapshot();
      }
    }
    prevCompactionPhase = compactionPhase;

    const archiveRenderState = {
      snapshot: archiveSnapshot,
      loading: !!archiveRefreshPromise,
      refreshedAt: lastArchiveFetchAt,
      compactionStatus: app?.compactionStatus || null,
    };

    if (activeTabId === "army") {
      renderTabArmy(panel, app, orchestrationResult);
    } else if (activeTabId === "stars") {
      renderTabStars(panel, app, agentsResult, orchestrationResult);
    } else if (activeTabId === "dispatches") {
      renderTabDispatches(panel, events, orchestrationResult);
    } else if (activeTabId === "archive") {
      renderTabArchive(panel, app, orchestrationResult, archiveRenderState);
    }

    updateTabBadges(panel, orchestrationResult);

    // ── Tranche 14: 更新暗桩台 + 运行状态条 ──────────────────────────────
    updateAnkuangtai(orchestrationResult);
    updateStatusBar(app, archiveRenderState);
  };

  tick();
  // Tranche 9: tick 维持 2s；活跃运行时的数据轮询提到近实时，空闲时降回 12s
  window.setInterval(tick, 2000);
  const forceImmediateRefresh = () => {
    lastFetchAt = 0;
    lastArchiveFetchAt = 0;
    void tick();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      forceImmediateRefresh();
    }
  }, { passive: true });
  window.addEventListener('focus', forceImmediateRefresh, { passive: true });
  window.addEventListener('pageshow', forceImmediateRefresh, { passive: true });
  window.addEventListener('online', forceImmediateRefresh, { passive: true });
  // 独立每秒更新 elapsed 时间（不受 tab 节流影响）
  // 空闲时 getElapsed() 返回 null，用 lastSeenElapsed 兜底，保持显示上一个值
  let lastSeenElapsed = null;
  window.setInterval(() => {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const metaEl = panel.querySelector('.t12-meta, .buli-army-hdr-meta');
    if (!metaEl) return;
    const act = ActivityTracker.getSnapshot();
    const isActive = !!(act.isActive || act.isStreaming);
    const elapsed = ActivityTracker.getElapsed();
    if (elapsed) lastSeenElapsed = elapsed;
    const display = isActive ? '行令中 · ' + (elapsed || lastSeenElapsed || '') : (lastSeenElapsed || '');
    if (display) metaEl.textContent = display;
  }, 1000);
}

function bootstrap() {
  const attempt = () => {
    if (!getApp()) {
      window.setTimeout(attempt, 300);
      return;
    }
    mountPanel().catch((error) => console.error("[buli-panel]", error));
  };
  attempt();
}

// ─── Panel API for Companion Sprite ───────────────────────────────
window.__openBuliTeamPanel = function() {
    const panel = document.getElementById('buli-team-panel');
    if (panel) panel.style.display = 'block';
};

window.__setActiveTab = function(tabName) {
    const panel = document.getElementById('buli-team-panel');
    if (!panel) return;
    // Simulate clicking the tab button
    const tabBtn = panel.querySelector(`.buli-tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.click();
};

window.__scrollToAgentBySessionKey = function(sessionKey) {
    if (!sessionKey) return;
    const panel = document.getElementById('buli-team-panel');
    if (!panel) return;
    const seatEl = panel.querySelector(`.bp-seat[data-session-key="${sessionKey}"]`);
    if (seatEl) {
        seatEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Flash highlight
        seatEl.style.transition = 'background 0.3s';
        seatEl.style.background = 'rgba(255,200,0,0.3)';
        setTimeout(() => { seatEl.style.background = ''; }, 1500);
    }
};

bootstrap();
