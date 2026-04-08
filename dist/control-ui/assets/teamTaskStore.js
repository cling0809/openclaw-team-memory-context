/**
 * teamTaskStore.js — 不良人总谱 · 团队状态仓
 * 
 * 替代 inferTeamState() 的文本猜测，用真实 runtime 状态驱动右栏。
 * 模式参考：Claude Code src/state/store.ts（Set<Listener> + Object.is）
 * 
 * 使用方式：
 *   import { teamTaskStore, findChild, updateChild } from './teamTaskStore.js';
 *   const state = teamTaskStore.getState();
 *   teamTaskStore.subscribe(newState => render(newState));
 *   // 在浏览器 console 调试：
 *   window.__teamTaskStore.getState()
 */

// ─────────────────────────────────────────────────────────────────────────────
// 不良人总谱常量（与不良人面板 JS 保持同步）
// ─────────────────────────────────────────────────────────────────────────────

const BU_LIANG_ROSTER = {
  main: { seatId:'天暗星', displayName:'不良帅·李星云', fullTitle:'不良帅·李星云（天暗星）', roleType:'帅', rankOrder:0, agentId:'main', isCanonConfirmed:true, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天魁星': { seatId:'天魁星', displayName:'袁天罡',  fullTitle:'天魁星·袁天罡', roleType:'天罡', rankOrder:1,  agentId:'agent:天魁星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天罡星': { seatId:'天罡星', displayName:'袁天罡',  fullTitle:'天罡星·袁天罡', roleType:'天罡', rankOrder:2,  agentId:'agent:天罡星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天立星': { seatId:'天立星', displayName:'阳叔子',  fullTitle:'天立星·阳叔子', roleType:'天罡', rankOrder:3,  agentId:'agent:天立星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天损星': { seatId:'天损星', displayName:'陆佑劫',   fullTitle:'天损星·陆佑劫', roleType:'天罡', rankOrder:4,  agentId:'agent:天损星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天巧星': { seatId:'天巧星', displayName:'上官云阙',fullTitle:'天巧星·上官云阙',roleType:'天罡', rankOrder:5,  agentId:'agent:天巧星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天捷星': { seatId:'天捷星', displayName:'温韬',    fullTitle:'天捷星·温韬',   roleType:'天罡', rankOrder:6,  agentId:'agent:天捷星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天祐星': { seatId:'天祐星', displayName:'石瑶',    fullTitle:'天祐星·石瑶',   roleType:'天罡', rankOrder:7,  agentId:'agent:天祐星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天慧星': { seatId:'天慧星', displayName:'慧明',    fullTitle:'天慧星·慧明',   roleType:'天罡', rankOrder:8,  agentId:'agent:天慧星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天孤星': { seatId:'天孤星', displayName:'蚩笠',    fullTitle:'天孤星·蚩笠',   roleType:'天罡', rankOrder:9,  agentId:'agent:天孤星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天伤星': { seatId:'天伤星', displayName:'蚩离',    fullTitle:'天伤星·蚩离',   roleType:'天罡', rankOrder:10, agentId:'agent:天伤星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天罪星': { seatId:'天罪星', displayName:'镜心魔',  fullTitle:'天罪星·镜心魔', roleType:'天罡', rankOrder:11, agentId:'agent:天罪星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天速星': { seatId:'天速星', displayName:'段成天',  fullTitle:'天速星·段成天', roleType:'天罡', rankOrder:12, agentId:'agent:天速星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天藏星': { seatId:'天藏星', displayName:'三千院',  fullTitle:'天藏星·三千院', roleType:'天罡', rankOrder:13, agentId:'agent:天藏星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天机星': { seatId:'天机星', displayName:'待考',    fullTitle:'天机星·待考',   roleType:'天罡', rankOrder:14, agentId:'agent:天机星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天闲星': { seatId:'天闲星', displayName:'待考',    fullTitle:'天闲星·待考',   roleType:'天罡', rankOrder:15, agentId:'agent:天闲星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天玄星': { seatId:'天玄星', displayName:'待考',    fullTitle:'天玄星·待考',   roleType:'天罡', rankOrder:16, agentId:'agent:天玄星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天寿星': { seatId:'天寿星', displayName:'待考',    fullTitle:'天寿星·待考',   roleType:'天罡', rankOrder:17, agentId:'agent:天寿星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天佑星': { seatId:'天佑星', displayName:'待考',    fullTitle:'天佑星·待考',   roleType:'天罡', rankOrder:18, agentId:'agent:天佑星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天空星': { seatId:'天空星', displayName:'待考',    fullTitle:'天空星·待考',   roleType:'天罡', rankOrder:19, agentId:'agent:天空星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天威星': { seatId:'天威星', displayName:'—',      fullTitle:'天威星',         roleType:'天罡', rankOrder:20, agentId:'agent:天威星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天勇星': { seatId:'天勇星', displayName:'—',      fullTitle:'天勇星',         roleType:'天罡', rankOrder:21, agentId:'agent:天勇星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天雄星': { seatId:'天雄星', displayName:'—',      fullTitle:'天雄星',         roleType:'天罡', rankOrder:22, agentId:'agent:天雄星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天微星': { seatId:'天微星', displayName:'—',      fullTitle:'天微星',         roleType:'天罡', rankOrder:23, agentId:'agent:天微星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天究星': { seatId:'天究星', displayName:'—',      fullTitle:'天究星',         roleType:'天罡', rankOrder:24, agentId:'agent:天究星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天暴星': { seatId:'天暴星', displayName:'—',      fullTitle:'天暴星',         roleType:'天罡', rankOrder:25, agentId:'agent:天暴星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天退星': { seatId:'天退星', displayName:'—',      fullTitle:'天退星',         roleType:'天罡', rankOrder:26, agentId:'agent:天退星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天满星': { seatId:'天满星', displayName:'—',      fullTitle:'天满星',         roleType:'天罡', rankOrder:27, agentId:'agent:天满星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天剑星': { seatId:'天剑星', displayName:'—',      fullTitle:'天剑星',         roleType:'天罡', rankOrder:28, agentId:'agent:天剑星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天阖星': { seatId:'天阖星', displayName:'—',      fullTitle:'天阖星',         roleType:'天罡', rankOrder:29, agentId:'agent:天阖星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天异星': { seatId:'天异星', displayName:'—',      fullTitle:'天异星',         roleType:'天罡', rankOrder:30, agentId:'agent:天异星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天牢星': { seatId:'天牢星', displayName:'—',      fullTitle:'天牢星',         roleType:'天罡', rankOrder:31, agentId:'agent:天牢星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天哭星': { seatId:'天哭星', displayName:'待考',   fullTitle:'天哭星·待考',    roleType:'天罡', rankOrder:32, agentId:'agent:天哭星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天笑星': { seatId:'天笑星', displayName:'待考',   fullTitle:'天笑星·待考',    roleType:'天罡', rankOrder:33, agentId:'agent:天笑星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天隐星': { seatId:'天隐星', displayName:'待考',   fullTitle:'天隐星·待考',    roleType:'天罡', rankOrder:34, agentId:'agent:天隐星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天淫星': { seatId:'天淫星', displayName:'待考',   fullTitle:'天淫星·待考',    roleType:'天罡', rankOrder:35, agentId:'agent:天淫星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'agent:天福星': { seatId:'天福星', displayName:'待考',   fullTitle:'天福星·待考',    roleType:'天罡', rankOrder:36, agentId:'agent:天福星', isCanonConfirmed:false, iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  coder:    { seatId:'天祐星', displayName:'石瑶',      fullTitle:'天祐星·石瑶',       roleType:'天罡', rankOrder:7,  agentId:'agent:天祐星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  research: { seatId:'天慧星', displayName:'慧明',      fullTitle:'天慧星·慧明',       roleType:'天罡', rankOrder:8,  agentId:'agent:天慧星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  frontend: { seatId:'天巧星', displayName:'上官云阙',  fullTitle:'天巧星·上官云阙',  roleType:'天罡', rankOrder:5,  agentId:'agent:天巧星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  qa:       { seatId:'天损星', displayName:'陆佑劫',   fullTitle:'天损星·陆佑劫',    roleType:'天罡', rankOrder:4,  agentId:'agent:天损星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  reviewer: { seatId:'天罪星', displayName:'镜心魔',   fullTitle:'天罪星·镜心魔',    roleType:'天罡', rankOrder:11, agentId:'agent:天罪星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  dev:          { seatId:'天捷星', displayName:'温韬',      fullTitle:'天捷星·温韬',       roleType:'天罡', rankOrder:6,  agentId:'agent:天捷星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
  'code-assist':{ seatId:'天速星', displayName:'段成天',    fullTitle:'天速星·段成天',     roleType:'天罡', rankOrder:12, agentId:'agent:天速星', isCanonConfirmed:true,  iterationCount:null, failedBy:null, sentBackTo:null, retestRequired:null, stopReason:null },
};

const BU_LIANG_STATUS = {
  live:      '行令中',
  queued:    '候令',
  running:   '行令中',
  done:      '已回呈',
  failed:    '折损',
  idle:      '候令',
  timed_out: '失联',
  aborted:   '撤令',
};

// ─── Companion Sprite State ─────────────────────────────────────────────────
const _spriteState = {
    visible: false,
    state: 'idle',  // 'idle' | 'speaking' | 'petting' | 'thinking'
    position: { x: 100, y: 100 },
    agentId: null,
    reaction: null,
    reactionExpiresAt: 0,
    pettingUntil: 0,
};

// ─── Companion Sprite DOM ────────────────────────────────────────────────────
let _spriteEl = null;

function getOrCreateCompanionSprite() {
    if (_spriteEl) return _spriteEl;
    _spriteEl = document.createElement('div');
    _spriteEl.id = 'companion-sprite';
    _spriteEl.innerHTML = `
        <div class="cs-body">⚔️</div>
        <div class="cs-label"></div>
        <div class="cs-bubble" style="display:none"></div>
        <div class="cs-pet-hearts" style="display:none"></div>
    `;
    _spriteEl.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 30px;
        z-index: 9999;
        pointer-events: none;
        transition: left 80ms linear, top 80ms linear;
        display: none;
    `;
    document.body.appendChild(_spriteEl);

    _spriteEl.addEventListener('dblclick', () => {
        // Double-click → open Team Panel + focus the agent's tab
        const agentId = _spriteState.agentId;
        if (agentId && typeof window !== 'undefined') {
            if (typeof window.__openBuliTeamPanel === 'function') {
                window.__openBuliTeamPanel();
            }
            if (typeof window.__setActiveTab === 'function') {
                window.__setActiveTab('stars');
            }
            if (typeof window.__scrollToAgentBySessionKey === 'function') {
                // Use setTimeout to wait for panel to render
                setTimeout(() => {
                    window.__scrollToAgentBySessionKey(agentId);
                }, 300);
            }
        }
    });

    _spriteEl.addEventListener('click', (e) => {
        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + click → pet animation
            if (typeof window !== 'undefined' && window.__triggerPetAnimation) {
                window.__triggerPetAnimation();
            }
        }
    });

    return _spriteEl;
}

// CSS keyframe 注入
function injectCompanionCSS() {
    if (document.getElementById('companion-sprite-css')) return;
    const style = document.createElement('style');
    style.id = 'companion-sprite-css';
    style.textContent = `
        @keyframes cs-idle-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
        }
        @keyframes cs-blink {
            0%, 90%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.1); }
        }
        .cs-body {
            font-size: 36px;
            animation: cs-idle-float 3s ease-in-out infinite, cs-blink 4s ease-in-out infinite;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));
        }
        .cs-label {
            font-size: 11px;
            color: #d4af37;
            text-align: center;
            margin-top: 2px;
            font-family: system-ui, sans-serif;
        }
        .cs-bubble {
            position: absolute;
            bottom: 48px;
            right: 0;
            background: #fffb;
            border: 1px solid #d4af37;
            border-radius: 12px;
            padding: 6px 10px;
            font-size: 12px;
            max-width: 180px;
            color: #333;
            backdrop-filter: blur(4px);
        }
        .cs-bubble::before {
            content: '';
            position: absolute;
            bottom: -6px;
            right: 16px;
            border: 6px solid transparent;
            border-top-color: #d4af37;
        }
        .cs-pet-hearts {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
        }
        @keyframes cs-heart-float {
            0%   { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-60px) scale(0.5); }
        }
    `;
    document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types (JSDoc comments for IDE autocomplete)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'planning'|'research'|'synthesis'|'executing'|'verifying'|'reviewing'|'finalizing'} Phase
 * @typedef {'queued'|'running'|'done'|'failed'|'timed_out'|'aborted'} RuntimeStatus
 * @typedef {'main'|'coder'|'code-assist'|'research'|'frontend'|'qa'|'reviewer'} Role
 * @typedef {'active'|'paused'|'completed'|'aborted'} TaskStatus
 *
 * @typedef {Object} ChildTask
 * @property {string} agentId
 * @property {string} seatId            - 不良人席位ID（天祐星等）
 * @property {string} displayName       - 不良人显示名（石瑶等）
 * @property {string} sessionKey
 * @property {RuntimeStatus} status
 * @property {string} taskSummary       - 派出时的任务描述
 * @property {string} [summary]         - 完成时天罡回传摘要
 * @property {string} [resultDigest]    - summary 的摘要
 * @property {number} lastActivityAt    - 最后活动时间戳
 * @property {string} [error]           - 失败时错误信息
 * @property {boolean} needsRework      - 是否需要返工
 * @property {string|null} failedBy     - 被谁打回
 * @property {string|null} sentBackTo   - 返工发往席位
 * @property {boolean} retestRequired   - 是否需要复测
 *
 * @typedef {Object} TeamTaskObject
 * @property {string} sessionKey        - 当前 session key
 * @property {string} sessionId         - 当前 session id
 * @property {string} objective         - 当前总目标
 * @property {Phase} phase              - 当前阶段
 * @property {TaskStatus} status        - 任务整体状态
 * @property {string} lead              - 主责 agentId
 * @property {Role[]} support           - 协作角色列表
 * @property {string} verify            - 验证 agentId
 * @property {string} review            - 把关 agentId
 * @property {string|null} currentWorker
 * @property {string|null} nextWorker
 * @property {string} lastHandoffReason - 最近交接原因
 * @property {number} iterationCount    - 迭代轮次
 * @property {Array} issues             - 问题列表 [{by,reason,ts,resolved}]
 * @property {ChildTask[]} children
 * @property {Array} timeline           - 时间线事件
 * @property {number} contextPressure   - 上下文压力 0-100
 * @property {string} agentDefaultModel
 * @property {string} sessionActualModel
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {number} lastSyncAt        - 最后与 runtime 同步时间
 */

// ── Timeline 事件类型常量 ──────────────────────────────────────────────────
const TIMELINE_EVENTS = {
  TASK_STARTED:          'task_started',
  TASK_PROGRESS:         'task_progress',
  TASK_HANDOFF:          'task_handoff',
  TASK_COMPLETED:        'task_completed',
  TASK_FAILED:           'task_failed',
  TASK_REWORK_REQUESTED: 'task_rework_requested',
  TASK_RETESTED:         'task_retested',
  TASK_CLOSED:           'task_closed',
  AUTO_COMPACT_STARTED:  'auto_compact_started',
  AUTO_COMPACT_COMPLETED:'auto_compact_completed',
  COMPACT_BOUNDARY_CREATED:'compact_boundary_created',
  TRANCHE_RESUMED:       'tranche_resumed',
};

const PRESSURE_STATE_LABELS = {
  healthy: '上下文稳态',
  warm: '上下文升温',
  hot: '上下文高压',
  critical: '上下文临界',
};

const PRESSURE_ACTION_LABELS = {
  none: '无需处置',
  compact: '建议压缩',
  spawn_new_session: '建议新案卷',
  force_split: '建议强制分案',
};

// ── 阶段语义映射 ──────────────────────────────────────────────────────────
const PHASE_LABELS = {
  planning:   '正在拆解',
  research:   '正在研究',
  synthesis:  '正在汇总',
  executing:  '工部承办中',
  verifying:  '核验中',
  reviewing:  '终审中',
  finalizing: '最终收尾',
};

// ─────────────────────────────────────────────────────────────────────────────
// Observable Store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {any} initial
 * @returns {{ getState: () => any, setState: (updater: (prev: any) => any) => void, subscribe: (listener: () => void) => () => void }}
 */
function createStore(initial) {
  /** @type {any} */
  let state = initial;
  /** @type {Set<() => void>} */
  const listeners = new Set();

  return {
    getState: () => state,

    setState(updater) {
      const next = typeof updater === 'function' ? updater(state) : updater;
      // Object.is — 引用相等则跳过，防止无限循环
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach(l => l());
    },

    /**
     * 订阅状态变化，返回取消订阅函数
     * @param {() => void} listener
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  objective: '',
  phase: 'planning',
  status: 'active',
  lead: 'main',
  support: [],
  verify: 'qa',
  review: 'reviewer',
  currentWorker: null,
  nextWorker: null,
  lastHandoffReason: '',
  lastHandoverReason: '',  // deprecated alias → use lastHandoffReason
  children: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastSyncAt: 0,
  // ── Tranche 1 新增字段 ────────────────────────────────────────────────
  iterationCount: 0,
  issues: [],            // [{by, reason, ts, resolved}]
  contextPressure: 0,    // 0-100 上下文压力指数
  pressureState: 'healthy',
  recommendedAction: 'none',
  compactionCount: 0,
  agentDefaultModel: '',
  sessionActualModel: '',
  sessionKey: '',
  sessionId: '',
  latestBoundary: null,
  latestBoundaryId: '',
  latestBoundaryAt: 0,
  latestBoundaryMode: '',
  latestBoundarySummaryRef: '',
  currentTrancheId: '',
  currentObjectiveDigest: '',
  openIssuesDigest: '',
  latestHandoffPacket: null,
  timeline: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Store Instance
// ─────────────────────────────────────────────────────────────────────────────

const teamTaskStore = createStore(INITIAL_STATE);

// ─── Companion Sprite 状态联动 ─────────────────────────────────────────────────
// 当 agent 状态变为 running 时自动显示 sprite（Phase 2）
const _originalSetState = teamTaskStore.setState.bind(teamTaskStore);
teamTaskStore.setState = function (updater, options) {
  const prev = teamTaskStore.getState();
  const result = _originalSetState(updater, options);
  const next = teamTaskStore.getState();

  // 检测哪个 child agent 变成了 running / completed
  for (const child of next.children ?? []) {
    const prevChild = prev.children?.find(c => c.sessionKey === child.sessionKey);
    if (child.status === 'running' && prevChild?.status !== 'running') {
      // agent 开始执行，自动显示 sprite
      const rosterEntry = BU_LIANG_ROSTER[child.agentId];
      const label = rosterEntry?.displayName ?? child.agentId ?? '不良人';
      if (typeof window !== 'undefined' && window.__showCompanionSprite) {
        window.__showCompanionSprite(child.agentId, label);
        window.__updateCompanionState('speaking', `\u2694\uFE0F ${label} 行令中`);
      }
    }
    if (
      (child.status === 'done' || child.status === 'failed' ||
       child.status === 'timed_out' || child.status === 'aborted') &&
      prevChild?.status === 'running'
    ) {
      // agent 完成，隐藏 sprite
      if (typeof window !== 'undefined' && window.__hideCompanionSprite) {
        window.__hideCompanionSprite();
      }
    }
  }
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 找到指定 sessionKey 的子任务
 * @param {string} sessionKey
 * @returns {ChildTask|undefined}
 */
function findChild(sessionKey) {
  return teamTaskStore.getState().children.find(c => c.sessionKey === sessionKey);
}

/**
 * 更新指定 sessionKey 的子任务
 * @param {string} sessionKey
 * @param {(prev: ChildTask) => ChildTask} updater
 */
function updateChild(sessionKey, updater) {
  teamTaskStore.setState(s => ({
    ...s,
    children: s.children.map(c =>
      c.sessionKey === sessionKey ? updater(c) : c
    ),
    updatedAt: Date.now(),
  }));
}

/**
 * 添加一个新子任务（派出时调用）
 * @param {ChildTask} child
 */
function addChild(child) {
  const existing = findChild(child.sessionKey);
  if (existing) return; // 防止重复添加
  teamTaskStore.setState(s => ({
    ...s,
    children: [...s.children, { ...child, lastActivityAt: Date.now() }],
    updatedAt: Date.now(),
  }));
}

/**
 * 设置 currentWorker（不良帅派工时调用）
 * @param {string|null} workerId
 * @param {string} [handoverReason]
 */
function setCurrentWorker(workerId, handoverReason = '') {
  teamTaskStore.setState(s => ({
    ...s,
    currentWorker: workerId,
    nextWorker: workerId ? s.nextWorker : null,
    lastHandoverReason: handoverReason || s.lastHandoverReason,
    updatedAt: Date.now(),
  }));
}

/**
 * 派工给下一个 agent（交接时调用）
 * @param {string} workerId
 * @param {string} reason
 */
function setNextWorker(workerId, reason = '') {
  teamTaskStore.setState(s => ({
    ...s,
    nextWorker: workerId,
    currentWorker: s.currentWorker, // current 保持，直到新 worker 真正开始
    lastHandoverReason: reason,
    updatedAt: Date.now(),
  }));
}

/**
 * 设置 phase
 * @param {Phase} phase
 */
function setPhase(phase) {
  teamTaskStore.setState(s => ({
    ...s,
    phase,
    updatedAt: Date.now(),
  }));
}

/**
 * 设置 objective
 * @param {string} objective
 */
function setObjective(objective) {
  teamTaskStore.setState(s => ({
    ...s,
    objective,
    updatedAt: Date.now(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 不良人总谱 · Roster & Status Helpers（Tranche 1）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 通过 seatId 获取不良人席位信息（支持 agentId 别名）
 * @param {string} seatId
 * @returns {object|undefined}
 */
function getRosterEntry(seatId) {
  if (!seatId) return undefined;
  const key = String(seatId).trim();
  // 直接查
  if (BU_LIANG_ROSTER[key]) return BU_LIANG_ROSTER[key];
  // agent: 前缀兼容
  if (BU_LIANG_ROSTER['agent:' + key]) return BU_LIANG_ROSTER['agent:' + key];
  // 去掉 agent: 前缀
  const cleaned = key.replace(/^agent:/, '');
  if (BU_LIANG_ROSTER[cleaned]) return BU_LIANG_ROSTER[cleaned];
  // 模糊：用 displayName / seatId 再查一次
  return Object.values(BU_LIANG_ROSTER).find(e =>
    e.seatId === seatId || e.displayName === seatId || e.fullTitle === seatId
  );
}

/**
 * 获取所有席位（按 rankOrder 排序）
 * @returns {Array}
 */
function getAllSeats() {
  return Object.values(BU_LIANG_ROSTER)
    .sort((a, b) => (a.rankOrder ?? 99) - (b.rankOrder ?? 99));
}

/**
 * 标准化 runtime status → 不良人状态文案
 * @param {string} status
 * @returns {string}
 */
function getStatusLabel(status) {
  if (!status) return '候令';
  const normalized = String(status).toLowerCase();
  if (BU_LIANG_STATUS[normalized]) return BU_LIANG_STATUS[normalized];
  // fallback 猜测
  if (normalized.includes('run')) return '行令中';
  if (normalized.includes('done') || normalized.includes('complete')) return '已回呈';
  if (normalized.includes('fail')) return '折损';
  if (normalized.includes('timeout')) return '失联';
  if (normalized.includes('abort')) return '撤令';
  return '候令';
}

// ─────────────────────────────────────────────────────────────────────────────
// 迭代闭环字段操作（Tranche 1）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 设置迭代次数
 * @param {number} count
 */
function setIterationCount(count) {
  teamTaskStore.setState(s => ({
    ...s,
    iterationCount: Math.max(0, Number(count) || 0),
    updatedAt: Date.now(),
  }));
}

/**
 * 添加一个问题记录
 * @param {{by:string, reason:string, ts?:number, resolved?:boolean}} issue
 */
function addIssue(issue) {
  teamTaskStore.setState(s => ({
    ...s,
    issues: [
      ...s.issues,
      { by: issue.by || 'unknown', reason: issue.reason || '', ts: issue.ts || Date.now(), resolved: false },
    ],
    updatedAt: Date.now(),
  }));
}

/**
 * 标记某 session 需要返工
 * @param {string} sessionKey
 * @param {string|null} failedBy
 */
function markRework(sessionKey, failedBy) {
  teamTaskStore.setState(s => ({
    ...s,
    children: s.children.map(c =>
      c.sessionKey === sessionKey
        ? { ...c, needsRework: true, failedBy: failedBy || c.agentId, retestRequired: true }
        : c
    ),
    updatedAt: Date.now(),
  }));
}

/**
 * 清除某 session 的返工标记
 * @param {string} sessionKey
 */
function clearRework(sessionKey) {
  teamTaskStore.setState(s => ({
    ...s,
    children: s.children.map(c =>
      c.sessionKey === sessionKey
        ? { ...c, needsRework: false, failedBy: null, retestRequired: false }
        : c
    ),
    updatedAt: Date.now(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle Event Handlers
// Called by event-stream consumer or by the panel's polling loop
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 天罡状态变为 queued（已派出）
 */
function onSubagentQueued({ agentId, sessionKey, taskSummary, role }) {
  addChild({
    agentId,
    role: role || agentId,
    sessionKey,
    status: 'queued',
    taskSummary: taskSummary || '',
    lastActivityAt: Date.now(),
  });
}

/**
 * 天罡状态变为 running（开始执行）
 */
function onSubagentRunning({ agentId, sessionKey }) {
  updateChild(sessionKey, prev => ({
    ...prev,
    status: 'running',
    lastActivityAt: Date.now(),
  }));
  setCurrentWorker(agentId);
}

/**
 * 天罡完成
 */
function onSubagentDone({ agentId, sessionKey, summary, resultDigest }) {
  updateChild(sessionKey, prev => ({
    ...prev,
    status: 'done',
    summary: summary || prev.summary,
    resultDigest: resultDigest || (summary ? summarize(summary) : prev.resultDigest),
    lastActivityAt: Date.now(),
  }));
  // 交接棒：currentWorker 传 nextWorker
  const s = teamTaskStore.getState();
  if (s.nextWorker && s.nextWorker !== s.currentWorker) {
    setCurrentWorker(s.nextWorker);
  } else {
    setCurrentWorker(null);
  }
}

/**
 * 天罡失败
 */
function onSubagentFailed({ agentId, sessionKey, error }) {
  updateChild(sessionKey, prev => ({
    ...prev,
    status: 'failed',
    error: error || '未知错误',
    lastActivityAt: Date.now(),
  }));
}

/**
 * 天罡超时
 */
function onSubagentTimedOut({ agentId, sessionKey }) {
  updateChild(sessionKey, prev => ({
    ...prev,
    status: 'timed_out',
    error: '执行超时',
    lastActivityAt: Date.now(),
  }));
}

/**
 * 天罡中止
 */
function onSubagentAborted({ agentId, sessionKey }) {
  updateChild(sessionKey, prev => ({
    ...prev,
    status: 'aborted',
    lastActivityAt: Date.now(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** 把长字符串压缩成短摘要（用于 resultDigest） */
function summarize(text, maxLen = 60) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function normalizeSessionText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function pickSessionText(...values) {
  for (const value of values) {
    if (value == null) continue;
    const text = normalizeSessionText(value);
    if (text) return text;
  }
  return '';
}

/** 标准化 runtime status 字符串 */
function normalizeStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (/(running|live|working|stream|started|active)/.test(s)) return 'running';
  if (/(done|complete|completed|finished|ok|success|succeeded|synced)/.test(s)) return 'done';
  if (/(fail|error)/.test(s)) return 'failed';
  if (s.includes('timeout') || s.includes('timed_out')) return 'timed_out';
  if (/(abort|cancelled|canceled)/.test(s)) return 'aborted';
  return 'queued';
}

function isTerminalChildStatus(status) {
  return ['done', 'failed', 'timed_out', 'aborted'].includes(normalizeStatus(status));
}

const CHILD_SESSION_RE = /:subagent:/i;
const UNKNOWN_TASK_LABELS = new Set(['任务描述未知', 'unknown', '—', 'text']);

function isSubagentSession(sess) {
  const key = String(sess?.key || '');
  const kind = String(sess?.kind || sess?.type || '').toLowerCase();
  const role = String(sess?.role || '').toLowerCase();
  return CHILD_SESSION_RE.test(key) || kind === 'subagent' || role === 'subagent';
}

function deriveSessionAgentId(sess) {
  const explicit = pickSessionText(
    sess?.agentId,
    sess?.agent,
    sess?.assistantAgentId,
    sess?.ownerAgentId,
    sess?.assistantId,
  );
  if (explicit) return explicit;
  const key = String(sess?.key || '');
  const match = key.match(/^agent:([^:]+):subagent:/i);
  if (match?.[1]) return match[1];
  const role = pickSessionText(sess?.role);
  return role && role !== 'subagent' ? role : 'unknown';
}

function deriveSessionUpdatedAt(sess, fallback) {
  return sess?.updatedAt || sess?.updated || sess?.lastActivityAt || sess?.endedAt || sess?.createdAt || fallback;
}

function deriveSessionSummary(sess, existing = '') {
  return pickSessionText(sess?.summary, sess?.resultDigest, existing);
}

function deriveSessionTaskSummary(sess, existing = '') {
  const candidate = pickSessionText(
    sess?.taskSummary,
    sess?.task,
    sess?.title,
    sess?.description,
    sess?.objective,
    sess?.metadata?.taskSummary,
    sess?.metadata?.task,
    sess?.meta?.taskSummary,
    sess?.meta?.task,
    existing,
  );
  if (candidate) {
    const lower = candidate.toLowerCase();
    if (!UNKNOWN_TASK_LABELS.has(candidate) && !UNKNOWN_TASK_LABELS.has(lower)) {
      return candidate;
    }
  }
  const status = normalizeStatus(sess?.status);
  if (status === 'running') return '执行中，待回传';
  if (status === 'done') return '本轮已回呈';
  if (status === 'failed') return '执令受阻';
  if (status === 'timed_out') return '执行超时';
  if (status === 'aborted') return '已撤令';
  return '已接令，待起行';
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Buffer

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[,_\s%]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clampPercent(value) {
  const number = toFiniteNumber(value);
  if (number == null) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

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

function formatCompactionModeLabel(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'auto_soft') return '自动轻压';
  if (normalized === 'auto_hard') return '自动硬压';
  if (normalized === 'pre_spawn') return '分案前压缩';
  if (!normalized) return '';
  return normalized;
}
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Array<{ts:number, type:string, agentId:string, content:string}>} */
// let __timeline = [];  // P0-2: moved to state.timeline

/**
 * 推一条事件到 timeline（最多保留 50 条）
 * @param {string} type - 'queued'|'start'|'done'|'failed'|'timeout'|'handoff'|'phase'
 * @param {string} agentId
 * @param {string} content
 */
function pushTimelineEvent(type, agentId, content) {
  teamTaskStore.setState(s => ({
    ...s,
    timeline: [{ ts: Date.now(), type, agentId, content }, ...(s.timeline || [])].slice(0, 50),
  }));
}

/**
 * 获取 timeline 事件（最新在前）
 * @param {number} [limit]
 * @returns {Array<{ts:number, type:string, agentId:string, content:string}>}
 */
function getTimeline(limit) {
  const arr = (teamTaskStore.getState().timeline || []).slice();
  return limit ? arr.slice(0, limit) : arr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle handlers — 状态变化时同步推 timeline
// ─────────────────────────────────────────────────────────────────────────────

function _wrapHandler(handlerFn, type) {
  return function(...args) {
    const result = handlerFn.apply(this, args);
    const event = args[0] || {};
    const label = event.agentId || 'unknown';
    pushTimelineEvent(type, label, _eventContent(type, event));
    return result;
  };
}

function _eventContent(type, event) {
  switch (type) {
    case 'task_started':    return `${event.agentId} 开始执行`;
    case 'task_completed': return event.summary || `${event.agentId} 完成`;
    case 'task_failed':    return `${event.agentId} 失败: ${event.error || '未知'}`;
    case 'task_handoff':   return `${event.from} → ${event.to}: ${event.reason || ''}`;
    case 'task_progress':  return `阶段切换: ${event.phase}`;
    case 'task_rework_requested': return `${event.agentId} 被要求返工`;
    case 'task_retested':   return `${event.agentId} 复测中`;
    case 'task_closed':     return `${event.agentId} 任务关闭`;
    case 'auto_compact_started':
      return event.content || `${PRESSURE_STATE_LABELS[event.pressureState] || '上下文高压'} · ${PRESSURE_ACTION_LABELS[event.recommendedAction] || '建议压缩'}`;
    case 'auto_compact_completed':
      return event.content || `自动压缩完成${event.mode ? ` · ${formatCompactionModeLabel(event.mode)}` : ''}`;
    case 'compact_boundary_created':
      return event.content || `创建压缩边界 ${event.boundaryId || ''}`.trim();
    case 'tranche_resumed':
      return event.content || `恢复 tranche ${event.trancheId || ''}`.trim();
    default:               return `${event.agentId} ${type}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// syncFromSessions — 检测状态变化，推 timeline 事件
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, string>} 上一次同步时的 children status */
const __prevChildStatus = new Map();

function syncFromSessions(sessionsInput, options = {}) {
  // 兼容传入 {sessions: [...]} 或直接传入 [...]
  const sessions = Array.isArray(sessionsInput)
    ? sessionsInput
    : Array.isArray(sessionsInput?.sessions)
      ? sessionsInput.sessions
      : [];
  const syncOptions = options && typeof options === 'object' ? options : {};
  const requestedSessionKey = pickSessionText(syncOptions.activeSessionKey);
  const requestedChildSessionKeys = Array.isArray(syncOptions.activeChildSessionKeys)
    ? syncOptions.activeChildSessionKeys
        .map((key) => String(key || '').trim())
        .filter(Boolean)
    : [];
  teamTaskStore.setState(s => {
    const now = Date.now();
    const timelineAdditions = [];
    const queueTimelineEvent = (type, agentId, content) => {
      timelineAdditions.push({ ts: now, type, agentId, content });
    };
    const allChildSessions = sessions.filter(isSubagentSession);
    const parentSessions = sessions.filter(sess => !isSubagentSession(sess));
    const topSession = requestedSessionKey
      ? parentSessions.find(sess => String(sess?.key || '') === requestedSessionKey) || null
      : parentSessions[0] || null;
    const topSessionKey = topSession?.key || '';
    const resolvedSessionKey = requestedSessionKey || topSessionKey;
    const resolvedSessionId = pickSessionText(topSession?.sessionId);
    // /new 会滚动 sessionId，但 sessionKey 会保持不变；这里要按真正的 session rollover 重置。
    const sessionKeyMismatch = !!resolvedSessionKey && s.sessionKey !== resolvedSessionKey;
    const sessionIdMismatch = !sessionKeyMismatch && !!resolvedSessionId && s.sessionId !== resolvedSessionId;
    const sessionReset = sessionKeyMismatch || sessionIdMismatch;
    const sessionChanged = !!(s.sessionKey || s.sessionId) && sessionReset;
    const baseState = sessionReset
      ? {
          ...INITIAL_STATE,
          createdAt: now,
          updatedAt: now,
          sessionKey: resolvedSessionKey,
          sessionId: resolvedSessionId,
          lead: s.lead || INITIAL_STATE.lead,
          support: Array.isArray(s.support) ? s.support : INITIAL_STATE.support,
          verify: s.verify || INITIAL_STATE.verify,
          review: s.review || INITIAL_STATE.review,
        }
      : s;
    const persistedChildSessionKeys = sessionReset
      ? []
      : (baseState.children || []).map((child) => String(child?.sessionKey || '').trim()).filter(Boolean);
    const scopedChildSessionKeys = new Set([...requestedChildSessionKeys, ...persistedChildSessionKeys]);
    const childBelongsToActiveSession = (sess) => {
      const parentCandidates = [
        sess?.spawnedBy,
        sess?.parentSessionKey,
        sess?.controllerSessionKey,
        sess?.requesterSessionKey,
        sess?.requesterDisplayKey,
        sess?.orchestratorSessionKey,
        sess?.ownerSessionKey,
        sess?.sourceSessionKey,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      return resolvedSessionKey ? parentCandidates.includes(resolvedSessionKey) : false;
    };
    const childSessions = scopedChildSessionKeys.size > 0
      ? allChildSessions.filter(sess => scopedChildSessionKeys.has(String(sess?.key || '')))
      : resolvedSessionKey
        ? allChildSessions.filter(childBelongsToActiveSession)
        : [];
    const sameTopSession = !!resolvedSessionKey && !!topSessionKey && resolvedSessionKey === topSessionKey;

    // ── [Tranche 14 fix] 新会话切换时重置 children 和 timeline ─────────────
    const prevSessionKey = s.sessionKey;
    const prevSessionId = s.sessionId;
    const formatSessionMarker = (value) => {
      const text = String(value || '').trim();
      return text ? (text.length > 8 ? `${text.slice(-8)}…` : text) : 'unknown';
    };
    if (sessionReset) {
      // 清除旧 session 的 child status 记录，防止新 session subagent 被误判为状态变化
      __prevChildStatus.clear();
    }
    if (sessionChanged) {
      const prevSessionRef = sessionKeyMismatch ? prevSessionKey : (prevSessionId || prevSessionKey);
      const nextSessionRef = sessionKeyMismatch ? resolvedSessionKey : (resolvedSessionId || resolvedSessionKey);
      // 记录会话切换事件
      timelineAdditions.push({
        ts: now,
        type: 'task_progress',
        agentId: 'system',
        content: `${sessionKeyMismatch ? '切换会话' : '新会话'} ${formatSessionMarker(prevSessionRef)} → ${formatSessionMarker(nextSessionRef)}`,
      });
    }

    // 检测状态变化，推 timeline 事件（全部用 normalizeStatus）
    childSessions.forEach(sess => {
      const agentId = deriveSessionAgentId(sess);
      const prevStatus = __prevChildStatus.get(sess.key);
      const currStatus = normalizeStatus(sess.status);
      const statusChanged = !!prevStatus && prevStatus !== currStatus;
      if ((statusChanged || !prevStatus) && currStatus === 'running') {
        queueTimelineEvent('task_started', agentId, `${agentId} 行令中`);
      } else if (statusChanged && currStatus === 'done') {
        queueTimelineEvent('task_completed', agentId, deriveSessionSummary(sess) || `${agentId} 已回呈`);
      } else if ((statusChanged || !prevStatus) && currStatus === 'failed') {
        queueTimelineEvent('task_failed', agentId, `${agentId} 折损`);
      } else if ((statusChanged || !prevStatus) && currStatus === 'timed_out') {
        queueTimelineEvent('task_failed', agentId, `${agentId} 失联`);
      } else if (statusChanged && currStatus === 'aborted') {
        queueTimelineEvent('task_progress', agentId, `${agentId} 撤令`);
      }
      __prevChildStatus.set(sess.key, currStatus);
    });

    const updatedChildren = childSessions.map(sess => {
      const currStatus = normalizeStatus(sess.status);
      const existing = baseState.children.find(c => c.sessionKey === sess.key);
      const agentId = existing?.agentId || deriveSessionAgentId(sess);
      const role = pickSessionText(sess?.role, existing?.role, agentId);
      const taskSummary = deriveSessionTaskSummary(sess, existing?.taskSummary);
      const summary = deriveSessionSummary(sess, existing?.summary);
      const lastActivityAt = deriveSessionUpdatedAt(sess, existing?.lastActivityAt || now);
      if (existing) {
        // failed / timed_out / aborted 也要更新进来，不保留旧状态
        const updated = {
          ...existing,
          agentId,
          role,
          status: currStatus,
          taskSummary,
          lastActivityAt,
          summary,
          _missingRounds: 0,
        };
        if (summary && (!existing.resultDigest || existing.summary !== summary)) {
          updated.resultDigest = summarize(summary);
        }
        if (currStatus === 'failed' && pickSessionText(sess?.error, sess?.lastError)) {
          updated.error = pickSessionText(sess?.error, sess?.lastError);
        }
        return updated;
      }
      // 新 session：直接用 normalizeStatus（含 Tranche 1 新字段）
      return {
        agentId,
        role,
        sessionKey: sess.key,
        status: currStatus,
        taskSummary,
        summary,
        resultDigest: summary ? summarize(summary) : '',
        error: currStatus === 'failed' ? pickSessionText(sess?.error, sess?.lastError) : '',
        lastActivityAt,
        _missingRounds: 0,
        // Tranche 1 新增 child 字段
        needsRework: false,
        failedBy: null,
        sentBackTo: null,
        retestRequired: false,
      };
    });

    const liveChild = updatedChildren.find(c => c.status === 'running') || null;
    const queuedChild = updatedChildren.find(c => c.status === 'queued' && c.agentId !== liveChild?.agentId) || null;

    // ── ContextPressure 计算 ──────────────────────────────────────────
    // 优先用 runtimePressure（sessions API 返回的真实值），null 时保持现状不伪造。
    const runtimePressure = toFiniteNumber(topSession?.pressurePercent);
    const nextPressure = runtimePressure != null ? clampPercent(runtimePressure) : (baseState.contextPressure || 0);
    const nextPressureState = normalizePressureState(topSession?.pressureState) || derivePressureState(nextPressure);
    const nextRecommendedAction = pickSessionText(
      topSession?.recommendedAction,
      nextPressureState === 'hot'
        ? 'compact'
        : nextPressureState === 'critical'
          ? 'spawn_new_session'
          : 'none',
    );
    const nextCompactionCount = Math.max(0, Math.round(toFiniteNumber(topSession?.compactionCount) || 0));
    const nextBoundary = topSession?.latestBoundary && typeof topSession.latestBoundary === 'object'
      ? topSession.latestBoundary
      : null;
    const nextBoundaryId = pickSessionText(topSession?.latestBoundaryId, nextBoundary?.boundaryId);
    const nextBoundaryAt = Math.max(0, Math.round(toFiniteNumber(topSession?.latestBoundaryAt ?? nextBoundary?.createdAt) || 0));
    const nextBoundaryMode = pickSessionText(topSession?.latestBoundaryMode, nextBoundary?.mode);
    const nextBoundarySummaryRef = pickSessionText(
      topSession?.latestBoundarySummaryRef,
      topSession?.compactionSummaryRef,
      nextBoundary?.summaryRef,
    );
    const nextTrancheId = pickSessionText(topSession?.currentTrancheId, nextBoundary?.trancheId);
    const nextObjectiveDigest = pickSessionText(
      topSession?.currentObjectiveDigest,
      topSession?.objective,
      baseState.currentObjectiveDigest,
      baseState.objective,
    );
    const nextOpenIssuesDigest = pickSessionText(topSession?.openIssuesDigest, baseState.openIssuesDigest);
    const nextHandoffPacket = topSession?.latestHandoffPacket && typeof topSession.latestHandoffPacket === 'object'
      ? topSession.latestHandoffPacket
      : nextBoundary?.handoffPacket && typeof nextBoundary.handoffPacket === 'object'
        ? nextBoundary.handoffPacket
        : null;

    if (sameTopSession) {
      if ((nextPressureState === 'hot' || nextPressureState === 'critical') && nextPressureState !== baseState.pressureState) {
        queueTimelineEvent(
          'auto_compact_started',
          'system',
          `${PRESSURE_STATE_LABELS[nextPressureState] || '上下文高压'} · ${PRESSURE_ACTION_LABELS[nextRecommendedAction] || '建议压缩'}`,
        );
      }
      if (nextCompactionCount > (baseState.compactionCount || 0) && String(nextBoundaryMode).startsWith('auto_')) {
        queueTimelineEvent(
          'auto_compact_completed',
          'system',
          `自动压缩完成${nextBoundaryMode ? ` · ${formatCompactionModeLabel(nextBoundaryMode)}` : ''}`,
        );
      }
      if (nextBoundaryId && nextBoundaryId !== baseState.latestBoundaryId) {
        const boundaryParts = [`创建边界 ${nextBoundaryId}`];
        if (nextTrancheId) boundaryParts.push(`tranche ${nextTrancheId}`);
        if (nextBoundaryMode) boundaryParts.push(formatCompactionModeLabel(nextBoundaryMode));
        queueTimelineEvent('compact_boundary_created', 'system', boundaryParts.filter(Boolean).join(' · '));
      }
      if (nextTrancheId && nextTrancheId !== baseState.currentTrancheId) {
        queueTimelineEvent('tranche_resumed', 'system', `恢复 tranche ${nextTrancheId}`);
      }
    }

    const nextTimeline = timelineAdditions.length > 0
      ? [...timelineAdditions.reverse(), ...(baseState.timeline || [])].slice(0, 50)
      : (baseState.timeline || []);

    // 不替换全部 children：保留终态天罡；对“已从 sessions.list 消失但仍是活跃态”的子会话，
    // 做一次缺席计数，避免它们永远卡在“行令中”。
    const updatedKeys = new Set(updatedChildren.map(c => c.sessionKey));
    const carriedChildren = (baseState.children || []).flatMap((child) => {
      if (updatedKeys.has(child.sessionKey)) return [];
      const currentStatus = normalizeStatus(child.status);
      if (isTerminalChildStatus(currentStatus)) {
        return [{ ...child, _missingRounds: 0 }];
      }

      const missingRounds = Math.max(0, Number(child?._missingRounds || 0)) + 1;
      const summaryText = pickSessionText(child?.summary, child?.resultDigest);
      const shouldPromoteTerminal = missingRounds >= 2;
      if (!shouldPromoteTerminal) {
        return [{ ...child, _missingRounds: missingRounds }];
      }

      const terminalStatus = currentStatus === 'failed'
        ? 'failed'
        : currentStatus === 'aborted'
          ? 'aborted'
          : 'timed_out';
      if (terminalStatus === 'failed' || terminalStatus === 'timed_out') {
        queueTimelineEvent(
          'task_failed',
          child.agentId || 'unknown',
          terminalStatus === 'timed_out'
            ? `${child.agentId || '子会话'} 失联`
            : `${child.agentId || '子会话'} 折损`,
        );
      } else if (terminalStatus === 'aborted') {
        queueTimelineEvent(
          'task_progress',
          child.agentId || 'unknown',
          `${child.agentId || '子会话'} 撤令`,
        );
      }

      return [{
        ...child,
        status: terminalStatus,
        summary: terminalStatus === 'done' ? (summaryText || child.summary || '') : '',
        resultDigest: terminalStatus === 'done'
          ? (summaryText ? (child.resultDigest || summarize(summaryText)) : child.resultDigest)
          : '',
        error: terminalStatus === 'timed_out'
          ? (child.error || '执行超时')
          : terminalStatus === 'failed'
            ? (child.error || '执令受阻')
          : child.error,
        lastActivityAt: now,
        _missingRounds: missingRounds,
      }];
    });
    const mergedChildren = sessionReset ? updatedChildren : [...updatedChildren, ...carriedChildren];

    return {
      ...baseState,
      children: mergedChildren,
      currentWorker: liveChild ? liveChild.agentId : null,
      nextWorker: queuedChild ? queuedChild.agentId : null,
      lastSyncAt: now,
      updatedAt: now,
      contextPressure: nextPressure,
      pressureState: nextPressureState,
      recommendedAction: nextRecommendedAction || 'none',
      compactionCount: nextCompactionCount,
      sessionKey: resolvedSessionKey,
      sessionId: resolvedSessionId,
      objective: nextObjectiveDigest || baseState.objective,
      currentObjectiveDigest: nextObjectiveDigest,
      openIssuesDigest: nextOpenIssuesDigest,
      latestBoundary: nextBoundary,
      latestBoundaryId: nextBoundaryId,
      latestBoundaryAt: nextBoundaryAt,
      latestBoundaryMode: nextBoundaryMode,
      latestBoundarySummaryRef: nextBoundarySummaryRef,
      currentTrancheId: nextTrancheId,
      latestHandoffPacket: nextHandoffPacket,
      timeline: nextTimeline,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export {
  teamTaskStore,
  findChild,
  updateChild,
  addChild,
  setCurrentWorker,
  setNextWorker,
  setPhase,
  setObjective,
  syncFromSessions,
  onSubagentQueued,
  onSubagentRunning,
  onSubagentDone,
  onSubagentFailed,
  onSubagentTimedOut,
  onSubagentAborted,
  pushTimelineEvent,
  getTimeline,
  normalizeStatus,
  getRosterEntry,
  getAllSeats,
  getStatusLabel,
  setIterationCount,
  addIssue,
  markRework,
  clearRework,
  // Tranche 1 常量
  BU_LIANG_ROSTER,
  BU_LIANG_STATUS,
  TIMELINE_EVENTS,
  PHASE_LABELS,
};

// 调试：挂到 window 上，方便在浏览器 console 里检查
if (typeof window !== 'undefined') {
  window.__teamTaskStore = teamTaskStore;
  window.__teamTaskHelpers = {
    findChild, updateChild, addChild,
    setCurrentWorker, setNextWorker, setPhase,
    syncFromSessions,
    onSubagentQueued, onSubagentRunning, onSubagentDone,
    onSubagentFailed, onSubagentTimedOut, onSubagentAborted,
    pushTimelineEvent, getTimeline,
    getRosterEntry,
    getAllSeats,
    getStatusLabel,
    setIterationCount,
    addIssue,
    markRework,
    clearRework,
  };
  // 暴露常量供不良人面板 JS 使用（避免重复定义）
  window.__buLiangRoster = BU_LIANG_ROSTER;
  window.__buLiangStatus = BU_LIANG_STATUS;
  window.__timelineEvents = TIMELINE_EVENTS;
  window.__phaseLabels = PHASE_LABELS;

  // ─── Companion Sprite API ─────────────────────────────────────────────────
  window.__showCompanionSprite = function(agentId, label) {
      injectCompanionCSS();
      const el = getOrCreateCompanionSprite();
      _spriteState.visible = true;
      _spriteState.agentId = agentId;
      el.querySelector('.cs-label').textContent = label || agentId;
      el.style.display = 'block';
  };

  window.__hideCompanionSprite = function() {
      if (_spriteEl) _spriteEl.style.display = 'none';
      _spriteState.visible = false;
  };

  window.__updateCompanionState = function(state, reaction, durationMs) {
      if (!_spriteState.visible) return;
      const el = document.getElementById('companion-sprite');
      if (!el) return;
      _spriteState.state = state;

      if (state === 'speaking' && reaction) {
          // 显示气泡
          const bubble = el.querySelector('.cs-bubble');
          bubble.textContent = reaction;
          bubble.style.display = 'block';
          bubble.style.opacity = '1';
          _spriteState.reactionExpiresAt = Date.now() + (durationMs ?? 10000);
          // 10s 后 fade out
          setTimeout(() => {
              if (Date.now() >= _spriteState.reactionExpiresAt) {
                  bubble.style.transition = 'opacity 3s ease-out';
                  bubble.style.opacity = '0';
                  setTimeout(() => { bubble.style.display = 'none'; }, 3000);
              }
          }, durationMs ?? 10000);
      }

      if (state === 'thinking' && reaction) {
          const bubble = el.querySelector('.cs-bubble');
          bubble.textContent = '🤔 ' + reaction;
          bubble.style.display = 'block';
      }

      if (state === 'idle') {
          // 隐藏气泡
          const bubble = el.querySelector('.cs-bubble');
          bubble.style.display = 'none';
          bubble.style.opacity = '1';
      }
  };

  window.__triggerPetAnimation = function() {
      const el = document.getElementById('companion-sprite');
      if (!el) return;
      const heartsEl = el.querySelector('.cs-pet-hearts');
      heartsEl.style.display = 'block';
      heartsEl.innerHTML = '';

      // 生成 4 个爱心，随机位置飘散
      const hearts = ['💖', '💕', '💗', '💓'];
      hearts.forEach((heart, i) => {
          const span = document.createElement('span');
          span.textContent = heart;
          span.style.cssText = `
              position: absolute;
              left: ${Math.random() * 40 - 20}px;
              bottom: 0;
              font-size: ${16 + Math.random() * 8}px;
              animation: cs-heart-float ${0.8 + Math.random() * 0.4}s ease-out forwards;
              animation-delay: ${i * 0.1}s;
              opacity: 0;
          `;
          heartsEl.appendChild(span);
      });

      // 2.5s 后清除
      setTimeout(() => {
          heartsEl.innerHTML = '';
          heartsEl.style.display = 'none';
      }, 2500);
  };
}
