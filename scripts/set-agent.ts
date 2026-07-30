import { readFile, readdir, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { isMap, isSeq, parseDocument } from "yaml";

type AgentTarget = "claude" | "codex";

const TARGETS = {
  claude: { agent: "claude", model: "claude-sonnet-4-6" },
  codex: { agent: "codex", model: "gpt-5.3-codex" },
} as const;

function assertTarget(target: string): asserts target is AgentTarget {
  if (!(target in TARGETS)) {
    throw new Error(
      `Unsupported agent target: ${target}. Expected claude or codex.`,
    );
  }
}

export function transformWorkflowDocuments(
  documents: ReadonlyMap<string, string>,
  target: string,
): Map<string, string> {
  assertTarget(target);
  const parsed = [...documents].map(([filename, source]) => {
    const document = parseDocument(source);
    if (document.errors.length > 0) {
      throw new Error(
        `Invalid workflow ${filename}: ${document.errors[0]?.message}`,
      );
    }
    return [filename, document] as const;
  });
  const transformed = new Map<string, string>();
  for (const [filename, document] of parsed) {
    const steps = document.get("steps");
    if (!isSeq(steps)) {
      throw new Error(`Invalid workflow ${filename}: steps must be a sequence`);
    }
    for (const step of steps.items) {
      if (isMap(step) && step.has("skill")) {
        step.set("agent", TARGETS[target].agent);
        step.set("model", TARGETS[target].model);
      }
    }
    transformed.set(filename, document.toString());
  }
  return transformed;
}

async function main(): Promise<void> {
  const target = process.argv[2] ?? "";
  assertTarget(target);
  const workflowRoot = path.resolve(".kaji/wf/custom");
  const entries = await readdir(workflowRoot, {
    recursive: true,
    withFileTypes: true,
  });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  const sources = new Map<string, string>(
    await Promise.all(
      filenames.map(
        async (filename) =>
          [filename, await readFile(filename, "utf8")] as const,
      ),
    ),
  );
  const transformed = transformWorkflowDocuments(sources, target);
  for (const [filename, source] of transformed) {
    const temporary = `${filename}.tmp-${process.pid}`;
    await writeFile(temporary, source, "utf8");
    await rename(temporary, filename);
  }
  process.stdout.write(`Agent configuration updated: ${target}\n`);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
