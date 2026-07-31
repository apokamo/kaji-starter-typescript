import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

import {
  BaselineArtifactSchema,
  classifyVitestReport,
  evaluateBaselineGuards,
  sanitizeFailure,
  validateReusableArtifact,
} from "../scripts/baseline-core.ts";

test(
  "classifies only a consistent non-empty passing report as clean",
  { tags: ["small"] },
  () => {
    expect(
      classifyVitestReport({
        success: true,
        numTotalTests: 3,
        numPassedTests: 3,
        numFailedTests: 0,
        numPendingTests: 0,
        numTodoTests: 0,
        testResults: [],
      }),
    ).toEqual({ status: "clean", stopReason: null });
  },
);

test.each([
  [
    { success: true, numTotalTests: 0, numPassedTests: 0, numFailedTests: 0 },
    "zero_tests",
  ],
  [
    { success: false, numTotalTests: 2, numPassedTests: 1, numFailedTests: 1 },
    "test_failures",
  ],
  [
    { success: true, numTotalTests: 2, numPassedTests: 1, numFailedTests: 0 },
    "summary_mismatch",
  ],
])(
  "fails closed for invalid or failing reports",
  { tags: ["small"] },
  (report, stopReason) => {
    expect(classifyVitestReport(report)).toMatchObject({ stopReason });
  },
);

test(
  "rejects a reusable artifact from another issue",
  { tags: ["small"] },
  () => {
    expect(() =>
      validateReusableArtifact(
        {
          schemaVersion: 1,
          issueId: "other",
          branch: "feat/391",
          measuredCommit: "abc",
          status: "clean",
        },
        { issueId: "391", branch: "feat/391", ancestors: new Set(["abc"]) },
      ),
    ).toThrow(/issue/i);
  },
);

test.each([
  [
    {
      gitTopLevel: "/work/feature",
      worktree: "relative/path",
      branch: "feat/391",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: [],
      nodeVersion: "24.18.1",
      npmVersion: "11.16.0",
      nodeModulesPresent: true,
      lockfilePresent: true,
    },
    "absolute",
  ],
  [
    {
      gitTopLevel: "/work/other",
      worktree: "/work/feature",
      branch: "feat/391",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: [],
      nodeVersion: "24.18.1",
      npmVersion: "11.16.0",
      nodeModulesPresent: true,
      lockfilePresent: true,
    },
    "top-level",
  ],
  [
    {
      gitTopLevel: "/work/feature",
      worktree: "/work/feature",
      branch: "other",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: [],
      nodeVersion: "24.18.1",
      npmVersion: "11.16.0",
      nodeModulesPresent: true,
      lockfilePresent: true,
    },
    "branch",
  ],
  [
    {
      gitTopLevel: "/work/feature",
      worktree: "/work/feature",
      branch: "feat/391",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: ["abc src/index.ts"],
      nodeVersion: "24.18.1",
      npmVersion: "11.16.0",
      nodeModulesPresent: true,
      lockfilePresent: true,
    },
    "implementation commit",
  ],
  [
    {
      gitTopLevel: "/work/feature",
      worktree: "/work/feature",
      branch: "feat/391",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: [],
      nodeVersion: "24.18.0",
      npmVersion: "11.16.0",
      nodeModulesPresent: true,
      lockfilePresent: true,
    },
    "Node.js",
  ],
  [
    {
      gitTopLevel: "/work/feature",
      worktree: "/work/feature",
      branch: "feat/391",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: [],
      nodeVersion: "24.18.1",
      npmVersion: "11.15.0",
      nodeModulesPresent: true,
      lockfilePresent: true,
    },
    "npm",
  ],
  [
    {
      gitTopLevel: "/work/feature",
      worktree: "/work/feature",
      branch: "feat/391",
      expectedBranch: "feat/391",
      status: "",
      implementationCommits: [],
      nodeVersion: "24.18.1",
      npmVersion: "11.16.0",
      nodeModulesPresent: false,
      lockfilePresent: true,
    },
    "setup",
  ],
])(
  "fails closed when a baseline guard is violated",
  { tags: ["small"] },
  (input, expected) => {
    expect(() => evaluateBaselineGuards(input)).toThrow(expected);
  },
);

test(
  "accepts the complete baseline artifact and rejects inconsistent status",
  { tags: ["small"] },
  () => {
    const artifact = {
      schemaVersion: 1,
      issueId: "391",
      branch: "feat/391",
      measuredCommit: "a".repeat(40),
      measuredAt: "2026-07-30T00:00:00.000Z",
      runner: "vitest",
      command: ["npm", "exec", "--offline", "--", "vitest", "run"],
      exitCode: 0,
      summary: { total: 3, passed: 3, failed: 0, skipped: 0, todo: 0 },
      status: "clean",
      stopReason: null,
      failures: [],
    };
    expect(BaselineArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(() =>
      BaselineArtifactSchema.parse({
        ...artifact,
        exitCode: 1,
        status: "clean",
      }),
    ).toThrow();
  },
);

test(
  "sanitizes failure evidence without leaking paths or multiline values",
  { tags: ["small"] },
  () => {
    expect(
      sanitizeFailure(
        "/home/example/project/tests/config.test.ts",
        "rejects secret",
        "AssertionError: token=secret-value at /home/example/project/src/config.ts:1\n    stack",
        "/home/example/project",
        ["secret-value"],
      ),
    ).toEqual({
      file: "tests/config.test.ts",
      full_name: "rejects secret",
      error_type: "AssertionError",
      message_head:
        "AssertionError: token=<redacted> at <worktree>/src/config.ts:1",
    });
  },
);

function createBaselineFixture(options?: {
  report?: (worktree: string) => unknown;
  runExitCode?: number;
}): {
  environment: NodeJS.ProcessEnv;
  verdictPath: string;
  worktree: string;
} {
  const worktree = mkdtempSync(path.join(tmpdir(), "baseline-worktree-"));
  const commandDirectory = mkdtempSync(path.join(tmpdir(), "baseline-bin-"));
  mkdirSync(path.join(worktree, "scripts"), { recursive: true });
  mkdirSync(path.join(worktree, "node_modules"), { recursive: true });
  writeFileSync(
    path.join(worktree, ".gitignore"),
    ".kaji-artifacts/\n",
    "utf8",
  );
  writeFileSync(path.join(worktree, "package-lock.json"), "{}\n", "utf8");
  const kaji = path.join(worktree, "scripts/kaji");
  writeFileSync(
    kaji,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$@" >.kaji-artifacts/baseline/captured-comment-arguments.txt
while (($# > 0)); do
  if [[ "$1" == "--body-file" ]]; then
    cp "$2" .kaji-artifacts/baseline/captured-comment.md
    exit 0
  fi
  shift
done
exit 2
`,
    "utf8",
  );
  chmodSync(kaji, 0o755);
  const npm = path.join(commandDirectory, "npm");
  const report = JSON.stringify(
    options?.report?.(worktree) ?? {
      success: true,
      numTotalTests: 2,
      numPassedTests: 2,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      testResults: [],
    },
  );
  writeFileSync(
    npm,
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then
  printf '11.16.0\\n'
  exit 0
fi
for argument in "$@"; do
  case "$argument" in
    --outputFile=*)
      report="\${argument#--outputFile=}"
      mkdir -p "$(dirname "$report")"
      printf '%s\\n' '${report}' >"$report"
      ;;
  esac
done
exit ${options?.runExitCode ?? 0}
`,
    "utf8",
  );
  chmodSync(npm, 0o755);
  execFileSync("git", ["init", "-b", "main"], { cwd: worktree });
  execFileSync("git", ["config", "user.name", "Baseline Test"], {
    cwd: worktree,
  });
  execFileSync("git", ["config", "user.email", "baseline@example.invalid"], {
    cwd: worktree,
  });
  execFileSync("git", ["add", "."], { cwd: worktree });
  execFileSync("git", ["commit", "-m", "docs: baseline fixture"], {
    cwd: worktree,
  });
  execFileSync("git", ["switch", "-c", "feat/391"], { cwd: worktree });
  mkdirSync(path.join(worktree, "draft/design"), { recursive: true });
  writeFileSync(
    path.join(worktree, "draft/design/issue-391.md"),
    "# Design\n",
    "utf8",
  );
  execFileSync("git", ["add", "draft/design/issue-391.md"], { cwd: worktree });
  execFileSync("git", ["commit", "-m", "docs: design fixture"], {
    cwd: worktree,
  });
  const mainWorktree = mkdtempSync(path.join(tmpdir(), "baseline-main-"));
  execFileSync("git", ["worktree", "add", mainWorktree, "main"], {
    cwd: worktree,
  });
  mkdirSync(path.join(mainWorktree, ".kaji/issues/391/comments"), {
    recursive: true,
  });
  writeFileSync(
    path.join(mainWorktree, ".kaji/issues/391/comments/design.md"),
    "status: PASS\n",
    "utf8",
  );
  execFileSync("git", ["add", ".kaji/issues"], { cwd: mainWorktree });
  execFileSync("git", ["commit", "-m", "chore(local): record design"], {
    cwd: mainWorktree,
  });
  execFileSync("git", ["worktree", "remove", mainWorktree], {
    cwd: worktree,
  });
  const verdictPath = path.join(
    worktree,
    ".kaji-artifacts/baseline/verdict.yaml",
  );
  return {
    worktree,
    verdictPath,
    environment: {
      ...process.env,
      PATH: `${commandDirectory}:${process.env.PATH}`,
      KAJI_ISSUE_ID: "391",
      KAJI_BRANCH_NAME: "feat/391",
      KAJI_DEFAULT_BRANCH: "main",
      KAJI_PROVIDER_TYPE: "local",
      KAJI_WORKTREE_DIR: worktree,
      KAJI_VERDICT_PATH: verdictPath,
    },
  };
}

test(
  "measures a worktree outside process cwd and writes comment before PASS verdict",
  { tags: ["medium"] },
  () => {
    const fixture = createBaselineFixture();
    const result = spawnSync(
      process.execPath,
      [path.resolve("scripts/baseline-precheck.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: fixture.environment,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(fixture.verdictPath, "utf8")).toContain("status: PASS");
    const artifact = JSON.parse(
      readFileSync(
        path.join(fixture.worktree, ".kaji-artifacts/baseline/baseline.json"),
        "utf8",
      ),
    ) as { status: string; summary: { total: number } };
    expect(artifact).toMatchObject({
      status: "clean",
      summary: { total: 2 },
    });
    expect(
      readFileSync(
        path.join(
          fixture.worktree,
          ".kaji-artifacts/baseline/captured-comment.md",
        ),
        "utf8",
      ),
    ).toContain("status: PASS");
    expect(
      readFileSync(
        path.join(
          fixture.worktree,
          ".kaji-artifacts/baseline/captured-comment-arguments.txt",
        ),
        "utf8",
      ).split("\n"),
    ).toContain("--commit");
  },
);

test(
  "persists project-relative sanitized Vitest failure evidence",
  { tags: ["medium"] },
  () => {
    const fixture = createBaselineFixture({
      runExitCode: 1,
      report: (worktree) => ({
        success: false,
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        numPendingTests: 0,
        numTodoTests: 0,
        testResults: [
          {
            name: path.join(worktree, "tests/config.test.ts"),
            assertionResults: [
              {
                fullName: "configuration rejects secret",
                status: "failed",
                failureMessages: [
                  `AssertionError: token=baseline-secret at ${worktree}/src/config.ts:1`,
                ],
              },
            ],
          },
        ],
      }),
    });
    fixture.environment.BASELINE_TEST_SECRET = "baseline-secret";
    const result = spawnSync(
      process.execPath,
      [path.resolve("scripts/baseline-precheck.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: fixture.environment,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    const artifactText = readFileSync(
      path.join(fixture.worktree, ".kaji-artifacts/baseline/baseline.json"),
      "utf8",
    );
    expect(artifactText).not.toContain(fixture.worktree);
    expect(artifactText).not.toContain("baseline-secret");
    expect(JSON.parse(artifactText)).toMatchObject({
      status: "blocked",
      failures: [
        {
          file: "tests/config.test.ts",
          full_name: "configuration rejects secret",
          error_type: "AssertionError",
          message_head:
            "AssertionError: token=<redacted> at <worktree>/src/config.ts:1",
        },
      ],
    });
  },
);

test(
  "validates a reusable artifact without touching the caller verdict",
  { tags: ["medium"] },
  () => {
    const fixture = createBaselineFixture();
    const measurement = spawnSync(
      process.execPath,
      [path.resolve("scripts/baseline-precheck.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: fixture.environment,
      },
    );
    expect(measurement.status, measurement.stderr).toBe(0);

    const callerVerdict = "status: CALLER_OWNS_THIS_PATH\n";
    writeFileSync(fixture.verdictPath, callerVerdict, "utf8");
    const validation = spawnSync(
      process.execPath,
      [path.resolve("scripts/baseline-precheck.ts"), "--validate"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: fixture.environment,
      },
    );

    expect(validation.status, validation.stderr).toBe(0);
    expect(validation.stdout).toContain("Baseline artifact valid");
    expect(validation.stdout).not.toContain("---VERDICT---");
    expect(readFileSync(fixture.verdictPath, "utf8")).toBe(callerVerdict);
  },
);

test(
  "persists an invalid artifact and ABORT verdict for a dirty guard failure",
  { tags: ["medium"] },
  () => {
    const fixture = createBaselineFixture();
    writeFileSync(path.join(fixture.worktree, "dirty.txt"), "dirty\n", "utf8");
    const result = spawnSync(
      process.execPath,
      [path.resolve("scripts/baseline-precheck.ts")],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: fixture.environment,
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(fixture.verdictPath, "utf8")).toContain(
      "status: ABORT",
    );
    const artifactText = readFileSync(
      path.join(fixture.worktree, ".kaji-artifacts/baseline/baseline.json"),
      "utf8",
    );
    expect(artifactText).not.toContain("/home/");
    expect(JSON.parse(artifactText)).toMatchObject({
      status: "invalid",
      stopReason: "guard_failed",
    });
  },
);
