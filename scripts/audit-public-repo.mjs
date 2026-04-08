import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const strictDist = process.argv.includes("--strict-dist");

const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".gitignore",
  ".html",
  ".js",
  ".json",
  ".json5",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".sh",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const FORBIDDEN_PATH_RULES = [
  { label: "runtime state directory", regex: /^\.openclaw-public\// },
  { label: "local env file", regex: /^\.env(\..+)?$/ },
  { label: "tracked auth profile", regex: /(^|\/)auth-profiles\.json$/ },
  { label: "tracked token cache", regex: /(^|\/).+\.token\.json$/ },
  { label: "tracked device auth file", regex: /(^|\/)device-auth\.json$/ },
  { label: "tracked pairing snapshot", regex: /(^|\/)(paired|pending)\.json$/ },
  { label: "tracked runtime credentials directory", regex: /(^|\/)credentials\// },
  { label: "tracked runtime log directory", regex: /(^|\/)logs\// },
  { label: "tracked session transcript", regex: /(^|\/)sessions\/.+\.jsonl$/ },
  { label: "tracked session index", regex: /(^|\/)sessions\/sessions\.json$/ },
  { label: "tracked mutable team state", regex: /(^|\/)team-task-store\.json$/ },
];

const CONTENT_RULES = [
  { label: "absolute local path", regex: /\/Users\/cling\//g },
  { label: "OpenAI-style key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { label: "Anthropic key", regex: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g },
  { label: "GitHub personal token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { label: "GitHub fine-grained token", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { label: "bearer token", regex: /Authorization:\s*Bearer\s+[A-Za-z0-9._=-]{20,}/g },
  {
    label: "private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----[\s\S]{40,}?-----END (?:RSA |EC |OPENSSH |DSA |)?PRIVATE KEY-----/g,
  },
];

const GOOGLE_PUBLIC_BUNDLED_KEY = [
  "AIzaSyD",
  "R5yfaG7OG8sMTUj8kfQEb8T9pN8BM6Lk",
].join("");

const ALLOWLIST_MATCHES = [
  {
    file: "dist/session-Db9ql_Z9.js",
    label: "Google API key",
    exact: GOOGLE_PUBLIC_BUNDLED_KEY,
    reason: "upstream bundled third-party public constant in precompiled dist",
  },
];

function isAllowlistedContentHit(file, label, matchText) {
  return ALLOWLIST_MATCHES.some((item) =>
    item.file === file &&
    item.label === label &&
    item.exact === matchText,
  );
}

function getRepoFiles() {
  const raw = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return Array.from(new Set(raw.split("\0").filter(Boolean))).sort();
}

function shouldScanContent(file) {
  if (file.startsWith("dist/") && !strictDist && !file.startsWith("dist/control-ui/")) {
    return false;
  }
  const basename = path.basename(file);
  const ext = path.extname(file).toLowerCase();
  if (basename === ".gitignore" || basename === "LICENSE") return true;
  return TEXT_EXTENSIONS.has(ext);
}

async function readTextIfSafe(file) {
  const absPath = path.join(repoRoot, file);
  const buffer = await fs.readFile(absPath);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

function makeExcerpt(text, index) {
  const start = Math.max(0, index - 32);
  const end = Math.min(text.length, index + 80);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

async function main() {
  const trackedFiles = getRepoFiles();
  const failures = [];
  let scannedFiles = 0;

  if (trackedFiles.length === 0) {
    process.stderr.write("Public repo audit failed: no repository files were discovered.\n");
    process.exit(1);
  }

  for (const file of trackedFiles) {
    for (const rule of FORBIDDEN_PATH_RULES) {
      if (rule.regex.test(file)) {
        failures.push({ file, reason: rule.label });
      }
    }
  }

  for (const file of trackedFiles) {
    if (!shouldScanContent(file)) continue;
    const text = await readTextIfSafe(file);
    if (!text) continue;
    scannedFiles += 1;
    for (const rule of CONTENT_RULES) {
      rule.regex.lastIndex = 0;
      let match;
      while ((match = rule.regex.exec(text)) !== null) {
        if (isAllowlistedContentHit(file, rule.label, match[0])) {
          continue;
        }
        failures.push({
          file,
          reason: rule.label,
          excerpt: makeExcerpt(text, match.index),
        });
      }
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`Public repo audit failed with ${failures.length} issue(s):\n`);
    for (const item of failures) {
      const detail = item.excerpt ? ` :: ${item.excerpt}` : "";
      process.stderr.write(`- ${item.file} :: ${item.reason}${detail}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `Public repo audit passed. tracked=${trackedFiles.length}, scanned=${scannedFiles}, strictDist=${strictDist}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
