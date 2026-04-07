import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

  const templateRaw = await fs.readFile(templatePath, "utf8");
  const template = JSON.parse(templateRaw);
  const rendered = replacePlaceholders(template, {
    "__REPO_ROOT__": repoRoot,
    "__WORKSPACE_DIR__": workspaceDir,
    "__STATE_DIR__": stateDir,
  });

  const configExists = await pathExists(configPath);
  if (!configExists || options.force) {
    await fs.writeFile(configPath, `${JSON.stringify(rendered, null, 2)}\n`, "utf8");
  }

  return {
    repoRoot,
    stateDir,
    workspaceDir,
    configPath,
    createdConfig: !configExists || options.force,
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
      `configPath: ${result.configPath}`,
      result.createdConfig ? "config: written" : "config: kept existing",
      "",
      "Next steps:",
      "  pnpm public:onboard",
      "  pnpm public:gateway",
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