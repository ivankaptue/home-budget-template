// `npm run share -- <empty-dir>`: writes a copy of the last commit without personal files, for someone who
// installs the app on their own Firebase project. Fails if a value from .env (emails, Firebase ids, names
// listed in SHARE_FORBIDDEN) is still found in the copy.
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { loadEnv } from "./env";
import { findLeaks, forbiddenTerms } from "./leaks";

// Owner-only files: personal notes, design docs with real amounts, assistant instructions, release history.
const EXCLUDED = ["Budget.md", "docs/superpowers", ".claude", "CHANGELOG.md"];

const dest = process.argv[2];
if (!dest) throw new Error("usage: npm run share -- <empty-dir>");
if (existsSync(dest) && readdirSync(dest).length > 0) throw new Error(`${dest} is not empty`);
mkdirSync(dest, { recursive: true });

execSync(`git archive --format=tar HEAD | tar -x -C ${JSON.stringify(dest)}`, { stdio: "inherit" });
for (const path of EXCLUDED) rmSync(join(dest, path), { recursive: true, force: true });
const docs = join(dest, "docs");
if (existsSync(docs) && readdirSync(docs).length === 0) rmSync(docs, { recursive: true });
writeFileSync(join(dest, "CHANGELOG.md"), `# Changelog\n\nBased on Carnet Budget Maison ${pkg.version}.\n\n## [Unreleased]\n`);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const files = [...walk(dest)]
  .map((path) => ({ path: relative(dest, path), buf: readFileSync(path) }))
  .filter(({ buf }) => !buf.includes(0)) // skip binaries (icons)
  .map(({ path, buf }) => ({ path, text: buf.toString("utf8") }));

loadEnv();
const terms = forbiddenTerms(process.env);
if (terms.length === 0) throw new Error("nothing to check the copy against: fill in .env first (see .env.example)");
const leaks = findLeaks(files, terms);
if (leaks.length > 0) {
  for (const { path, term } of leaks) console.error(`✗ ${path}: contains "${term}"`);
  console.error(`\n${leaks.length} leak(s): fix them (or exclude the file in scripts/share.ts), then run again.`);
  process.exit(1);
}
console.log(`✓ ${files.length} text files checked, nothing personal found → ${dest}`);
console.log("Last commit only: commit your changes first. Next: cd into it, git init, commit, push to the shared repo.");
