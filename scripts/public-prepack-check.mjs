import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_FILES = [
  "package.json",
  "README.md",
  "LICENSE",
  "openclaw.mjs",
  "oc-web.mjs",
  "dist/index.js",
  "dist/control-ui/index.html",
  "scripts/run-public.mjs",
  "scripts/setup-public-home.mjs",
  "scripts/audit-public-repo.mjs",
];

async function exists(relPath) {
  try {
    await fs.access(path.join(repoRoot, relPath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const missing = [];
  for (const relPath of REQUIRED_FILES) {
    if (!(await exists(relPath))) missing.push(relPath);
  }
  if (missing.length > 0) {
    process.stderr.write(`Public prepack check failed. Missing files:\n- ${missing.join("\n- ")}\n`);
    process.exit(1);
  }
  process.stdout.write(`Public prepack check passed. verified=${REQUIRED_FILES.length}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
