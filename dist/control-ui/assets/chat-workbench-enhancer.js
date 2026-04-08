const WORKBENCH_ENHANCER_VERSION = "personal-workbench-enhancer-20260408a";
const COMPOSER_MODE_KEY = "openclaw:workbench:composer-mode:v1";
const DEFAULT_MODE = "agent";
const VALID_MODES = new Set(["agent", "team"]);
const RESET_COMMAND_RE = /^\/(?:new|reset)\b/i;

const STATE = {
  mode: readStoredMode(),
  syncQueued: false,
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
      hint.textContent = STATE.mode === "team" ? "团队派工" : "单兵直问";
    }
  }
  const composer = document.querySelector(".agent-chat__input");
  if (composer) {
    composer.dataset.composerMode = STATE.mode;
  }
}

function applyTeamDispatch(app, message) {
  const text = normalizeText(message);
  if (!text || text.startsWith("/")) {
    return;
  }
  const store = window.__teamTaskStore;
  const helpers = window.__teamTaskHelpers;
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
  const store = window.__teamTaskStore;
  const helpers = window.__teamTaskHelpers;
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
  app.handleSendChat = async function patchedHandleSendChat(messageOverride, opts) {
    const outgoing =
      typeof messageOverride === "string" ? messageOverride : normalizeText(this.chatMessage);
    if (RESET_COMMAND_RE.test(outgoing)) {
      resetTeamDispatch(this, "新对话已开启 · 总谱归档完毕");
    }
    if (STATE.mode === "team") {
      applyTeamDispatch(this, outgoing);
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
