const WORKBENCH_ENHANCER_VERSION = "personal-workbench-enhancer-20260409d";
const COMPOSER_MODE_KEY = "openclaw:workbench:composer-mode:v1";
const DEFAULT_MODE = "agent";
const VALID_MODES = new Set(["agent", "team"]);
const RESET_COMMAND_RE = /^\/(?:new|reset)\b/i;
const TEAM_ENFORCEMENT_MARKER = "【TEAM_MODE_ENFORCEMENT】";
const TEAM_ENFORCEMENT_GRACE_MS = 1400;
const TEAM_DISPATCH_EVIDENCE_RE =
  /(sessions_spawn|子代理|子会话|天罡|分身|派工|分派|军令|分道齐进|并进|协作席位|回呈|回传|评审完毕|汇总完毕|裁断结束)/i;

const STATE = {
  mode: readStoredMode(),
  syncQueued: false,
  enforcement: null,
  enforcementSending: false,
};

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function shortenKey(value) {
  const text = normalizeText(value);
  if (text.length <= 26) {
    return text;
  }
  return `${text.slice(0, 10)}...${text.slice(-10)}`;
}

function stripLabelPrefix(label) {
  return normalizeText(label)
    .replace(/^subagent:\s*/i, "")
    .replace(/^dashboard:\s*/i, "")
    .replace(/^webchat:\s*/i, "")
    .replace(/^cron:\s*/i, "");
}

function readStoredMode() {
  try {
    const value = normalizeText(window.localStorage.getItem(COMPOSER_MODE_KEY)).toLowerCase();
    return VALID_MODES.has(value) ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function persistMode(mode) {
  try {
    window.localStorage.setItem(COMPOSER_MODE_KEY, mode);
  } catch {
    // Ignore storage failures.
  }
}

function parseSessionInfo(key) {
  const normalized = normalizeText(key);
  const lower = normalized.toLowerCase();
  if (!normalized || normalized === "main" || normalized === "agent:main:main") {
    return { label: "主线总会话", badge: "主线" };
  }
  if (lower.startsWith("dashboard:")) {
    return {
      label: `仪表盘 ${normalized.split(":").slice(1).join(":").slice(0, 10) || "会话"}`,
      badge: "仪表盘",
    };
  }
  if (lower.includes(":subagent:")) {
    return {
      label: normalized.split(":").pop() || "天罡分身",
      badge: "分身",
    };
  }
  if (lower.startsWith("cron:") || lower.includes(":cron:")) {
    return {
      label: normalized.split(":").slice(-1)[0] || "系统任务",
      badge: "系统",
    };
  }
  if (lower.startsWith("webchat:") || lower.includes(":direct:") || lower.includes(":group:")) {
    return {
      label: normalized.split(":").slice(1).join(":") || "外联会话",
      badge: "外联",
    };
  }
  if (lower.startsWith("agent:")) {
    const parts = normalized.split(":").filter(Boolean);
    return {
      label: parts[2] || parts[1] || normalized,
      badge: "席位",
    };
  }
  return { label: shortenKey(normalized), badge: "会话" };
}

function resolveSessionInfo(app) {
  const key = normalizeText(app?.sessionKey);
  const rows = Array.isArray(app?.sessionsResult?.sessions) ? app.sessionsResult.sessions : [];
  const row = rows.find((entry) => normalizeText(entry?.key) === key) || null;
  const uiLabel = stripLabelPrefix(document.querySelector(".buli-session-trigger__label")?.textContent);
  const rowLabel = stripLabelPrefix(row?.label || row?.displayName);
  const parsed = parseSessionInfo(key);
  return {
    key,
    label: uiLabel || rowLabel || parsed.label,
    badge: parsed.badge,
  };
}

function resolveTabLabel(tab) {
  switch (normalizeText(tab)) {
    case "chat":
      return "聊天";
    case "agents":
      return "席位";
    case "sessions":
      return "案卷";
    case "overview":
      return "总览";
    case "usage":
      return "用度";
    case "logs":
      return "驿报";
    default:
      return normalizeText(tab) || "工作台";
  }
}

function resolveDocumentTitle(app) {
  const tab = normalizeText(app?.tab || "chat");
  if (tab !== "chat") {
    return `OpenClaw · ${resolveTabLabel(tab)} · 不良人总谱`;
  }
  const session = resolveSessionInfo(app);
  const modeLabel = STATE.mode === "team" ? "Agent Team" : "Agent";
  return `OpenClaw · ${session.label} · ${modeLabel} · 不良人总谱`;
}

function syncDocumentTitle(app) {
  const nextTitle = resolveDocumentTitle(app);
  if (!nextTitle || document.title === nextTitle) {
    document.documentElement.dataset.composerMode = STATE.mode;
    if (document.body) {
      document.body.dataset.composerMode = STATE.mode;
    }
    return;
  }
  document.title = nextTitle;
  document.documentElement.dataset.composerMode = STATE.mode;
  if (document.body) {
    document.body.dataset.composerMode = STATE.mode;
  }
  try {
    window.history.replaceState(window.history.state, nextTitle, window.location.href);
  } catch {
    // Title sync is best-effort.
  }
}

function createModeControl() {
  const wrap = document.createElement("div");
  wrap.className = "buli-composer-mode";
  wrap.setAttribute("role", "group");
  wrap.setAttribute("aria-label", "对话模式");
  wrap.innerHTML = `
    <button type="button" class="buli-composer-mode__btn" data-composer-mode-value="agent">
      Agent
    </button>
    <button type="button" class="buli-composer-mode__btn" data-composer-mode-value="team">
      Agent Team
    </button>
    <span class="buli-composer-mode__hint"></span>
  `;
  return wrap;
}

function syncModeControls() {
  const toolbars = Array.from(document.querySelectorAll(".agent-chat__toolbar-right"));
  for (const toolbar of toolbars) {
    let control = toolbar.querySelector(":scope > .buli-composer-mode");
    if (!control) {
      control = createModeControl();
      toolbar.insertBefore(control, toolbar.firstChild);
    }
    const buttons = control.querySelectorAll("[data-composer-mode-value]");
    for (const button of buttons) {
      const value = normalizeText(button.getAttribute("data-composer-mode-value")).toLowerCase();
      const isActive = value === STATE.mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    }
    const hint = control.querySelector(".buli-composer-mode__hint");
    if (hint) {
      hint.textContent = STATE.mode === "team" ? "强制派工" : "单兵直问";
    }
  }
  const composer = document.querySelector(".agent-chat__input");
  if (composer) {
    composer.dataset.composerMode = STATE.mode;
  }
}

function getTeamStore() {
  return window.__teamTaskStore;
}

function getTeamHelpers() {
  return window.__teamTaskHelpers;
}

function clearTeamEnforcement() {
  STATE.enforcement = null;
  STATE.enforcementSending = false;
}

function buildSessionAliasSet(...values) {
  const aliases = new Set();
  const add = (value) => {
    const text = normalizeText(value).toLowerCase();
    if (!text || aliases.has(text)) {
      return;
    }
    aliases.add(text);

    if (text === "main" || text === "agent:main:main" || text === "webchat:g-agent-main-main") {
      aliases.add("main");
      aliases.add("agent:main:main");
      aliases.add("webchat:g-agent-main-main");
      return;
    }

    const webchatDashboardMatch = text.match(/^webchat:g-agent-main-dashboard-(.+)$/i);
    if (webchatDashboardMatch) {
      const suffix = webchatDashboardMatch[1];
      aliases.add(`dashboard:${suffix}`);
      aliases.add(`main:dashboard:${suffix}`);
      aliases.add(`agent:main:dashboard:${suffix}`);
      return;
    }

    if (text.startsWith("dashboard:")) {
      const suffix = text.slice("dashboard:".length);
      aliases.add(`main:dashboard:${suffix}`);
      aliases.add(`agent:main:dashboard:${suffix}`);
      aliases.add(`webchat:g-agent-main-dashboard-${suffix}`);
      return;
    }

    if (text.startsWith("main:dashboard:")) {
      const suffix = text.slice("main:dashboard:".length);
      aliases.add(`dashboard:${suffix}`);
      aliases.add(`agent:main:dashboard:${suffix}`);
      aliases.add(`webchat:g-agent-main-dashboard-${suffix}`);
      return;
    }

    if (text.startsWith("agent:main:dashboard:")) {
      const suffix = text.slice("agent:main:dashboard:".length);
      aliases.add(`dashboard:${suffix}`);
      aliases.add(`main:dashboard:${suffix}`);
      aliases.add(`webchat:g-agent-main-dashboard-${suffix}`);
    }
  };

  values.flat().forEach(add);
  return aliases;
}

function markTeamEnforcementIssue(app, detail) {
  const store = getTeamStore();
  const helpers = getTeamHelpers();
  const text = normalizeText(detail) || "团队模式违令 · 未实际派工";
  if (typeof store?.setState === "function") {
    store.setState((state) => {
      const issues = Array.isArray(state?.issues) ? state.issues.slice() : [];
      if (!issues.includes(text)) {
        issues.unshift(text);
      }
      return {
        ...state,
        sessionKey: normalizeText(app?.sessionKey) || state.sessionKey || "main",
        issues: issues.slice(0, 6),
        updatedAt: Date.now(),
      };
    });
  }
  if (typeof helpers?.pushTimelineEvent === "function") {
    helpers.pushTimelineEvent("task_progress", "system", text);
  }
}

function collectRecentAssistantSurfaceText(limit = 12) {
  if (typeof document === "undefined") {
    return "";
  }
  const thread =
    document.querySelector(".chat-main .chat-thread") || document.querySelector(".chat-thread");
  if (!thread) {
    return "";
  }
  return Array.from(thread.querySelectorAll(".chat-line"))
    .filter((line) => !line.classList.contains("user"))
    .slice(-limit)
    .map((line) => {
      const bubble = line.querySelector(".chat-bubble") || line;
      return normalizeText(bubble?.innerText || bubble?.textContent || "");
    })
    .filter(Boolean)
    .join("\n");
}

function getMessageTimestamp(message) {
  const values = [
    message?.timestamp,
    message?.ts,
    message?.startedAt,
    message?.updatedAt,
    message?.createdAt,
  ];
  for (const value of values) {
    const num = Number(value || 0);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }
  return 0;
}

function hasStructuredDispatchEvidence(app, sinceTs = 0) {
  const messages = Array.isArray(app?.chatMessages) ? app.chatMessages : [];
  for (const message of messages) {
    const timestamp = getMessageTimestamp(message);
    if (sinceTs > 0 && timestamp > 0 && timestamp + 50 < sinceTs) {
      continue;
    }
    if (Array.isArray(message?.content) && message.content.some((block) => (
      block &&
      typeof block === "object" &&
      block.type === "toolCall" &&
      /^sessions_spawn$/i.test(String(block.name || "").trim())
    ))) {
      return true;
    }
    if (message?.role === "toolResult") {
      const contentText = Array.isArray(message.content)
        ? message.content
            .filter((block) => block && typeof block === "object" && block.type === "text")
            .map((block) => normalizeText(block.text))
            .join("\n")
        : "";
      if (/childSessionKey/i.test(contentText) || /"status"\s*:\s*"accepted"/i.test(contentText)) {
        return true;
      }
    }
  }
  return false;
}

function hasScopedTeamChildren(app) {
  const store = getTeamStore();
  const snapshot = typeof store?.getState === "function" ? store.getState() : null;
  const currentSessionKey = normalizeText(app?.sessionKey);
  if (!snapshot || !currentSessionKey) {
    return false;
  }
  const activeSessionAliases = buildSessionAliasSet(currentSessionKey);
  const snapshotSessionAliases = buildSessionAliasSet(snapshot?.sessionKey);
  if (snapshotSessionAliases.size > 0) {
    let snapshotMatches = false;
    for (const alias of snapshotSessionAliases) {
      if (activeSessionAliases.has(alias)) {
        snapshotMatches = true;
        break;
      }
    }
    if (!snapshotMatches) {
      return false;
    }
  }
  if (activeSessionAliases.size === 0) {
    return false;
  }
  const children = Array.isArray(snapshot?.children) ? snapshot.children : [];
  return children.some((child) => {
    const sessionKey = normalizeText(child?.sessionKey);
    const parentAliases = buildSessionAliasSet(
      child?.parentSessionKey ||
        child?.controllerSessionKey ||
        child?.requesterSessionKey ||
        child?.ownerSessionKey ||
        child?.sourceSessionKey,
    );
    const agentId = normalizeText(child?.agentId || child?.seatKey || child?.displayName);
    if (agentId === "main") {
      return false;
    }
    for (const alias of parentAliases) {
      if (activeSessionAliases.has(alias)) {
        return true;
      }
    }
    if (sessionKey && sessionKey !== currentSessionKey && sessionKey !== "main") {
      return true;
    }
    return false;
  });
}

function hasTeamDispatchEvidence(app, sinceTs = 0) {
  if (hasScopedTeamChildren(app)) {
    return true;
  }
  if (hasStructuredDispatchEvidence(app, sinceTs)) {
    return true;
  }
  return TEAM_DISPATCH_EVIDENCE_RE.test(collectRecentAssistantSurfaceText());
}

function buildTeamEnforcementMessage(originalMessage) {
  const task = normalizeText(originalMessage);
  return [
    TEAM_ENFORCEMENT_MARKER,
    "你当前处于 Agent Team 强制模式。",
    "上一轮没有先实际派出任何子代理，已违反团队模式。",
    "现在必须重新执行：先使用 sessions_spawn 派出至少 1 名子代理；复杂任务默认派出 2-3 名并明确分工。",
    "在出现实际派工结果前，不得直接给出最终结论、总结或单兵完成答案。",
    "",
    "原始用户任务：",
    task,
  ].join("\n");
}

async function enforceTeamMode(app) {
  const enforcement = STATE.enforcement;
  if (!app || STATE.mode !== "team" || !enforcement) {
    return;
  }
  const currentSessionKey = normalizeText(app?.sessionKey);
  if (!currentSessionKey || currentSessionKey !== enforcement.sessionKey) {
    clearTeamEnforcement();
    return;
  }
  if (hasTeamDispatchEvidence(app, enforcement.startedAt || 0)) {
    clearTeamEnforcement();
    return;
  }
  if (Array.isArray(app.chatQueue) && app.chatQueue.length > 0) {
    return;
  }
  if (app.chatSending || app.chatRunId) {
    return;
  }
  const now = Date.now();
  const baselineTs = enforcement.correctedAt || enforcement.startedAt;
  if (now - baselineTs < TEAM_ENFORCEMENT_GRACE_MS) {
    return;
  }
  if (enforcement.correctedAt) {
    markTeamEnforcementIssue(app, "团队模式违令 · 连续两轮未实际派工");
    clearTeamEnforcement();
    return;
  }
  const originalSend = app.__OPENCLAW_WORKBENCH_ORIGINAL_SEND__;
  if (typeof originalSend !== "function" || STATE.enforcementSending) {
    return;
  }
  STATE.enforcementSending = true;
  STATE.enforcement = {
    ...enforcement,
    correctedAt: now,
  };
  applyTeamDispatch(app, enforcement.originalMessage);
  markTeamEnforcementIssue(app, "团队模式纠偏 · 已强制要求先派工");
  try {
    await originalSend.call(app, buildTeamEnforcementMessage(enforcement.originalMessage));
  } finally {
    STATE.enforcementSending = false;
  }
}

function applyTeamDispatch(app, message) {
  const text = normalizeText(message);
  if (!text || text.startsWith("/")) {
    return;
  }
  const store = getTeamStore();
  const helpers = getTeamHelpers();
  const snapshot = typeof store?.getState === "function" ? store.getState() : null;
  const children = Array.isArray(snapshot?.children) ? snapshot.children : [];
  const hasActiveChildren = children.some((child) => {
    const status = normalizeText(child?.status).toLowerCase();
    return status === "running" || status === "queued" || status === "live";
  });
  if (typeof store?.setState === "function") {
    store.setState((state) => ({
      ...state,
      sessionKey: normalizeText(app?.sessionKey) || state.sessionKey || "main",
      objective: text,
      currentObjectiveDigest: text,
      currentWorker: state.currentWorker || "main",
      phase: hasActiveChildren ? state.phase || "executing" : "planning",
      updatedAt: Date.now(),
    }));
  }
  if (typeof helpers?.pushTimelineEvent === "function") {
    helpers.pushTimelineEvent("task_progress", "main", `团队军令已下达 · ${text.slice(0, 72)}`);
  }
}

function resetTeamDispatch(app, reason) {
  const store = getTeamStore();
  const helpers = getTeamHelpers();
  clearTeamEnforcement();
  if (typeof store?.setState === "function") {
    store.setState((state) => ({
      ...state,
      sessionKey: normalizeText(app?.sessionKey) || "main",
      sessionId: null,
      objective: "",
      currentObjectiveDigest: "",
      currentWorker: null,
      nextWorker: null,
      phase: "",
      children: [],
      timeline: [],
      issues: [],
      updatedAt: Date.now(),
    }));
  }
  if (typeof helpers?.pushTimelineEvent === "function") {
    helpers.pushTimelineEvent("task_progress", "system", reason || "已清空团队态势");
  }
}

function patchSendPipeline(app) {
  if (!app || app.__OPENCLAW_WORKBENCH_PATCH__ === WORKBENCH_ENHANCER_VERSION) {
    return;
  }
  const original = app.handleSendChat;
  if (typeof original !== "function") {
    return;
  }
  app.__OPENCLAW_WORKBENCH_ORIGINAL_SEND__ = original;
  app.handleSendChat = async function patchedHandleSendChat(messageOverride, opts) {
    const outgoing =
      typeof messageOverride === "string" ? messageOverride : normalizeText(this.chatMessage);
    const normalizedOutgoing = normalizeText(outgoing);
    const isEnforcementMessage = normalizedOutgoing.startsWith(TEAM_ENFORCEMENT_MARKER);
    if (RESET_COMMAND_RE.test(outgoing)) {
      resetTeamDispatch(this, "新对话已开启 · 总谱归档完毕");
    }
    if (STATE.mode === "team") {
      if (!isEnforcementMessage && normalizedOutgoing && !normalizedOutgoing.startsWith("/")) {
        STATE.enforcement = {
          sessionKey: normalizeText(this.sessionKey) || "main",
          originalMessage: normalizedOutgoing,
          startedAt: Date.now(),
          correctedAt: 0,
        };
      }
      applyTeamDispatch(this, isEnforcementMessage ? STATE.enforcement?.originalMessage || outgoing : outgoing);
    } else {
      clearTeamEnforcement();
    }
    return original.call(this, messageOverride, opts);
  };
  app.__OPENCLAW_WORKBENCH_PATCH__ = WORKBENCH_ENHANCER_VERSION;
}

function findApp() {
  return document.querySelector("openclaw-app");
}

function syncWorkbench() {
  STATE.syncQueued = false;
  const app = findApp();
  patchSendPipeline(app);
  syncModeControls();
  syncDocumentTitle(app);
  void enforceTeamMode(app);
}

function requestSync() {
  if (STATE.syncQueued) {
    return;
  }
  STATE.syncQueued = true;
  requestAnimationFrame(syncWorkbench);
}

function setMode(nextMode) {
  const normalized = normalizeText(nextMode).toLowerCase();
  if (!VALID_MODES.has(normalized) || normalized === STATE.mode) {
    return;
  }
  STATE.mode = normalized;
  persistMode(normalized);
  if (normalized !== "team") {
    clearTeamEnforcement();
  }
  requestSync();
}

function boot() {
  if (window.__OPENCLAW_WORKBENCH_ENHANCER__ === WORKBENCH_ENHANCER_VERSION) {
    return;
  }
  window.__OPENCLAW_WORKBENCH_ENHANCER__ = WORKBENCH_ENHANCER_VERSION;

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (!(mutation.target instanceof Element)) {
        return true;
      }
      return !mutation.target.closest(".buli-composer-mode");
    });
    if (relevant) {
      requestSync();
    }
  });

  const start = () => {
    if (!document.body) {
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    requestSync();
    window.setInterval(requestSync, 900);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("[data-composer-mode-value]");
      if (!button) {
        return;
      }
      event.preventDefault();
      setMode(button.getAttribute("data-composer-mode-value"));
    },
    true,
  );

  window.addEventListener("popstate", requestSync, { passive: true });
  window.addEventListener("hashchange", requestSync, { passive: true });
}

boot();
