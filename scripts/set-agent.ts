import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

import { isMap, isSeq, parseDocument } from "yaml";

type AgentTarget = "claude" | "codex";

const TARGETS = {
  claude: { agent: "claude", model: "claude-sonnet-4-6" },
  codex: { agent: "codex", model: "gpt-5.6-sol" },
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
    const skillStepCount = steps.items.filter(
      (step) => isMap(step) && step.has("skill"),
    ).length;
    const source = documents.get(filename) ?? "";
    const agentLineCount = [...source.matchAll(/^\s+agent:\s*.*$/gm)].length;
    const modelLineCount = [...source.matchAll(/^\s+model:\s*.*$/gm)].length;
    if (
      agentLineCount !== skillStepCount ||
      modelLineCount !== skillStepCount
    ) {
      throw new Error(
        `Invalid workflow ${filename}: every skill step must have one agent and model field`,
      );
    }
    transformed.set(
      filename,
      source
        .replace(/^(\s+agent:\s*).*$/gm, `$1${TARGETS[target].agent}`)
        .replace(/^(\s+model:\s*).*$/gm, `$1${TARGETS[target].model}`),
    );
  }
  return transformed;
}

type ValidateWorkflows = (filenames: readonly string[]) => Promise<void>;

async function validateWorkflowFiles(
  filenames: readonly string[],
): Promise<void> {
  const repositoryRoot = path.resolve(".");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      path.join(repositoryRoot, "scripts/kaji"),
      ["validate", "--project-root", repositoryRoot, ...filenames],
      {
        cwd: repositoryRoot,
        stdio: "inherit",
        env: { ...process.env, UV_OFFLINE: "1" },
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Workflow validation failed with exit code ${code}`));
      }
    });
  });
}

export async function applyAgentConfiguration(
  filenames: readonly string[],
  target: string,
  validate: ValidateWorkflows = validateWorkflowFiles,
): Promise<{ changed: number }> {
  const sources = new Map<string, string>(
    await Promise.all(
      filenames.map(
        async (filename) =>
          [filename, await readFile(filename, "utf8")] as const,
      ),
    ),
  );
  const transformed = transformWorkflowDocuments(sources, target);
  const changed = [...transformed].filter(
    ([filename, source]) => sources.get(filename) !== source,
  );
  if (changed.length === 0) {
    return { changed: 0 };
  }
  const temporaryFiles = new Map<string, string>();
  try {
    for (const [filename, source] of changed) {
      const temporary = `${filename}.tmp-${process.pid}.yaml`;
      await writeFile(temporary, source, "utf8");
      temporaryFiles.set(filename, temporary);
    }
    await validate([...temporaryFiles.values()]);
    const committed: string[] = [];
    try {
      for (const [filename, temporary] of temporaryFiles) {
        await rename(temporary, filename);
        committed.push(filename);
      }
    } catch (error) {
      await Promise.all(
        committed.map((filename) =>
          writeFile(filename, sources.get(filename) ?? "", "utf8"),
        ),
      );
      throw error;
    }
  } finally {
    await Promise.all(
      [...temporaryFiles.values()].map((filename) =>
        rm(filename, { force: true }),
      ),
    );
  }
  return { changed: changed.length };
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
  const result = await applyAgentConfiguration(filenames, target);
  process.stdout.write(
    result.changed === 0
      ? `Agent configuration already selected: ${target}\n`
      : `Agent configuration updated: ${target} (${result.changed} workflows)\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
