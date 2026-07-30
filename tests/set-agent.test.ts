import { expect, test } from "vitest";

import { transformWorkflowDocuments } from "../scripts/set-agent.ts";

const workflow = `name: sample
steps:
  - id: implement
    skill: issue-implement
    agent: claude
    model: claude-sonnet-4-6
    effort: high
    on:
      PASS: end
`;

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
    expect(once.get("dev.yaml")).toContain("model: gpt-5.3-codex");
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
