const SESSION_ENHANCER_VERSION = "personal-session-enhancer-20260408k";
const SESSION_SELECT_SELECTOR = '.chat-controls__session select:not([data-chat-model-select])';
const HOST_STATE = new WeakMap();
const RECENT_LIMIT = 4;

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "core", label: "主线" },
  { id: "dashboard", label: "仪表盘" },
  { id: "subagent", label: "天罡" },
  { id: "agent", label: "席位" },
  { id: "channel", label: "外联" },
  { id: "system", label: "系统" },
];

const SECTION_ORDER = [
  { id: "core", title: "主线", empty: "主线和直属会话会在这里汇总。" },
  { id: "dashboard", title: "仪表盘", empty: "暂无仪表盘会话。" },
  { id: "subagent", title: "天罡分身", empty: "暂无分身记录。" },
  { id: "agent", title: "席位", empty: "暂无席位独立会话。" },
  { id: "channel", title: "外联", empty: "暂无外联会话。" },
  { id: "system", title: "系统", empty: "暂无系统或定时任务会话。" },
  { id: "other", title: "其他", empty: "暂无其他会话。" },
];

const SECTION_LIMITS = {
  core: 8,
  dashboard: 6,
  subagent: 8,
  agent: 6,
  channel: 6,
  system: 5,
  other: 4,
};

const ROLE_NAME_MAP = {
  main: "主线",
  research: "研判席",
  reviewer: "审校席",
  coder: "编修席",
  dev: "工坊席",
  frontend: "前台席",
  qa: "校验席",
  "code-assist": "助编席",
};

const MAIN_ASSISTANT_NAME = "不良帅";

function getRoster() {
  return window.__buLiangRoster || {};
}

let syncQueued = false;
let booted = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeSearchText(value) {
  return normalizeText(value).toLowerCase();
}

function hasHan(value) {
  return /[\u3400-\u9fff]/.test(String(value ?? ""));
}

function formatRelativeTime(timestamp) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "未记录";
  }
  const delta = Date.now() - timestamp;
  if (delta < 45 * 1000) {
    return "刚刚";
  }
  if (delta < 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(delta / 60000))} 分钟前`;
  }
  if (delta < 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(delta / 3600000))} 小时前`;
  }
  if (delta < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.max(1, Math.round(delta / 86400000))} 天前`;
  }
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function shrinkKey(value) {
  const text = normalizeText(value);
  if (text.length <= 32) {
    return text;
  }
  return `${text.slice(0, 12)}...${text.slice(-12)}`;
}

function getHostState(host) {
  let state = HOST_STATE.get(host);
  if (!state) {
    state = {
      open: false,
      query: "",
      filter: "all",
      activeKey: "",
      visibleKeys: [],
      expanded: {},
      shouldFocusSearch: false,
      sectionsScrollTop: 0,
      recentScrollLeft: 0,
      filtersScrollLeft: 0,
    };
    HOST_STATE.set(host, state);
  }
  return state;
}

function parseTimestampCandidate(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return asNumber > 1e12 ? asNumber : asNumber * 1000;
    }
    const asDate = Date.parse(trimmed);
    return Number.isFinite(asDate) ? asDate : 0;
  }
  return 0;
}

function resolveRowTimestamp(row) {
  if (!row || typeof row !== "object") {
    return 0;
  }
  const fields = [
    "updatedAtMs",
    "updatedAt",
    "lastActivityAtMs",
    "lastActivityAt",
    "lastTs",
    "createdAtMs",
    "createdAt",
    "startedAtMs",
    "startedAt",
  ];
  for (const field of fields) {
    const value = parseTimestampCandidate(row[field]);
    if (value) {
      return value;
    }
  }
  return 0;
}

function collectRowMap() {
  const app = document.querySelector("openclaw-app");
  const rows = Array.isArray(app?.sessionsResult?.sessions) ? app.sessionsResult.sessions : [];
  const rowMap = new Map();
  for (const row of rows) {
    if (row?.key) {
      rowMap.set(row.key, row);
    }
  }
  return rowMap;
}

function matchFilter(filterId, entry) {
  if (filterId === "all") {
    return true;
  }
  return entry.section === filterId;
}

function matchQuery(entry, query) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return true;
  }
  return terms.every((term) => entry.searchText.includes(term));
}

function deriveEntryType(key, label) {
  const normalizedKey = normalizeSearchText(key);
  const normalizedLabel = normalizeSearchText(label);
  if (
    key === "main" ||
    key === "agent:main:main" ||
    normalizedKey === "webchat:g-agent-main-main" ||
    normalizedLabel === "主要的"
  ) {
    return { type: "main", section: "core", badge: "主线" };
  }
  if (
    normalizedKey.startsWith("dashboard:") ||
    normalizedKey.startsWith("main:dashboard:") ||
    normalizedKey.startsWith("webchat:g-agent-main-dashboard-") ||
    normalizedKey.includes(":dashboard:") ||
    normalizedLabel.includes("仪表盘")
  ) {
    return { type: "dashboard", section: "dashboard", badge: "仪表盘" };
  }
  if (normalizedKey.startsWith("webchat:") || normalizedKey.includes(":direct:") || normalizedKey.includes(":group:")) {
    return { type: "channel", section: "channel", badge: "外联" };
  }
  if (normalizedKey.startsWith("cron:") || normalizedKey.includes(":cron:")) {
    return { type: "cron", section: "system", badge: "系统" };
  }
  if (normalizedKey.includes(":subagent:") || normalizedLabel.startsWith("subagent:")) {
    return { type: "subagent", section: "subagent", badge: "天罡" };
  }
  if (normalizedKey.startsWith("agent:")) {
    return { type: "agent", section: "agent", badge: "席位" };
  }
  return { type: "other", section: "other", badge: "会话" };
}

function stripKnownPrefix(label, type) {
  const text = normalizeText(label);
  if (!text) {
    return "";
  }
  const stripHumanPrefix = (value) =>
    value
      .replace(/^(subagent|子代理|agent|席位|dashboard|仪表盘|webchat|cron|系统)\s*[：:]\s*/i, "")
      .trim();
  if (type === "subagent") {
    return stripHumanPrefix(text.replace(/^subagent:\s*/i, "").trim());
  }
  if (type === "cron") {
    return stripHumanPrefix(text.replace(/^cron:\s*/i, "").trim());
  }
  if (type === "dashboard") {
    return stripHumanPrefix(text.replace(/^dashboard:\s*/i, "").trim());
  }
  if (type === "channel") {
    return stripHumanPrefix(text.replace(/^webchat:\s*/i, "").trim());
  }
  return stripHumanPrefix(text);
}

function looksLikeOpaqueId(value) {
  const text = normalizeText(value);
  if (!text) {
    return false;
  }
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ||
    /^[0-9a-f-]{16,}$/i.test(text)
  );
}

function looksLikeMachineLabel(value) {
  const text = normalizeText(value);
  if (!text) {
    return false;
  }
  return (
    /^g-agent-[a-z0-9-]+$/i.test(text) ||
    /^main:dashboard:[0-9a-f-]+$/i.test(text) ||
    /^agent:main:dashboard:[0-9a-f-]+$/i.test(text) ||
    /^webchat:g-agent-main-dashboard-[0-9a-f-]+$/i.test(text) ||
    /^webchat:g-agent-main-main$/i.test(text) ||
    /^仪表盘代理[:：]主[:：]仪表盘[:：][0-9a-f-]+$/i.test(text) ||
    /^代理[:：]main[:：]dashboard[:：][0-9a-f-]+$/i.test(text) ||
    /^主[:：]仪表盘[:：][0-9a-f-]+$/i.test(text)
  );
}

function splitCandidateParts(value) {
  return normalizeText(value)
    .split(/\s*[·•｜|/]\s*/)
    .map((part) => stripKnownPrefix(part, "other"))
    .filter(Boolean);
}

function extractDashboardId(key) {
  const normalizedKey = normalizeText(key);
  const match = normalizedKey.match(/dashboard[:-]([0-9a-f-]{6,})/i);
  if (match) {
    return match[1];
  }
  return normalizedKey.split(":").pop() || "";
}

function extractAgentSlug(key) {
  const normalizedKey = normalizeText(key);
  const subagentMatch = normalizedKey.match(/^agent:([^:]+):subagent:/i);
  if (subagentMatch) {
    return subagentMatch[1];
  }
  const agentMatch = normalizedKey.match(/^agent:([^:]+):/i);
  if (agentMatch) {
    return agentMatch[1];
  }
  if (/g-agent-main-main/i.test(normalizedKey) || /main:dashboard:/i.test(normalizedKey)) {
    return "main";
  }
  return "";
}

function roleSlugToChinese(slug, type) {
  const normalized = normalizeSearchText(slug);
  if (!normalized) {
    return "";
  }
  const roster = getRoster();
  const rosterEntry = roster[slug] || roster[`agent:${slug}`];
  if (rosterEntry?.fullTitle) {
    return rosterEntry.fullTitle;
  }
  const mapped = ROLE_NAME_MAP[normalized];
  if (mapped) {
    return mapped;
  }
  const cleaned = slug
    .replace(/^g-agent-main-/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  return cleaned;
}

function deriveCanonicalChineseLabel(key, type) {
  const slug = extractAgentSlug(key);
  if (type === "main") {
    return `${MAIN_ASSISTANT_NAME}总案`;
  }
  if (type === "dashboard") {
    if (!slug || slug === "main") {
      return `${MAIN_ASSISTANT_NAME}仪表盘`;
    }
    const roleName = roleSlugToChinese(slug, "dashboard");
    return roleName ? `${roleName}仪表盘` : "仪表盘";
  }
  if (type === "subagent") {
    const roleName = roleSlugToChinese(slug, "subagent");
    return roleName || "天罡分身";
  }
  if (type === "agent") {
    const roleName = roleSlugToChinese(slug, "agent");
    return roleName || "席位案卷";
  }
  if (type === "channel") {
    if (!slug || slug === "main") {
      return `${MAIN_ASSISTANT_NAME}外联案`;
    }
    const roleName = roleSlugToChinese(slug, "agent");
    return roleName ? `${roleName}外联案` : "外联案卷";
  }
  if (type === "system") {
    return "系统案卷";
  }
  return "";
}

function compactText(value, maxLength = 40) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function deriveDisplayLabel(key, rawLabel, title, type, row) {
  const canonicalLabel = deriveCanonicalChineseLabel(key, type);
  const candidates = [...splitCandidateParts(rawLabel), ...splitCandidateParts(title)];
  const rowCandidates = [
    row?.displayName,
    row?.label,
    row?.title,
    row?.name,
  ]
    .map((value) => stripKnownPrefix(value, type))
    .filter(Boolean);
  const informative = candidates.find(
    (candidate) =>
      candidate &&
      candidate !== key &&
      candidate !== shrinkKey(key) &&
      !looksLikeOpaqueId(candidate) &&
      !looksLikeMachineLabel(candidate) &&
      !/^(main|dashboard|subagent|agent|webchat|cron|系统|会话)$/i.test(candidate),
  );
  const informativeRow = rowCandidates.find(
    (candidate) =>
      candidate &&
      !looksLikeOpaqueId(candidate) &&
      !looksLikeMachineLabel(candidate) &&
      !/仪表盘代理|代理[:：]主|main[:：]dashboard/i.test(candidate),
  );

  if (canonicalLabel) {
    return canonicalLabel;
  }

  if (type === "main") {
    const preferred = informativeRow || informative;
    return preferred && hasHan(preferred) ? preferred : `${MAIN_ASSISTANT_NAME}总会话`;
  }
  if (type === "dashboard") {
    const preferred = informativeRow || informative;
    if (preferred && hasHan(preferred)) {
      return preferred.startsWith("仪表盘") ? preferred : `仪表盘 ${preferred}`;
    }
    if (/main:dashboard:|g-agent-main-dashboard-/i.test(key)) {
      return `${MAIN_ASSISTANT_NAME}仪表盘`;
    }
    if (informative) {
      return informative.startsWith("仪表盘") ? informative : `仪表盘 ${informative}`;
    }
    const dashboardId = extractDashboardId(key);
    return dashboardId ? `仪表盘 ${dashboardId.slice(0, 8)}` : "仪表盘";
  }
  if (type === "subagent" || type === "agent") {
    const preferred = informativeRow || informative;
    if (preferred && hasHan(preferred)) {
      return preferred;
    }
    const roleName = roleSlugToChinese(extractAgentSlug(key), type);
    if (roleName) {
      return roleName;
    }
  }
  if (type === "channel") {
    const preferred = informativeRow || informative;
    if (preferred && hasHan(preferred)) {
      return preferred;
    }
    if (/main/i.test(key)) {
      return `${MAIN_ASSISTANT_NAME}外联`;
    }
    if (informative) {
      return informative;
    }
  }
  if (type === "system") {
    if (informativeRow && hasHan(informativeRow)) {
      return informativeRow;
    }
    return "系统任务";
  }
  return fallbackLabelFromKey(key, type);
}

function deriveKeyHint(key, type) {
  if (!key) {
    return "";
  }
  if (type === "main") {
    return "main";
  }
  if (type === "dashboard") {
    const dashboardId = extractDashboardId(key);
    return dashboardId ? dashboardId.slice(0, 8) : shrinkKey(key);
  }
  if (type === "subagent" || type === "agent") {
    const tail = key.split(":").pop() || "";
    return looksLikeOpaqueId(tail) ? tail.slice(0, 8) : shrinkKey(tail || key);
  }
  return shrinkKey(key);
}

function cleanTaskText(value) {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  if (looksLikeOpaqueId(text) || looksLikeMachineLabel(text)) {
    return "";
  }
  return text
    .replace(/^(subagent|子代理|agent|dashboard|仪表盘|webchat|cron)\s*[：:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTaskSummary(row, entry) {
  const candidates = [
    row?.currentObjectiveDigest,
    row?.objective,
    row?.taskSummary,
    row?.task,
    row?.summary,
    row?.description,
    row?.preview,
    row?.latestPreview,
    row?.resultDigest,
    row?.title,
    row?.latestHandoffPacket?.currentObjectiveDigest,
    row?.latestHandoffPacket?.objective,
    row?.latestHandoffPacket?.summary,
  ];

  const found = candidates
    .map((value) => cleanTaskText(value))
    .find((value) => value && value !== entry.label && value !== entry.keyHint);

  if (found) {
    return compactText(found, 52);
  }

  if (entry.type === "main" || entry.section === "core") {
    return `${MAIN_ASSISTANT_NAME}总领当前主线案卷`;
  }
  if (entry.section === "dashboard") {
    return `查看${MAIN_ASSISTANT_NAME}本轮仪表盘与汇总输出`;
  }
  if (entry.section === "subagent") {
    return "天罡分身任务会话";
  }
  if (entry.section === "agent") {
    return "席位独立会话";
  }
  if (entry.section === "channel") {
    return "外联渠道会话";
  }
  if (entry.section === "system") {
    return "系统或定时任务";
  }
  return "";
}

function fallbackLabelFromKey(key, type) {
  if (!key) {
    return "未命名会话";
  }
  if (type === "main") {
    return `${MAIN_ASSISTANT_NAME}总案`;
  }
  if (type === "dashboard") {
    const value = key.split(":").slice(1).join(":").trim();
    return value ? `${MAIN_ASSISTANT_NAME}仪表盘` : "仪表盘会话";
  }
  if (type === "subagent") {
    const value = key.split(":").pop();
    return value || "未命名分身";
  }
  if (type === "cron") {
    return key.split(":").slice(-1)[0] || "系统任务";
  }
  if (type === "channel") {
    const value = key.split(":").slice(1).join(":").trim();
    return value || "外联会话";
  }
  if (type === "agent") {
    const parts = key.split(":");
    return parts[2] || parts[1] || key;
  }
  return key;
}

function deriveFriendlyGroupLabel(groupLabel, type) {
  const text = normalizeText(groupLabel)
    .replace(/\((main|dashboard|subagent|agent|cron|channel|core|other)\)/gi, "")
    .trim();
  if (!text || text === "Other Sessions") {
    return "";
  }
  if (looksLikeOpaqueId(text) || looksLikeMachineLabel(text)) {
    return "";
  }
  if (!hasHan(text)) {
    return "";
  }
  if (type === "main" && /不良帅|主线/.test(text)) {
    return "";
  }
  if (type === "dashboard" && /仪表盘/.test(text)) {
    return "";
  }
  return compactText(text, 24);
}

function buildEntry(option, groupLabel, index, rowMap) {
  const key = normalizeText(option.value);
  const rawLabel = normalizeText(option.textContent);
  const title = normalizeText(option.getAttribute("title") || key);
  const row = rowMap.get(key);
  const typeInfo = deriveEntryType(key, rawLabel || title);
  const displayLabel = deriveDisplayLabel(key, rawLabel, title, typeInfo.type, row);
  const friendlyGroup = deriveFriendlyGroupLabel(groupLabel, typeInfo.type);
  const subtitleParts = [];
  if (friendlyGroup && friendlyGroup !== displayLabel) {
    subtitleParts.push(friendlyGroup);
  }
  if (typeInfo.type === "main" && !friendlyGroup) {
    subtitleParts.push("总案主线");
  } else if (typeInfo.type === "dashboard" && !friendlyGroup) {
    subtitleParts.push("汇总仪表盘");
  } else if (typeInfo.type === "subagent" && !friendlyGroup) {
    subtitleParts.push("天罡分身");
  } else if (typeInfo.type === "cron") {
    subtitleParts.push("系统任务");
  } else if (typeInfo.type === "channel" && !friendlyGroup) {
    subtitleParts.push("外联会话");
  } else if (typeInfo.type === "agent" && !friendlyGroup) {
    subtitleParts.push("席位案卷");
  }
  const shortKey = shrinkKey(key);
  const timestamp = resolveRowTimestamp(row);
  const keyHint = deriveKeyHint(key, typeInfo.type);
  const summaryText = deriveTaskSummary(row, {
    label: displayLabel,
    keyHint,
    section: typeInfo.section,
    type: typeInfo.type,
  });

  return {
    key,
    label: displayLabel,
    rawLabel,
    title,
    shortKey,
    section: typeInfo.section,
    badge: typeInfo.badge,
    groupLabel: friendlyGroup,
    subtitle: subtitleParts.join(" / "),
    summaryText,
    timestamp,
    relativeTime: formatRelativeTime(timestamp),
    keyHint,
    order: index,
    selected: option.selected,
    searchText: normalizeSearchText(
      [
        displayLabel,
        rawLabel,
        title,
        key,
        shortKey,
        summaryText,
        friendlyGroup,
        typeInfo.badge,
        typeInfo.section,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

function collectEntries(select) {
  const rowMap = collectRowMap();
  const entries = [];
  let index = 0;
  const optgroups = Array.from(select.querySelectorAll(":scope > optgroup"));
  if (optgroups.length) {
    for (const group of optgroups) {
      const groupLabel = group.getAttribute("label") || "";
      const options = Array.from(group.querySelectorAll(":scope > option"));
      for (const option of options) {
        entries.push(buildEntry(option, groupLabel, index, rowMap));
        index += 1;
      }
    }
  } else {
    const options = Array.from(select.querySelectorAll(":scope > option"));
    for (const option of options) {
      entries.push(buildEntry(option, "", index, rowMap));
      index += 1;
    }
  }
  return entries;
}

function getOptionSignature(option) {
  if (!(option instanceof HTMLOptionElement)) {
    return "";
  }
  return [
    option.value,
    normalizeText(option.textContent),
    option.getAttribute("title") || "",
    option.disabled ? "1" : "0",
    option.selected ? "1" : "0",
  ].join("\u241f");
}

function getSelectSignature(select) {
  if (!(select instanceof HTMLSelectElement)) {
    return "";
  }
  const options = Array.from(select.options || []);
  return [
    select.value,
    select.disabled ? "1" : "0",
    options.length,
    options.map((option) => getOptionSignature(option)).join("\u241e"),
  ].join("\u241d");
}

function sortEntries(items) {
  return items.slice().sort((left, right) => {
    const rightTs = right.timestamp || 0;
    const leftTs = left.timestamp || 0;
    if (rightTs !== leftTs) {
      return rightTs - leftTs;
    }
    return left.order - right.order;
  });
}

function computeCounts(entries) {
  const counts = Object.fromEntries(FILTERS.map((filter) => [filter.id, 0]));
  counts.other = 0;
  counts.all = entries.length;
  for (const entry of entries) {
    counts[entry.section] = (counts[entry.section] || 0) + 1;
  }
  return counts;
}

function closePicker(host) {
  const state = getHostState(host);
  if (!state.open) {
    return;
  }
  state.open = false;
  removePanel(host);
  renderHost(host, host.__nativeSelect);
}

function closeAllPickers(exceptHost) {
  const hosts = document.querySelectorAll(".buli-session-picker");
  for (const host of hosts) {
    if (host !== exceptHost) {
      closePicker(host);
    }
  }
}

function selectSession(host, key) {
  const select = host.__nativeSelect;
  if (!select || !key) {
    return;
  }
  if (select.value !== key) {
    select.value = key;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const state = getHostState(host);
  state.open = false;
  removePanel(host);
  renderHost(host, select);
}

function moveActive(host, direction) {
  const state = getHostState(host);
  const keys = state.visibleKeys || [];
  if (!keys.length) {
    return;
  }
  const currentIndex = Math.max(0, keys.indexOf(state.activeKey));
  const nextIndex = (currentIndex + direction + keys.length) % keys.length;
  state.activeKey = keys[nextIndex];
}

function renderBadge(entry) {
  return `<span class="buli-session-badge buli-session-badge--${entry.section}">${escapeHtml(
    entry.badge,
  )}</span>`;
}

function renderItem(entry, state, selectedKey) {
  const isCurrent = entry.key === selectedKey;
  const isActive = entry.key === state.activeKey;
  const meta = [entry.subtitle, entry.relativeTime].filter(Boolean).join(" · ");
  const showKeyHint = Boolean(state.query);
  return `
    <button
      type="button"
      class="buli-session-item${isCurrent ? " is-current" : ""}${isActive ? " is-active" : ""}"
      data-action="pick"
      data-key="${escapeHtml(entry.key)}"
      title="${escapeHtml(entry.title)}"
    >
      <span class="buli-session-item__main">
        <span class="buli-session-item__label">${escapeHtml(entry.label)}</span>
        ${entry.summaryText ? `<span class="buli-session-item__summary">${escapeHtml(entry.summaryText)}</span>` : ""}
        <span class="buli-session-item__meta">${escapeHtml(meta)}</span>
        ${showKeyHint ? `<span class="buli-session-item__key">${escapeHtml(entry.keyHint || entry.shortKey)}</span>` : ""}
      </span>
      <span class="buli-session-item__side">
        ${renderBadge(entry)}
      </span>
    </button>
  `;
}

function renderRecentChip(entry) {
  return `
    <button
      type="button"
      class="buli-session-recent__chip"
      data-action="pick"
      data-key="${escapeHtml(entry.key)}"
      title="${escapeHtml(entry.title)}"
    >
      ${renderBadge(entry)}
      <span class="buli-session-recent__chip-label">${escapeHtml(entry.label)}</span>
      ${entry.summaryText ? `<span class="buli-session-recent__chip-summary">${escapeHtml(entry.summaryText)}</span>` : ""}
      <span class="buli-session-recent__chip-meta">${escapeHtml(entry.relativeTime)}</span>
    </button>
  `;
}

function renderSection(section, state, selectedKey) {
  const limit = SECTION_LIMITS[section.id] || 6;
  const expanded = Boolean(state.expanded[section.id]);
  const shouldClamp = !state.query && section.items.length > limit;
  const visibleItems = shouldClamp && !expanded ? section.items.slice(0, limit) : section.items;
  const hiddenCount = shouldClamp ? section.items.length - visibleItems.length : 0;

  return `
    <section class="buli-session-section">
      <div class="buli-session-section__head">
        <div class="buli-session-section__title-wrap">
          <span class="buli-session-section__title">${escapeHtml(section.title)}</span>
          <span class="buli-session-section__count">${section.items.length}</span>
        </div>
        ${
          hiddenCount > 0
            ? `<button
                 type="button"
                 class="buli-session-section__toggle"
                 data-action="toggle-section"
                 data-section="${escapeHtml(section.id)}"
               >${expanded ? "收起" : `展开 ${hiddenCount}`}</button>`
            : ""
        }
      </div>
      <div class="buli-session-list">
        ${visibleItems.map((entry) => renderItem(entry, state, selectedKey)).join("")}
      </div>
    </section>
  `;
}

function renderRecentSection(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "";
  }
  return `
    <section class="buli-session-section buli-session-section--recent">
      <div class="buli-session-section__head">
        <div class="buli-session-section__title-wrap">
          <span class="buli-session-section__title">最近使用</span>
          <span class="buli-session-section__count">${items.length}</span>
        </div>
      </div>
      <div class="buli-session-recent__list">
        ${items.map((entry) => renderRecentChip(entry)).join("")}
      </div>
    </section>
  `;
}

function buildViewModel(entries, selectedKey, state) {
  const counts = computeCounts(entries);
  const filtered = entries.filter(
    (entry) => matchFilter(state.filter, entry) && matchQuery(entry, state.query),
  );
  const current = entries.find((entry) => entry.key === selectedKey) || filtered[0] || entries[0] || null;
  const visiblePool = filtered.filter((entry) => entry.key !== selectedKey);
  const recentItems = sortEntries(entries)
    .filter((entry) => entry.key !== selectedKey)
    .slice(0, RECENT_LIMIT);
  const sections = [];

  for (const sectionDef of SECTION_ORDER) {
    const sectionItems = sortEntries(visiblePool.filter((entry) => entry.section === sectionDef.id));
    if (!sectionItems.length) {
      continue;
    }
    sections.push({
      id: sectionDef.id,
      title: sectionDef.title,
      items: sectionItems,
    });
  }

  return {
    counts,
    current,
    filteredCount: filtered.length,
    totalCount: entries.length,
    activeFilter: FILTERS.find((filter) => filter.id === state.filter)?.label || "全部",
    recentItems,
    sections,
  };
}

function buildRenderContext(select, state) {
  const entries = collectEntries(select);
  const disabled = Boolean(select.disabled || entries.length === 0);
  const selectedKey = select.value || entries.find((entry) => entry.selected)?.key || "";
  const view = buildViewModel(entries, selectedKey, state);
  const current = view.current;
  const countsLine = state.query
    ? `已筛到 ${view.filteredCount} / ${view.totalCount} 个会话`
    : state.filter === "all"
      ? `共 ${view.totalCount} 个会话，可按类型快速切换`
      : `${view.activeFilter} 中共有 ${view.filteredCount} 个会话`;

  const visibleKeys = [];
  for (const section of view.sections) {
    for (const entry of section.items) {
      visibleKeys.push(entry.key);
    }
  }
  const currentVisible =
    current && matchFilter(state.filter, current) && matchQuery(current, state.query);
  if (currentVisible && current?.key && !visibleKeys.includes(current.key)) {
    visibleKeys.unshift(current.key);
  }
  state.visibleKeys = visibleKeys;
  if (!state.activeKey || !visibleKeys.includes(state.activeKey)) {
    state.activeKey = visibleKeys[0] || "";
  }

  return {
    disabled,
    selectedKey,
    view,
    current,
    countsLine,
  };
}

function capturePanelState(host) {
  if (!host?.__panelEl?.isConnected) {
    return;
  }
  const state = getHostState(host);
  const sections = host.__panelEl.querySelector(".buli-session-sections");
  const recent = host.__panelEl.querySelector(".buli-session-recent__list");
  const filters = host.__panelEl.querySelector(".buli-session-filters");
  if (sections) {
    state.sectionsScrollTop = sections.scrollTop;
  }
  if (recent) {
    state.recentScrollLeft = recent.scrollLeft;
  }
  if (filters) {
    state.filtersScrollLeft = filters.scrollLeft;
  }
}

function removePanel(host) {
  capturePanelState(host);
  if (host?.__panelEl?.isConnected) {
    host.__panelEl.remove();
  }
  if (host) {
    host.__panelEl = null;
  }
}

function toggleHostPicker(host) {
  if (!host || host.__nativeSelect?.disabled) {
    return;
  }
  const state = getHostState(host);
  const nextOpen = !state.open;
  closeAllPickers(nextOpen ? host : undefined);
  state.open = nextOpen;
  state.shouldFocusSearch = nextOpen;
  renderHost(host, host.__nativeSelect);
}

function getHostFromPanelTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  const panel = target.closest(".buli-session-inline-panel");
  return panel?.__hostPicker || null;
}

function handlePanelAction(host, actionNode) {
  if (!host || !(actionNode instanceof Element)) {
    return false;
  }
  const state = getHostState(host);
  const action = actionNode.getAttribute("data-action");
  if (action === "close") {
    closePicker(host);
    return true;
  }
  if (action === "filter") {
    state.filter = actionNode.getAttribute("data-filter") || "all";
    renderHost(host, host.__nativeSelect);
    return true;
  }
  if (action === "toggle-section") {
    const sectionId = actionNode.getAttribute("data-section") || "";
    state.expanded[sectionId] = !state.expanded[sectionId];
    renderHost(host, host.__nativeSelect);
    return true;
  }
  if (action === "pick") {
    selectSession(host, actionNode.getAttribute("data-key") || "");
    return true;
  }
  if (action === "clear-query") {
    state.query = "";
    state.shouldFocusSearch = true;
    renderHost(host, host.__nativeSelect);
    return true;
  }
  return false;
}

function handlePanelInput(host, input) {
  if (!host || !(input instanceof HTMLInputElement)) {
    return false;
  }
  const state = getHostState(host);
  state.query = input.value;
  renderHost(host, host.__nativeSelect);
  return true;
}

function handlePanelKeydown(host, event) {
  if (!host) {
    return false;
  }
  const input = event.target instanceof Element ? event.target.closest(".buli-session-search__input") : null;
  if (event.key === "Escape") {
    event.preventDefault();
    closePicker(host);
    return true;
  }
  if (!input) {
    return false;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveActive(host, 1);
    renderHost(host, host.__nativeSelect);
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveActive(host, -1);
    renderHost(host, host.__nativeSelect);
    return true;
  }
  if (event.key === "Enter") {
    const state = getHostState(host);
    if (state.activeKey) {
      event.preventDefault();
      selectSession(host, state.activeKey);
      return true;
    }
  }
  return false;
}

function renderHost(host, select) {
  if (!host || !select || !select.isConnected) {
    removePanel(host);
    return;
  }
  const state = getHostState(host);
  const { disabled, selectedKey, view, current, countsLine } = buildRenderContext(select, state);

  const filtersMarkup = FILTERS.map((filter) => {
    const count = filter.id === "all" ? view.totalCount : view.counts[filter.id] || 0;
    return `
      <button
        type="button"
        class="buli-session-filter${state.filter === filter.id ? " is-active" : ""}"
        data-action="filter"
        data-filter="${escapeHtml(filter.id)}"
      >
        <span>${escapeHtml(filter.label)}</span>
        <span class="buli-session-filter__count">${count}</span>
      </button>
    `;
  }).join("");

  const recentMarkup =
    !state.query && state.filter === "all" && view.recentItems.length
      ? renderRecentSection(view.recentItems)
      : "";

  const sectionsMarkup = view.sections.length || recentMarkup
    ? `${view.sections.map((section) => renderSection(section, state, selectedKey)).join("")}${recentMarkup}`
    : `
      <div class="buli-session-empty">
        <strong>没有匹配到会话</strong>
        <span>试试席位名、分身名、仪表盘编号，或原始会话密钥。</span>
      </div>
    `;

  host.classList.toggle("is-open", state.open);
  host.innerHTML = `
    <button
      type="button"
      class="buli-session-trigger${state.open ? " is-open" : ""}"
      aria-expanded="${state.open ? "true" : "false"}"
      title="${escapeHtml(current?.title || "选择会话")}"
      ${disabled ? "disabled" : ""}
    >
      <span class="buli-session-trigger__icon" aria-hidden="true"></span>
      <span class="buli-session-trigger__caption">会话册</span>
      <span class="buli-session-trigger__count">${view.totalCount}</span>
      <span class="buli-session-trigger__chevron" aria-hidden="true"></span>
    </button>
  `;

  renderInlinePanel(host, select, {
    current,
    countsLine,
    view,
    selectedKey,
    filtersMarkup,
    recentMarkup,
    sectionsMarkup,
  });
}

function renderInlinePanel(host, select, prepared) {
  removePanel(host);
  if (!host || !select || !select.isConnected) {
    return;
  }
  const state = getHostState(host);
  if (!state.open) {
    return;
  }

  const context = prepared || buildRenderContext(select, state);
  if (context.disabled) {
    state.open = false;
    renderHost(host, select);
    return;
  }

  const panel = document.createElement("section");
  panel.className = "buli-session-inline-panel";
  panel.innerHTML = `
    <div class="buli-session-panel" role="region" aria-label="会话搜索与切换">
      <div class="buli-session-panel__head">
        <div class="buli-session-panel__title-wrap">
          <div class="buli-session-panel__eyebrow">历史会话</div>
          <div class="buli-session-panel__title">快速切换</div>
        </div>
        <button type="button" class="buli-session-panel__close" data-action="close">收起</button>
      </div>
      <div class="buli-session-overview">
        <div class="buli-session-current">
          <div class="buli-session-current__top">
            ${context.current ? renderBadge(context.current) : ""}
            <span class="buli-session-current__eyebrow">当前正在查看</span>
          </div>
          <div class="buli-session-current__title">${escapeHtml(context.current?.label || "暂无会话")}</div>
          ${
            context.current?.summaryText
              ? `<div class="buli-session-current__summary">${escapeHtml(context.current.summaryText)}</div>`
              : ""
          }
          <div class="buli-session-current__meta">${escapeHtml(
            [context.current?.subtitle || context.current?.badge, context.current?.relativeTime]
              .filter(Boolean)
              .join(" · "),
          )}</div>
          <div class="buli-session-current__key">${escapeHtml(context.current?.keyHint || context.current?.shortKey || "")}</div>
        </div>
        <div class="buli-session-overview__side">
          <div class="buli-session-overview__label">检索</div>
          <label class="buli-session-search">
            <span class="buli-session-search__icon" aria-hidden="true"></span>
            <input
              class="buli-session-search__input"
              type="text"
              placeholder="搜席位、分身、仪表盘编号、会话密钥"
              value="${escapeHtml(state.query)}"
            />
            ${
              state.query
                ? `<button type="button" class="buli-session-search__clear" data-action="clear-query">清空</button>`
                : ""
            }
          </label>
          <div class="buli-session-summary">${escapeHtml(context.countsLine)}</div>
        </div>
      </div>
      <div class="buli-session-block">
        <div class="buli-session-block__title">按类型筛选</div>
        <div class="buli-session-filters">${prepared?.filtersMarkup || ""}</div>
      </div>
      <div class="buli-session-sections">${prepared?.sectionsMarkup || ""}</div>
      <div class="buli-session-footnote">
        支持搜索席位名、分身名、仪表盘编号，以及原始会话密钥。
      </div>
    </div>
  `;

  const panelCard = panel.querySelector(".buli-session-panel");
  if (panelCard) {
    panelCard.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    panelCard.addEventListener("wheel", (event) => {
      event.stopPropagation();
    }, { passive: true });
    panelCard.addEventListener("touchmove", (event) => {
      event.stopPropagation();
    }, { passive: true });
  }

  const sectionsEl = panel.querySelector(".buli-session-sections");
  const filtersEl = panel.querySelector(".buli-session-filters");

  if (sectionsEl) {
    sectionsEl.addEventListener("scroll", () => {
      getHostState(host).sectionsScrollTop = sectionsEl.scrollTop;
    }, { passive: true });
  }
  if (filtersEl) {
    filtersEl.addEventListener("scroll", () => {
      getHostState(host).filtersScrollLeft = filtersEl.scrollLeft;
    }, { passive: true });
  }

  const mountRow = host.__mountRow;
  const mountContent = host.__mountContent;
  const mountParent = mountContent || mountRow?.parentElement;
  if (!mountParent) {
    return;
  }
  const chatCard = mountContent?.querySelector(":scope > .card.chat");
  if (chatCard && chatCard.parentElement === mountParent) {
    mountParent.insertBefore(panel, chatCard);
  } else if (mountRow?.nextSibling && mountRow.parentElement === mountParent) {
    mountParent.insertBefore(panel, mountRow.nextSibling);
  } else {
    mountParent.appendChild(panel);
  }
  panel.__hostPicker = host;
  host.__panelEl = panel;

  requestAnimationFrame(() => {
    if (state.shouldFocusSearch) {
      const input = panel.querySelector(".buli-session-search__input");
      if (input) {
        input.focus();
        input.select();
      }
      state.shouldFocusSearch = false;
    }
    const activeEl = panel.querySelector(".buli-session-item.is-active");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
    if (sectionsEl && state.sectionsScrollTop > 0) {
      sectionsEl.scrollTop = state.sectionsScrollTop;
    }
    if (filtersEl && state.filtersScrollLeft > 0) {
      filtersEl.scrollLeft = state.filtersScrollLeft;
    }
  });
}

function bindHost(host, select) {
  host.__nativeSelect = select;
  host.__rendered = false;
  host.__selectSignature = "";
}

function enhanceSelect(select) {
  const container = select.closest(".chat-controls__session");
  const row = container?.parentElement;
  const content = container?.closest(".content.content--chat");
  if (!container || !row) {
    return;
  }
  container.classList.remove("chat-controls__session--has-picker");
  let host = row.querySelector(":scope > .buli-session-picker");
  if (!host) {
    host = document.createElement("div");
    host.className = "buli-session-picker";
    row.insertBefore(host, container.nextSibling);
    bindHost(host, select);
  } else {
    host.__nativeSelect = select;
  }
  host.__mountRow = row;
  host.__mountContent = content || null;
  select.classList.add("buli-session-native");
  const nextSignature = getSelectSignature(select);
  const state = getHostState(host);
  const needsRender =
    !host.__rendered ||
    host.__selectSignature !== nextSignature ||
    (state.open && !host.__panelEl?.isConnected);
  host.__selectSignature = nextSignature;
  if (needsRender) {
    renderHost(host, select);
    host.__rendered = true;
  }
}

function syncSessionPickers() {
  syncQueued = false;
  const hosts = Array.from(document.querySelectorAll(".buli-session-picker"));
  for (const host of hosts) {
    if (!(host.__nativeSelect instanceof HTMLSelectElement) || !host.__nativeSelect.isConnected) {
      removePanel(host);
      host.remove();
    }
  }
  const selects = Array.from(document.querySelectorAll(SESSION_SELECT_SELECTOR));
  for (const select of selects) {
    enhanceSelect(select);
  }
}

function requestSync() {
  if (syncQueued) {
    return;
  }
  syncQueued = true;
  requestAnimationFrame(syncSessionPickers);
}

function boot() {
  if (booted || window.__OPENCLAW_SESSION_ENHANCER__ === SESSION_ENHANCER_VERSION) {
    return;
  }
  booted = true;
  window.__OPENCLAW_SESSION_ENHANCER__ = SESSION_ENHANCER_VERSION;

  const observer = new MutationObserver((mutations) => {
    const hasRelevantMutation = mutations.some(
      (mutation) =>
        !(
          mutation.target instanceof Element &&
          mutation.target.closest(".buli-session-picker, .buli-session-inline-panel")
        ),
    );
    if (hasRelevantMutation) {
      requestSync();
    }
  });

  const startObserver = () => {
    if (!document.body) {
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    requestSync();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }

  document.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      if (target instanceof HTMLSelectElement && target.matches(SESSION_SELECT_SELECTOR)) {
        requestSync();
      }
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const trigger = target.closest(".buli-session-trigger");
      if (!trigger) {
        return;
      }
      const host = trigger.closest(".buli-session-picker");
      if (!host) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      toggleHostPicker(host);
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target;
      const host = getHostFromPanelTarget(target);
      if (!host) {
        return;
      }
      const actionNode = target.closest("[data-action]");
      if (!actionNode) {
        return;
      }
      if (handlePanelAction(host, actionNode)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      const host = getHostFromPanelTarget(target);
      if (!host) {
        return;
      }
      const input = target.closest(".buli-session-search__input");
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      if (handlePanelInput(host, input)) {
        event.stopPropagation();
      }
    },
    true,
  );

  document.addEventListener(
    "keydown",
    (event) => {
      const host = getHostFromPanelTarget(event.target);
      if (!host) {
        return;
      }
      if (handlePanelKeydown(host, event)) {
        event.stopPropagation();
      }
    },
    true,
  );

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".buli-session-picker, .buli-session-inline-panel")
      ) {
        return;
      }
      closeAllPickers();
    },
    true,
  );

  window.addEventListener("resize", () => closeAllPickers(), { passive: true });
}

boot();
