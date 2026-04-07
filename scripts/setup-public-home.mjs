import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMON_SOUL = `# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip filler and help directly.

**Have opinions.** Make concrete tradeoffs instead of bland neutrality.

**Be resourceful before asking.** Read files, inspect context, and verify state before escalating.

**Earn trust through competence.** Be careful with external actions and bold with internal investigation.

**Remember you're a guest.** Respect private data and treat the environment as borrowed trust.

## Boundaries

- Private things stay private.
- Ask before acting externally.
- Never send half-baked replies to messaging surfaces.
- Do not pretend to know what you have not verified.

## Vibe

Concise when needed, thorough when it matters, never robotic.
`;

const COMMON_USER = `# USER.md - 项目维护者

- **Name:** 项目维护者
- **What to call them:** 维护者
- **Timezone:** Asia/Shanghai
- **Notes:**
  - 中文优先
  - 喜欢直接做事，不喜欢空话
  - 希望智能体会分工、会用工具、会给可执行结果
  - 同时关注代码、研究、前端和验证质量

## Context

- 用 OpenClaw CLI / Control UI
- 更喜欢“先做，再汇报”的工作节奏
- 期待多智能体协作，但不接受空转、虚构和低质量输出
`;

const COMMON_BOOTSTRAP = `# BOOTSTRAP.md - Public Workspace Bootstrap

这个工作区已经预置了角色身份和协作规则，不需要重新做自我介绍。

开工顺序：

1. 读 AGENTS.md
2. 读 IDENTITY.md
3. 读 SOUL.md
4. 读 USER.md
5. 再开始处理当前任务
`;

const COMMON_HEARTBEAT = `# HEARTBEAT.md

- 中文优先
- 先做再汇报
- 不泄漏私密数据
`;

const COMMON_MEMORY = `# MEMORY.md

- 记录长期稳定的协作偏好和约束
- 记录已验证有效的工作方式
- 不记录对话原文、日志或凭据
`;

const ROLE_WORKSPACE_SPECS = {
  main: {
    emoji: "⚔️",
    name: "不良帅·李星云（天暗星）",
    shortName: "不良帅·李星云",
    vibe: "总控调度·不良帅",
    title: "主控统筹席",
    duty: "负责拆解目标、分派子智能体、汇总结果和做最终决策。",
    workflow: [
      "先拆目标，再决定是否派工",
      "优先让最合适的角色处理最合适的问题",
      "最终回答前统一收口，避免多头结论",
    ],
    handoff: [
      "代码实现交给 coder",
      "快修补位交给 code-assist",
      "资料调查交给 research",
      "界面打磨交给 frontend",
      "验证回归交给 qa",
      "风险把关交给 reviewer",
    ],
    tools: ["team-router", "memory-keeper", "logic-rigour"],
  },
  coder: {
    emoji: "🛡️",
    name: "天祐星·石瑶",
    shortName: "天祐星·石瑶",
    vibe: "稳健的工程实现者",
    title: "代码实现席",
    duty: "负责代码实现、重构、调试、后端逻辑和工程落地。",
    workflow: [
      "先看懂代码再改，优先最小正确改动",
      "有 bug 先复现再修",
      "改完优先给验证结果和剩余风险",
    ],
    handoff: [
      "资料搜集交给 research",
      "视觉和交互决策交给 frontend",
      "回归验证交给 qa",
      "独立风险审查交给 reviewer",
    ],
    tools: ["repo-dive", "bug-hunt", "backend-brain", "test-forge"],
  },
  "code-assist": {
    emoji: "⚡",
    name: "天速星·段成天",
    shortName: "天速星·段成天",
    vibe: "快速补位、读改并行的代码助手",
    title: "快速支援席",
    duty: "负责快修、小范围补丁、文件定位和并行代码辅助。",
    workflow: [
      "优先快速确认问题边界",
      "适合处理补丁、补线、脚手架和小修正",
      "输出以可直接合并的结果为主",
    ],
    handoff: [
      "复杂系统设计交给 coder",
      "大块资料调研交给 research",
      "完整回归交给 qa",
    ],
    tools: ["repo-dive", "shell-safe", "test-forge"],
  },
  research: {
    emoji: "📜",
    name: "天慧星·慧明",
    shortName: "天慧星·慧明",
    vibe: "中文优先的资料分析师",
    title: "资料研究席",
    duty: "负责查资料、比来源、做综述、整理报告和知识卡片。",
    workflow: [
      "中文资料优先，先核时间、核来源、核口径",
      "对比多个来源，而不是只摘一条",
      "结论先行，再给依据和风险",
    ],
    handoff: [
      "需要代码落地时交给 coder",
      "需要前端呈现时交给 frontend",
      "需要逻辑核验时可叫 reviewer",
    ],
    tools: ["china-research", "doc-curator", "evidence-first"],
  },
  frontend: {
    emoji: "🎨",
    name: "天巧星·上官云阙",
    shortName: "天巧星·上官云阙",
    vibe: "懂设计也能落代码的界面打磨者",
    title: "界面设计席",
    duty: "负责页面实现、布局、视觉层级、响应式和最后一公里 polish。",
    workflow: [
      "先理解现有设计语言，再决定延续还是突破",
      "兼顾桌面和移动端，不做模板味前端",
      "优先交付像成品的界面，不只追求能用",
    ],
    handoff: [
      "复杂业务逻辑交给 coder",
      "资料内容交给 research",
      "回归验证交给 qa",
    ],
    tools: ["frontend-taste", "ui-critic", "playwright"],
  },
  qa: {
    emoji: "🧪",
    name: "天损星·陆佑劫",
    shortName: "天损星·陆佑劫",
    vibe: "喜欢复现问题和守住回归线的验证者",
    title: "验证回归席",
    duty: "负责复现问题、设计验证、补测试、做回归和边界检查。",
    workflow: [
      "优先复现问题，再讨论原因",
      "明确区分已验证、未验证和待确认",
      "高风险路径优先，不靠堆测试数量",
    ],
    handoff: [
      "需要修代码时交给 coder",
      "需要 UI 调整时交给 frontend",
      "需要独立风险审查时交给 reviewer",
    ],
    tools: ["bug-hunt", "test-forge", "evidence-first", "playwright"],
  },
  reviewer: {
    emoji: "👁️",
    name: "天罪星·镜心魔",
    shortName: "天罪星·镜心魔",
    vibe: "专挑风险和漏洞的把关者",
    title: "风险审查席",
    duty: "负责代码审查、风险检查、缺失测试分析和上线前把关。",
    workflow: [
      "findings 优先，赞美和总结放后",
      "重点找 bug、回归、脆弱点和缺失测试",
      "对高风险点给出最小修复建议",
    ],
    handoff: [
      "真正修代码时交给 coder",
      "专项验证交给 qa",
      "外部事实核对可叫 research",
    ],
    tools: ["code-review-hard", "release-guard", "evidence-first"],
  },
};

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function parseArgs(argv) {
  const args = { force: false, quiet: false, stateDir: undefined, configPath: undefined, workspaceDir: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--force") {
      args.force = true;
      continue;
    }
    if (value === "--quiet") {
      args.quiet = true;
      continue;
    }
    if (value === "--state-dir") {
      args.stateDir = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--config-path") {
      args.configPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (value === "--workspace-dir") {
      args.workspaceDir = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function replacePlaceholders(node, replacements) {
  if (typeof node === "string") {
    let result = node;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.split(key).join(value);
    }
    return result;
  }
  if (Array.isArray(node)) {
    return node.map((item) => replacePlaceholders(item, replacements));
  }
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, replacePlaceholders(value, replacements)]),
    );
  }
  return node;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createGatewayToken() {
  return randomBytes(24).toString("hex");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildRoleAgentGuide(role, spec) {
  return `# AGENTS.md - ${spec.shortName}

你是${spec.shortName}，${spec.duty}

## 每次开工前

1. 读 SOUL.md
2. 读 USER.md
3. 读 MEMORY.md
4. 再进入当前任务

## 默认工作方式

${spec.workflow.map((line) => `- ${line}`).join("\n")}

## 协作边界

${spec.handoff.map((line) => `- ${line}`).join("\n")}

## 交付标准

- 先给能执行的结果，再补说明
- 明确告诉维护者改了什么、怎么验证、还有什么风险
- 没跑过的验证明确说明没跑

## 安全

- 不外传隐私数据
- 不做破坏性操作，除非得到明确授权
- 不把猜测当结论
`;
}

function buildRoleIdentity(spec) {
  return `# IDENTITY.md - ${spec.shortName}

- **Name:** ${spec.shortName}
- **Creature:** 不良人天罡席位
- **Vibe:** ${spec.vibe}
- **Emoji:** ${spec.emoji}
- **Role:** ${spec.title}
`;
}

function buildRoleTools(spec) {
  return `# TOOLS.md - ${spec.shortName}

推荐优先工作模式：

${spec.tools.map((tool) => `- ${tool}`).join("\n")}
`;
}

function buildRoleFiles(role, spec) {
  return {
    "AGENTS.md": buildRoleAgentGuide(role, spec),
    "IDENTITY.md": buildRoleIdentity(spec),
    "SOUL.md": COMMON_SOUL,
    "USER.md": COMMON_USER,
    "BOOTSTRAP.md": COMMON_BOOTSTRAP,
    "HEARTBEAT.md": COMMON_HEARTBEAT,
    "MEMORY.md": COMMON_MEMORY,
    "TOOLS.md": buildRoleTools(spec),
  };
}

async function writeTextFile(targetPath, content, force) {
  if (force || !(await pathExists(targetPath))) {
    await fs.writeFile(targetPath, `${content.trimEnd()}\n`, "utf8");
  }
}

async function ensureAgentWorkspaces(stateDir, sharedWorkspaceDir, force) {
  const rootDir = path.join(stateDir, "agent-workspaces");
  await fs.mkdir(rootDir, { recursive: true });

  const roleDirs = {};
  for (const [role, spec] of Object.entries(ROLE_WORKSPACE_SPECS)) {
    const roleDir = path.join(rootDir, role);
    roleDirs[role] = roleDir;
    await fs.mkdir(roleDir, { recursive: true });

    const files = buildRoleFiles(role, spec);
    for (const [name, content] of Object.entries(files)) {
      await writeTextFile(path.join(roleDir, name), content, force);
    }

    const roleWorkspaceDir = path.join(roleDir, "workspace");
    if (force && (await pathExists(roleWorkspaceDir))) {
      await fs.rm(roleWorkspaceDir, { recursive: true, force: true });
    }
    if (!(await pathExists(roleWorkspaceDir))) {
      await fs.cp(sharedWorkspaceDir, roleWorkspaceDir, { recursive: true });
    }
  }

  return { rootDir, roleDirs };
}

function mergeAgentLists(existingList, defaultList) {
  if (!Array.isArray(existingList) || existingList.length === 0) {
    return cloneJson(defaultList);
  }

  const merged = cloneJson(existingList);
  const byId = new Map(merged.map((entry, index) => [entry?.id, index]));
  for (const entry of defaultList) {
    const index = byId.get(entry.id);
    if (index == null) {
      merged.push(cloneJson(entry));
      continue;
    }
    merged[index] = mergeMissingDefaults(merged[index], entry);
  }
  return merged;
}

function mergeMissingDefaults(existing, defaults) {
  if (existing == null) {
    return cloneJson(defaults);
  }
  if (Array.isArray(defaults)) {
    return Array.isArray(existing) ? cloneJson(existing) : cloneJson(defaults);
  }
  if (typeof defaults !== "object" || defaults === null) {
    return existing;
  }
  if (typeof existing !== "object" || existing === null || Array.isArray(existing)) {
    return cloneJson(defaults);
  }

  const result = cloneJson(existing);
  for (const [key, value] of Object.entries(defaults)) {
    if (key === "list" && Array.isArray(value) && Array.isArray(existing[key])) {
      result[key] = mergeAgentLists(existing[key], value);
      continue;
    }
    if (!(key in existing)) {
      result[key] = cloneJson(value);
      continue;
    }
    result[key] = mergeMissingDefaults(existing[key], value);
  }
  return result;
}

function ensurePublicGatewayDefaults(config, fallbackToken) {
  const next = cloneJson(config);
  const gateway = next.gateway && typeof next.gateway === "object" && !Array.isArray(next.gateway) ? next.gateway : {};
  next.gateway = gateway;

  if (gateway.mode == null) {
    gateway.mode = "local";
  }
  if (gateway.bind == null) {
    gateway.bind = "loopback";
  }
  if (gateway.port == null) {
    gateway.port = 18789;
  }

  const auth = gateway.auth && typeof gateway.auth === "object" && !Array.isArray(gateway.auth) ? gateway.auth : {};
  gateway.auth = auth;

  const hasToken = typeof auth.token === "string" && auth.token.trim().length > 0;
  const hasPassword = typeof auth.password === "string" && auth.password.trim().length > 0;

  if (auth.mode == null) {
    if (hasToken && !hasPassword) {
      auth.mode = "token";
    } else if (hasPassword && !hasToken) {
      auth.mode = "password";
    } else if (!hasToken && !hasPassword) {
      auth.mode = "token";
    }
  }

  if (auth.mode === "token" && !hasToken) {
    auth.token = fallbackToken;
  }

  return next;
}

function ensurePublicConfigDefaults(config, defaults, fallbackToken) {
  return ensurePublicGatewayDefaults(mergeMissingDefaults(config, defaults), fallbackToken);
}

export async function preparePublicOpenClawHome(options = {}) {
  const repoRoot = resolveRepoRoot();
  const stateDir = path.resolve(options.stateDir || path.join(repoRoot, ".openclaw-public"));
  const workspaceDir = path.resolve(options.workspaceDir || path.join(repoRoot, "workspace"));
  const configPath = path.resolve(options.configPath || path.join(stateDir, "openclaw.json"));
  const templatePath = path.join(repoRoot, "templates", "openclaw.public.template.json");

  await fs.mkdir(stateDir, { recursive: true });
  await fs.mkdir(path.join(stateDir, "state"), { recursive: true });
  await fs.mkdir(path.join(stateDir, "logs"), { recursive: true });
  await fs.mkdir(path.join(stateDir, "teams"), { recursive: true });
  const agentWorkspaces = await ensureAgentWorkspaces(stateDir, workspaceDir, options.force);

  const templateRaw = await fs.readFile(templatePath, "utf8");
  const template = JSON.parse(templateRaw);
  const generatedGatewayToken = createGatewayToken();
  const rendered = ensurePublicGatewayDefaults(
    replacePlaceholders(template, {
    "__REPO_ROOT__": repoRoot,
    "__WORKSPACE_DIR__": workspaceDir,
    "__AGENT_WORKSPACE_ROOT_DIR__": agentWorkspaces.rootDir,
    "__AGENT_WORKSPACE_MAIN_DIR__": agentWorkspaces.roleDirs.main,
    "__AGENT_WORKSPACE_CODER_DIR__": agentWorkspaces.roleDirs.coder,
    "__AGENT_WORKSPACE_CODE_ASSIST_DIR__": agentWorkspaces.roleDirs["code-assist"],
    "__AGENT_WORKSPACE_RESEARCH_DIR__": agentWorkspaces.roleDirs.research,
    "__AGENT_WORKSPACE_FRONTEND_DIR__": agentWorkspaces.roleDirs.frontend,
    "__AGENT_WORKSPACE_QA_DIR__": agentWorkspaces.roleDirs.qa,
    "__AGENT_WORKSPACE_REVIEWER_DIR__": agentWorkspaces.roleDirs.reviewer,
    "__STATE_DIR__": stateDir,
      "__GATEWAY_TOKEN__": generatedGatewayToken,
    }),
    generatedGatewayToken,
  );

  const configExists = await pathExists(configPath);
  let updatedConfig = false;
  if (!configExists || options.force) {
    await fs.writeFile(configPath, `${JSON.stringify(rendered, null, 2)}\n`, "utf8");
  } else {
    const existingRaw = await fs.readFile(configPath, "utf8");
    const existing = JSON.parse(existingRaw);
    const ensured = ensurePublicConfigDefaults(existing, rendered, generatedGatewayToken);
    const nextRaw = `${JSON.stringify(ensured, null, 2)}\n`;
    if (nextRaw !== existingRaw) {
      await fs.writeFile(configPath, nextRaw, "utf8");
      updatedConfig = true;
    }
  }

  return {
    repoRoot,
    stateDir,
    workspaceDir,
    mainWorkspaceDir: agentWorkspaces.roleDirs.main,
    agentWorkspaceRootDir: agentWorkspaces.rootDir,
    configPath,
    createdConfig: !configExists || options.force,
    updatedConfig,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await preparePublicOpenClawHome(options);
  if (options.quiet) return;

  process.stdout.write(
    [
      "Prepared public OpenClaw home.",
      `repoRoot: ${result.repoRoot}`,
      `stateDir: ${result.stateDir}`,
      `workspaceDir: ${result.workspaceDir}`,
      `agentWorkspaceRootDir: ${result.agentWorkspaceRootDir}`,
      `configPath: ${result.configPath}`,
      result.createdConfig ? "config: written" : result.updatedConfig ? "config: updated missing public defaults" : "config: kept existing",
      "",
      "Next steps:",
      "  pnpm public:onboard",
      "  pnpm public:gateway",
      "  pnpm public:dashboard -- --no-open",
      "  pnpm public:refresh   # rewrite local public config from latest template",
    ].join("\n"),
  );
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exit(1);
  });
}