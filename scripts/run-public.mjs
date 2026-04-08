import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import http from "node:http";
import https from "node:https";
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

function isHelpLikeInvocation(args) {
  return args.includes("--help") || args.includes("-h") || args.includes("--version") || args.includes("-V");
}

function buildPublicEnv(prepared) {
  return {
    ...process.env,
    OPENCLAW_HOME: prepared.stateDir,
    OPENCLAW_STATE_DIR: prepared.stateDir,
    OPENCLAW_CONFIG_PATH: prepared.configPath,
    OPENCLAW_WORKSPACE: prepared.mainWorkspaceDir,
  };
}

async function readGatewayHttpUrl(configPath) {
  const raw = await fs.readFile(configPath, "utf8");
  const config = JSON.parse(raw);
  const port = Number(config?.gateway?.port) || 18789;
  const tlsEnabled = config?.gateway?.tls?.enabled === true;
  return `${tlsEnabled ? "https" : "http"}://127.0.0.1:${port}/`;
}

async function probeHttpUrl(url) {
  const client = url.startsWith("https:") ? https : http;
  return new Promise((resolve) => {
    const req = client.request(
      url,
      {
        method: "GET",
        timeout: 1500,
      },
      (res) => {
        res.resume();
        resolve((res.statusCode ?? 500) < 500);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

async function spawnPublicOpenClaw(repoRoot, args, env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, "openclaw.mjs"), ...args], {
      cwd: repoRoot,
      stdio: "inherit",
      env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`openclaw ${args.join(" ")} exited with signal ${signal}`));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

async function checkPublicGatewayHealth(repoRoot, env) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, "openclaw.mjs"), "gateway", "health"], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "ignore"],
      env,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(false);
        return;
      }
      resolve((code ?? 1) === 0);
    });
  });
}

async function startDetachedPublicGateway(repoRoot, env) {
  const child = spawn(process.execPath, [path.join(repoRoot, "openclaw.mjs"), "gateway", "run", "--force"], {
    cwd: repoRoot,
    stdio: "ignore",
    env,
    detached: true,
  });

  child.unref();
}

async function ensurePublicGatewayReady(repoRoot, prepared, env) {
  const healthUrl = await readGatewayHttpUrl(prepared.configPath);
  const httpHealthy = await probeHttpUrl(healthUrl);
  const gatewayHealthy = httpHealthy ? await checkPublicGatewayHealth(repoRoot, env) : false;
  if (httpHealthy && gatewayHealthy) {
    return;
  }

  await startDetachedPublicGateway(repoRoot, env);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await probeHttpUrl(healthUrl) && await checkPublicGatewayHealth(repoRoot, env)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`public gateway did not become reachable at ${healthUrl}`);
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
  if (normalizedArgs[0] === "gateway" && normalizedArgs.length === 1) {
    normalizedArgs = ["gateway", "run", "--force"];
  }

  const prepared = await preparePublicOpenClawHome({ quiet: true });
  const env = buildPublicEnv(prepared);

  if (normalizedArgs[0] === "dashboard" && !isHelpLikeInvocation(normalizedArgs.slice(1))) {
    await ensurePublicGatewayReady(repoRoot, prepared, env);
  }

  const child = spawn(process.execPath, [path.join(repoRoot, "openclaw.mjs"), ...normalizedArgs], {
    cwd: repoRoot,
    stdio: "inherit",
    env,
  });

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
