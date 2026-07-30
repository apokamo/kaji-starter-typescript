import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const roots = ["README.md", "README.ja.md", "AGENTS.md", "CLAUDE.md", "docs"];
const files: string[] = [];
for (const root of roots) {
  if (!existsSync(root)) {
    throw new Error(`Required documentation path is missing: ${root}`);
  }
}
async function collect(current: string): Promise<void> {
  const stat = await import("node:fs/promises").then(({ stat }) =>
    stat(current),
  );
  if (stat.isFile()) {
    if (current.endsWith(".md")) files.push(current);
    return;
  }
  for (const entry of await readdir(current)) {
    await collect(path.join(current, entry));
  }
}
for (const root of roots) await collect(root);
const failures: string[] = [];
for (const filename of files) {
  const text = readFileSync(filename, "utf8");
  for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (
      target === undefined ||
      target.startsWith("http") ||
      target.startsWith("#") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }
    const local = target.split("#", 1)[0];
    if (
      local !== undefined &&
      !existsSync(path.resolve(path.dirname(filename), local))
    ) {
      failures.push(`${filename}: broken link ${target}`);
    }
  }
}
if (failures.length > 0) throw new Error(failures.join("\n"));
process.stdout.write(`Documentation links valid (${files.length} files)\n`);
