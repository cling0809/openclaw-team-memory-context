import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { preparePublicOpenClawHome } from "./setup-public-home.mjs";

function resolveRepoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

async function main() {
  const repoRoot = resolveRepoRoot();
  const forwardedArgs = process.argv.slice(2);

  if (forwardedArgs.length === 0) {
    process.stderr.write("Usage: node scripts/run-public.mjs <openclaw-subcommand> [...args]\n");
    process.exit(1);
  }

  const prepared = await preparePublicOpenClawHome({ quiet: true });
  const child = spawn(
    process.execPath,
    [path.join(repoRoot, "openclaw.mjs"), ...forwardedArgs],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        OPENCLAW_HOME: prepared.stateDir,
        OPENCLAW_STATE_DIR: prepared.stateDir,
        OPENCLAW_CONFIG_PATH: prepared.configPath,
        OPENCLAW_WORKSPACE: prepared.workspaceDir,
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