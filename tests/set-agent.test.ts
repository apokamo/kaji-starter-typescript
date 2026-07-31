import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import {
  applyAgentConfiguration,
  resolveAgentStep,
  transformWorkflowDocuments,
} from "../scripts/set-agent.ts";

const workflow = `name: sample
steps:
  - id: implement
    skill: issue-implement
    agent: claude
    model: opus
    effort: max
    on:
      PASS: end
  - id: close
    skill: issue-close
    agent: claude
    model: sonnet
    effort: medium
    on:
      PASS: end
`;

test.each([
  ["claude", "implement", "high", "opus", "high"],
  ["claude", "close", "medium", "sonnet", "medium"],
  ["codex", "implement", "max", "gpt-5.6-sol", "xhigh"],
  ["codex", "start", "low", "gpt-5.6-sol", "low"],
] as const)(
  "maps %s step %s to its model tier and valid effort",
  { tags: ["small"] },
  (target, stepId, effort, model, expectedEffort) => {
    expect(resolveAgentStep(target, stepId, effort)).toEqual({
      agent: target,
      model,
      effort: expectedEffort,
    });
  },
);

test("rejects an effort without a target fallback", { tags: ["small"] }, () => {
  expect(() => resolveAgentStep("claude", "implement", "minimal")).toThrow(
    /effort/i,
  );
});

test(
  "transforms all workflows to Codex and is idempotent",
  { tags: ["medium"] },
  () => {
    const once = transformWorkflowDocuments(
      new Map([["dev.yaml", workflow]]),
      "codex",
    );
    const twice = transformWorkflowDocuments(once, "codex");
    expect(once.get("dev.yaml")).toContain("agent: codex");
    expect(once.get("dev.yaml")).toContain("model: gpt-5.6-sol");
    expect(once.get("dev.yaml")).toContain("effort: xhigh");
    expect(once.get("dev.yaml")).toBe(
      workflow
        .replaceAll("agent: claude", "agent: codex")
        .replace("model: opus", "model: gpt-5.6-sol")
        .replace("model: sonnet", "model: gpt-5.6-sol")
        .replace("effort: max", "effort: xhigh"),
    );
    expect(twice).toEqual(once);
  },
);

test.each(["gemini", "antigravity", "other"])(
  "rejects unsupported targets before returning changes",
  { tags: ["medium"] },
  (target) => {
    expect(() =>
      transformWorkflowDocuments(
        new Map([
          ["dev.yaml", workflow],
          ["broken.yaml", "not: [valid"],
        ]),
        target,
      ),
    ).toThrow(/unsupported/i);
  },
);

test(
  "leaves every workflow unchanged when post-transform validation fails",
  { tags: ["medium"] },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "set-agent-"));
    const first = path.join(root, "first.yaml");
    const second = path.join(root, "second.yaml");
    await writeFile(first, workflow, "utf8");
    await writeFile(second, workflow.replace("implement", "review"), "utf8");
    const before = await Promise.all([
      readFile(first, "utf8"),
      readFile(second, "utf8"),
    ]);

    await expect(
      applyAgentConfiguration([first, second], "codex", () =>
        Promise.reject(new Error("workflow validation failed")),
      ),
    ).rejects.toThrow(/validation failed/i);

    await expect(
      Promise.all([readFile(first, "utf8"), readFile(second, "utf8")]),
    ).resolves.toEqual(before);
  },
);

test(
  "commits all validated workflow transformations and reports a no-op",
  { tags: ["medium"] },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), "set-agent-"));
    const first = path.join(root, "first.yaml");
    const second = path.join(root, "second.yaml");
    await writeFile(first, workflow, "utf8");
    await writeFile(second, workflow.replace("implement", "review"), "utf8");

    await expect(
      applyAgentConfiguration([first, second], "codex", () =>
        Promise.resolve(),
      ),
    ).resolves.toEqual({ changed: 2 });
    await expect(
      applyAgentConfiguration([first, second], "codex", () =>
        Promise.resolve(),
      ),
    ).resolves.toEqual({ changed: 0 });
  },
);
