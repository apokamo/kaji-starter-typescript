import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import {
  verifyAgentSkillSymlink,
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
  "resolves dogfood issue state through the provider",
  { tags: ["medium"] },
  () => {
    const dogfoodRunner = readFileSync("scripts/dogfood-local", "utf8");

    expect(dogfoodRunner).toContain(
      `./scripts/kaji issue view "$ISSUE_ID" --json state -q '.state'`,
    );
    expect(dogfoodRunner).not.toContain(`.kaji/issues/\${ISSUE_ID}.md`);
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

test(
  "rejects broken and misdirected agent skill symlinks",
  { tags: ["medium"] },
  () => {
    const root = mkdtempSync(path.join(tmpdir(), "skill-links-"));
    const skill = path.join(root, ".claude/skills/issue-start");
    const entry = path.join(root, ".agents/skills/issue-start");
    const wrongSkill = path.join(root, ".claude/skills/issue-close");
    mkdirSync(skill, { recursive: true });
    mkdirSync(wrongSkill, { recursive: true });
    mkdirSync(path.dirname(entry), { recursive: true });

    try {
      symlinkSync("../../.claude/skills/issue-start", entry);
      expect(() =>
        verifyAgentSkillSymlink("issue-start", entry, skill),
      ).not.toThrow();

      unlinkSync(entry);
      symlinkSync("../../.claude/skills/missing", entry);
      expect(() =>
        verifyAgentSkillSymlink("issue-start", entry, skill),
      ).toThrow(/Broken agent skill symlink/);

      unlinkSync(entry);
      symlinkSync("../../.claude/skills/issue-close", entry);
      expect(() =>
        verifyAgentSkillSymlink("issue-start", entry, skill),
      ).toThrow(/wrong path/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

test.each([
  ["README.md", "Run .kaji/wf/official/dev.yaml", /official/i],
  ["SKILL.md", "status: known_failures", /known_failures/i],
  ["SKILL.md", "Run pytest after implementation", /pytest/i],
  ["feat.md", "@Vitest.mark.small", /@Vitest\.mark/i],
  ["feat.md", "Use tmp_path for temporary files", /temporary fixture/i],
  ["feat.md", "Expect ImportError before implementation", /import error/i],
  ["refactor.md", "npm test -- --cov=module tests/path", /coverage flag/i],
  ["bug.md", "npm test -- tests/path -k test_name", /name filter/i],
  ["feat.md", "Never run pip install directly", /pip install/i],
  [
    "i-doc-review/SKILL.md",
    "python3 scripts/check_doc_links.py README.md",
    /link checker/i,
  ],
  ["SKILL.md", "Inspect src/example.py and tests/test_example.py", /source/i],
  ["SKILL.md", "See prompt.py for injected values", /implementation path/i],
  ["SKILL.md", "Validate with Pydantic", /runtime library/i],
  ["SKILL.md", "uv run python -m package.module", /module invocation/i],
])(
  "rejects stale Python or official-workflow consumer contract: %s",
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
