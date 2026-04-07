import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { preparePublicOpenClawHome } from "./setup-public-home.mjs";

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function hasAgentRoutingTarget(args) {
  return args.some((arg, index) => {
    if (arg === "--agent" || arg === "--to" || arg === "-t" || arg === "--session-id") {
      return index + 1 < args.length;
    }
    return arg.startsWith("--agent=") || arg.startsWith("--to=") || arg.startsWith("--session-id=");
  });
}

async function main() {
  const repoRoot = resolveRepoRoot();
  const forwardedArgs = process.argv.slice(2);

  if (forwardedArgs.length === 0) {
    process.stderr.write("Usage: node scripts/run-public.mjs <openclaw-subcommand> [...args]\n");
    process.exit(1);
  }

  let normalizedArgs = forwardedArgs.length > 1 && forwardedArgs[1] === "--"
    ? [forwardedArgs[0], ...forwardedArgs.slice(2)]
    : forwardedArgs;

  if (normalizedArgs[0] === "agent" && !hasAgentRoutingTarget(normalizedArgs.slice(1))) {
    normalizedArgs = ["agent", "--agent", "main", ...normalizedArgs.slice(1)];
  }

  const prepared = await preparePublicOpenClawHome({ quiet: true });
  const child = spawn(
    process.execPath,
    [path.join(repoRoot, "openclaw.mjs"), ...normalizedArgs],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        OPENCLAW_HOME: prepared.stateDir,
        OPENCLAW_STATE_DIR: prepared.stateDir,
        OPENCLAW_CONFIG_PATH: prepared.configPath,
        OPENCLAW_WORKSPACE: prepared.mainWorkspaceDir,
      },
    },
  );

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});