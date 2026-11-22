// Safety check before pushing to GitHub. Run: npm run check
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const git = (args) => spawnSync("git", args, { encoding: "utf8" });
let bad = 0;
const fail = (msg) => { bad++; console.log("BLOCK  " + msg); };

// 1. Secret patterns in files git would commit (respects .gitignore, works before `git init`)
const SECRETS = "sk-or-v1-[A-Za-z0-9]{16,}|supabase\\.co|postgres\\.[a-z0-9]{20}|service_role|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{10,}\\.eyJ";
let r = git(["grep", "--no-index", "--exclude-standard", "-nIE", "-e", SECRETS, "--", ".", ":(exclude)scripts/check.mjs"]);
if (r.status === 0) r.stdout.trim().split("\n").forEach((l) => fail("secret pattern: " + l.replace(/(sk-or-v1-.{4}).*/, "$1...")));

// 2. Database URLs that contain a password (dev placeholders on localhost are allowed)
const DBURL = "://[^ :/@\"']+:[^ @\"']+@";
r = git(["grep", "--no-index", "--exclude-standard", "-nIE", "-e", DBURL, "--", ".", ":(exclude).env.example", ":(exclude)docs"]);
if (r.status === 0) r.stdout.trim().split("\n").filter((l) => !/@localhost|@127\.0\.0\.1|user:pass@host/.test(l)).forEach((l) => fail("database URL with password: " + l.split(":").slice(0, 2).join(":")));

// 3. .gitignore must contain the important lines
const gi = existsSync(".gitignore") ? readFileSync(".gitignore", "utf8").split(/\r?\n/).map((s) => s.trim()) : [];
for (const need of [".env", ".env.*", "*.sql", "*.dump", "node_modules/", ".venv/"]) if (!gi.includes(need)) fail(".gitignore is missing the line: " + need);

// 4. Private files that git would commit or already tracks (needs `git init` first)
if (git(["rev-parse", "--git-dir"]).status === 0) {
  const names = ["*.env", "*.env.*", "*.pem", "*.key", "*.sql", "*.dump", "*.db", "*.bak"];
  const listed = git(["ls-files", "--cached", "--others", "--exclude-standard", "--", ...names]).stdout.split("\n").filter(Boolean);
  listed.filter((f) => !f.endsWith(".env.example")).forEach((f) => fail("private file would be committed: " + f));
  const hist = git(["log", "--all", "--oneline", "-G", "sk-or-v1-[A-Za-z0-9]{16,}"]);
  if (hist.status === 0 && hist.stdout.trim()) fail("an OpenRouter key exists in git history (commits: " + hist.stdout.trim().split("\n").map((l) => l.split(" ")[0]).join(", ") + ")");
} else console.log("note   no git repo yet: file-name and history checks are skipped. Run `npm run check` again after `git init`.");

console.log(bad ? `\n❌ ${bad} problem(s). Do NOT commit or push. Fix them, then run npm run check again.` : "\n✅ No secrets, password URLs or private files found.");
process.exit(bad ? 1 : 0);
