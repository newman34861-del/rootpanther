import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "public", "fonts"]);
const EXT = /\.(tsx?|css|md|html)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXT.test(name)) out.push(p);
  }
  return out;
}

const BANNED_WORDS = /\b(seamless(ly)?|effortless(ly)?|unlock(s|ed|ing)?|empower(s|ed|ing)?|elevate(s|d)?|supercharg(e|ed|es|ing))\b/i;

const RULE_DOCS = /(README|CONVENTIONS)\.md$/;

const rules = [
  { id: "em-or-en-dash", test: (line) => /[\u2013\u2014]/.test(line), all: true },
  { id: "hardcoded-hex", test: (line, f) => !f.endsWith("theme.css") && (f.endsWith(".css") ? /#[0-9a-fA-F]{3,8}\b/.test(line) : /\.(tsx?|html)$/.test(f) && /["'`(:\s]#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?["'`;)\s]/.test(line)) },
  { id: "hardcoded-rgb", test: (line, f) => !f.endsWith("theme.css") && !f.endsWith(".md") && /\b(rgba?|hsla?)\(/.test(line) },
  { id: "named-colour", test: (line, f) => f.endsWith(".css") && !f.endsWith("theme.css") && /:\s*[^;]*\b(white|black|red|blue|green|orange|gray|grey|yellow)\b/.test(line) && !/font-|content:|grid-|transition|animation|text-align/.test(line) },
  { id: "pill-radius", test: (line) => /border-radius:\s*(9{2,}px|[2-9]\d{2,}px|100px|\d+em)/.test(line) },
  { id: "radius-literal", test: (line, f) => f.endsWith(".css") && /border-radius:\s*\d+(\.\d+)?px/.test(line) },
  { id: "glow", test: (line) => /box-shadow:\s*0\s+0\s+[1-9]/.test(line) || /\btext-shadow\s*:/.test(line) || /drop-shadow\(/.test(line) || /@keyframes\s+\w*(pulse|glow|shine)/i.test(line) },
  { id: "banned-copy", test: (line, f) => /\.(tsx?|md|html)$/.test(f) && !RULE_DOCS.test(f) && BANNED_WORDS.test(line.replace(/bg-elevated/g, "")) },
  { id: "exclamation-copy", test: (line, f) => /\.tsx$/.test(f) && (/>[^<{}]*[A-Za-z]![^=<]*</.test(line) || /"[A-Z][^"]*[a-z]!"/.test(line)) },
  { id: "commented-out-code", test: (line, f) => /\.(tsx?)$/.test(f) && /^\s*\/\/\s*(const|let|import|return|export|if|<)\b/.test(line) },
  { id: "todo-noise", test: (line, f) => !RULE_DOCS.test(f) && /\b(TODO|FIXME|XXX)\b/.test(line) },
];

const files = walk(root);
let failures = 0;
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const r of rules) {
      if (r.test(line, f)) {
        failures++;
        console.log(`${relative(root, f)}:${i + 1}  [${r.id}]  ${line.trim().slice(0, 140)}`);
      }
    }
  });
}

if (failures) {
  console.log(`\n${failures} rule violation${failures === 1 ? "" : "s"}.`);
  process.exit(1);
}
console.log(`check-rules: ${files.length} files clean.`);
