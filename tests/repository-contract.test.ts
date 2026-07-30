import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

import {
  verifyConsumerText,
  verifySkillMetadata,
  verifyTemplateIdentity,
} from "../scripts/verify-static.ts";

test(
  "ignores kaji runtime state created by lifecycle commands",
  { tags: ["small"] },
  () => {
    const ignoredPaths = new Set(
      readFileSync(".gitignore", "utf8")
        .split("\n")
        .filter((line) => line.length > 0),
    );

    expect(ignoredPaths.has(".kaji/counters/")).toBe(true);
    expect(ignoredPaths.has(".serena/")).toBe(true);
  },
);

test(
  "accepts matching template identity and skill metadata",
  { tags: ["medium"] },
  () => {
    expect(() =>
      verifyTemplateIdentity("starter-app", "apokamo/starter-app"),
    ).not.toThrow();
    expect(() =>
      verifySkillMetadata(
        "issue-start",
        "---\nname: issue-start\ndescription: Start an issue\n---\n",
      ),
    ).not.toThrow();
  },
);

test.each([
  ["README.md", "Run .kaji/wf/official/dev.yaml", /official/i],
  ["SKILL.md", "status: known_failures", /known_failures/i],
  ["SKILL.md", "Run pytest after implementation", /pytest/i],
])(
  "rejects stale Python or official-workflow consumer contracts",
  { tags: ["medium"] },
  (filename, text, expected) => {
    expect(() => verifyConsumerText(filename, text)).toThrow(expected);
  },
);

test(
  "rejects partial template customization and mismatched skill names",
  { tags: ["medium"] },
  () => {
    expect(() =>
      verifyTemplateIdentity("renamed-app", "apokamo/starter-app"),
    ).toThrow(/partially/i);
    expect(() =>
      verifySkillMetadata(
        "issue-start",
        "---\nname: issue-close\ndescription: wrong\n---\n",
      ),
    ).toThrow(/frontmatter/i);
  },
);
