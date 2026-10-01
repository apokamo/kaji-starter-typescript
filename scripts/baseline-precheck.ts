import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  realpathSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  BaselineArtifactSchema,
  classifyVitestReport,
  evaluateBaselineGuards,
  sanitizeFailure,
  validateReusableArtifact,
} from "./baseline-core.ts";

const environmentSchema = z.object({
  KAJI_ISSUE_ID: z.string().min(1),
  KAJI_BRANCH_NAME: z.string().min(1),
  KAJI_DEFAULT_BRANCH: z.string().min(1),
  KAJI_PROVIDER_TYPE: z.enum(["github", "local"]),
  KAJI_WORKTREE_DIR: z.string().min(1),
  KAJI_VERDICT_PATH: z.string().min(1),
});

function atomicWrite(filename: string, text: string): void {
  mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}`;
  writeFileSync(temporary, text, "utf8");
  renameSync(temporary, filename);
}

function git(worktree: string, ...arguments_: string[]): string {
  return execFileSync("git", ["-C", worktree, ...arguments_], {
    encoding: "utf8",
  }).trim();
}

function verdictYaml(
  status: "ABORT" | "PASS",
  reason: string,
  evidence: string,
): string {
  return `status: ${status}\nreason: ${JSON.stringify(reason)}\nevidence: |\n  ${evidence.replaceAll("\n", "\n  ")}\nsuggestion: ${JSON.stringify(
    status === "PASS" ? "" : "Fix the baseline failure before implementation",
  )}\n`;
}

function writeVerdict(filename: string, yaml: string): void {
  atomicWrite(filename, yaml);
  process.stdout.write(`---VERDICT---\n${yaml}---END_VERDICT---\n`);
}

function postBaselineComment(
  environment: z.infer<typeof environmentSchema>,
  worktree: string,
  yaml: string,
): void {
  const commentPath = path.join(
    worktree,
    ".kaji-artifacts/baseline/baseline-comment.md",
  );
  atomicWrite(
    commentPath,
    `## TypeScript Baseline\n\nDeterministic clean-only baseline measurement.\n\n---VERDICT---\n${yaml}---END_VERDICT---\n`,
  );
  const posted = spawnSync(
    path.join(worktree, "scripts/kaji"),
    [
      "issue",
      "comment",
      environment.KAJI_ISSUE_ID,
      "--commit",
      "--body-file",
      commentPath,
    ],
    {
      cwd: worktree,
      encoding: "utf8",
      env: process.env,
    },
  );
  rmSync(commentPath, { force: true });
  if (posted.status !== 0) {
    throw new Error(
      `Failed to post baseline evidence: exit ${posted.status ?? "unknown"}`,
    );
  }
}

function validateArtifact(
  identity: { issueId: string; branch: string },
  worktree: string,
  artifactPath: string,
): void {
  const artifact = BaselineArtifactSchema.parse(
    JSON.parse(readFileSync(artifactPath, "utf8")),
  );
  const ancestor = spawnSync(
    "git",
    [
      "-C",
      worktree,
      "merge-base",
      "--is-ancestor",
      artifact.measuredCommit,
      "HEAD",
    ],
    { cwd: worktree },
  );
  validateReusableArtifact(artifact, {
    issueId: identity.issueId,
    branch: identity.branch,
    ancestors: new Set(ancestor.status === 0 ? [artifact.measuredCommit] : []),
  });
  process.stdout.write(
    `Baseline artifact valid: measured_commit=${artifact.measuredCommit}; tests=${artifact.summary.total}\n`,
  );
}

function measureBaseline(
  environment: z.infer<typeof environmentSchema>,
  worktree: string,
  artifactPath: string,
): void {
  try {
    const implementationPaths = git(
      worktree,
      "diff",
      "--name-only",
      `${environment.KAJI_DEFAULT_BRANCH}...HEAD`,
    )
      .split("\n")
      .filter((filename) => filename !== "")
      .filter((filename) => !filename.startsWith("draft/design/"));
    evaluateBaselineGuards({
      worktree: realpathSync(worktree),
      gitTopLevel: realpathSync(git(worktree, "rev-parse", "--show-toplevel")),
      branch: git(worktree, "branch", "--show-current"),
      expectedBranch: environment.KAJI_BRANCH_NAME,
      status: git(worktree, "status", "--porcelain"),
      implementationCommits: implementationPaths,
      nodeVersion: execFileSync(process.execPath, ["--version"], {
        cwd: worktree,
        encoding: "utf8",
      })
        .trim()
        .replace(/^v/, ""),
      npmVersion: execFileSync("npm", ["--version"], {
        cwd: worktree,
        encoding: "utf8",
      }).trim(),
      lockfilePresent: existsSync(path.join(worktree, "package-lock.json")),
      nodeModulesPresent: existsSync(path.join(worktree, "node_modules")),
    });
  } catch {
    const artifact = BaselineArtifactSchema.parse({
      schemaVersion: 1,
      issueId: environment.KAJI_ISSUE_ID,
      branch: environment.KAJI_BRANCH_NAME,
      measuredCommit: git(worktree, "rev-parse", "HEAD"),
      measuredAt: new Date().toISOString(),
      runner: "vitest",
      command: ["baseline-guard"],
      exitCode: -1,
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        todo: 0,
      },
      status: "invalid",
      stopReason: "guard_failed",
      failures: [],
    });
    atomicWrite(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
    const yaml = verdictYaml(
      "ABORT",
      "TypeScript baseline is invalid",
      "status=invalid; total=0; failed=0; stop_reason=guard_failed",
    );
    postBaselineComment(environment, worktree, yaml);
    writeVerdict(environment.KAJI_VERDICT_PATH, yaml);
    return;
  }

  const diagnosticDirectory = path.join(worktree, ".kaji-artifacts/baseline");
  mkdirSync(diagnosticDirectory, { recursive: true });
  const reportPath = path.join(diagnosticDirectory, "vitest-report.json");
  const reportArgument = path.relative(worktree, reportPath);
  rmSync(reportPath, { force: true });
  const command = [
    "exec",
    "--offline",
    "--",
    "vitest",
    "run",
    "--reporter=./scripts/test-tag-reporter.ts",
    "--reporter=json",
    `--outputFile=${reportArgument}`,
  ];
  const testRun = spawnSync("npm", command, {
    cwd: worktree,
    encoding: "utf8",
    env: process.env,
  });

  let rawReport: unknown = {};
  let reportReadFailure = false;
  try {
    rawReport = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    reportReadFailure = true;
  }
  let classification =
    testRun.status === 0 || testRun.status === 1
      ? classifyVitestReport(rawReport)
      : {
          status: "invalid" as const,
          stopReason: `unexpected_exit_code:${testRun.status ?? -1}`,
        };
  if (
    reportReadFailure &&
    testRun.status === 1 &&
    testRun.stderr.includes("Test tag audit failed")
  ) {
    classification = { status: "blocked", stopReason: "tag_audit_failed" };
  } else if (reportReadFailure) {
    classification = {
      status: "invalid",
      stopReason: "missing_or_invalid_report",
    };
  }

  const parsedReport = z
    .object({
      numTotalTests: z.number().int().default(0),
      numPassedTests: z.number().int().default(0),
      numFailedTests: z.number().int().default(0),
      numPendingTests: z.number().int().default(0),
      numTodoTests: z.number().int().default(0),
      testResults: z
        .array(
          z.object({
            name: z.string(),
            assertionResults: z
              .array(
                z.object({
                  fullName: z.string(),
                  status: z.string(),
                  failureMessages: z.array(z.string()).nullable(),
                }),
              )
              .default([]),
          }),
        )
        .default([]),
    })
    .passthrough()
    .catch({
      numTotalTests: 0,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      testResults: [],
    })
    .parse(rawReport);
  const artifact = BaselineArtifactSchema.parse({
    schemaVersion: 1,
    issueId: environment.KAJI_ISSUE_ID,
    branch: environment.KAJI_BRANCH_NAME,
    measuredCommit: git(worktree, "rev-parse", "HEAD"),
    measuredAt: new Date().toISOString(),
    runner: "vitest",
    command: ["npm", ...command],
    exitCode: testRun.status ?? -1,
    summary: {
      total: parsedReport.numTotalTests,
      passed: parsedReport.numPassedTests,
      failed: parsedReport.numFailedTests,
      skipped: parsedReport.numPendingTests,
      todo: parsedReport.numTodoTests,
    },
    status: classification.status,
    stopReason: classification.stopReason,
    failures: parsedReport.testResults.flatMap((file) =>
      file.assertionResults
        .filter((testCase) => testCase.status === "failed")
        .map((testCase) =>
          sanitizeFailure(
            file.name,
            testCase.fullName,
            testCase.failureMessages?.[0] ?? "test failed",
            worktree,
            Object.entries(process.env)
              .filter(
                ([name, value]) =>
                  /(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL)/i.test(
                    name,
                  ) && value !== undefined,
              )
              .map(([, value]) => value ?? ""),
          ),
        ),
    ),
  });
  atomicWrite(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  const yaml = verdictYaml(
    artifact.status === "clean" ? "PASS" : "ABORT",
    artifact.status === "clean"
      ? "TypeScript baseline is clean"
      : `TypeScript baseline is ${artifact.status}`,
    `status=${artifact.status}; total=${artifact.summary.total}; failed=${artifact.summary.failed}; stop_reason=${artifact.stopReason ?? "none"}`,
  );
  postBaselineComment(environment, worktree, yaml);
  writeVerdict(environment.KAJI_VERDICT_PATH, yaml);
}

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function resolveWorktree(rawWorktree: string | undefined): string {
  if (rawWorktree === undefined || rawWorktree === "") {
    throw new Error("KAJI_WORKTREE_DIR or --worktree is required");
  }
  if (!path.isAbsolute(rawWorktree)) {
    throw new Error("worktree must be an absolute path");
  }
  const worktree = path.resolve(rawWorktree);
  if (
    realpathSync(git(worktree, "rev-parse", "--show-toplevel")) !==
    realpathSync(worktree)
  ) {
    throw new Error("worktree does not match git top-level");
  }
  return worktree;
}

function artifactPathFor(worktree: string): string {
  return path.join(worktree, ".kaji-artifacts/baseline/baseline.json");
}

// Validation runs from agent steps, which do not receive the KAJI_* context
// variables (only exec steps do), so it takes --worktree / --issue instead of
// requiring the full runner environment.
if (process.argv.includes("--validate")) {
  const worktree = resolveWorktree(
    optionValue("--worktree") ?? process.env.KAJI_WORKTREE_DIR,
  );
  const issueId = optionValue("--issue") ?? process.env.KAJI_ISSUE_ID;
  if (issueId === undefined || issueId === "") {
    throw new Error("KAJI_ISSUE_ID or --issue is required");
  }
  const branch =
    process.env.KAJI_BRANCH_NAME ?? git(worktree, "branch", "--show-current");
  validateArtifact({ issueId, branch }, worktree, artifactPathFor(worktree));
} else {
  const environment = environmentSchema.parse(process.env);
  const worktree = resolveWorktree(environment.KAJI_WORKTREE_DIR);
  if (
    git(worktree, "branch", "--show-current") !== environment.KAJI_BRANCH_NAME
  ) {
    throw new Error("KAJI_BRANCH_NAME does not match the worktree branch");
  }
  measureBaseline(environment, worktree, artifactPathFor(worktree));
}
