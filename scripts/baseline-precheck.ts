import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import {
  classifyVitestReport,
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

const artifactSchema = z.object({
  schemaVersion: z.literal(1),
  issueId: z.string(),
  branch: z.string(),
  measuredCommit: z.string(),
  measuredAt: z.string(),
  runner: z.literal("vitest"),
  command: z.array(z.string()),
  exitCode: z.number().int(),
  summary: z.object({
    total: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    skipped: z.number().int(),
    todo: z.number().int(),
  }),
  status: z.enum(["clean", "blocked", "invalid"]),
  stopReason: z.string().nullable(),
  failures: z.array(
    z.object({
      identity: z.string(),
      messageHead: z.string(),
    }),
  ),
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

function writeVerdict(
  filename: string,
  status: "ABORT" | "PASS",
  reason: string,
  evidence: string,
): void {
  const yaml = `status: ${status}\nreason: ${JSON.stringify(reason)}\nevidence: |\n  ${evidence.replaceAll("\n", "\n  ")}\nsuggestion: ${JSON.stringify(
    status === "PASS" ? "" : "Fix the baseline failure before implementation",
  )}\n`;
  atomicWrite(filename, yaml);
  process.stdout.write(`---VERDICT---\n${yaml}---END_VERDICT---\n`);
}

const environment = environmentSchema.parse(process.env);
const worktree = path.resolve(environment.KAJI_WORKTREE_DIR);
if (git(worktree, "rev-parse", "--show-toplevel") !== worktree) {
  throw new Error("KAJI_WORKTREE_DIR does not match git top-level");
}
if (
  git(worktree, "branch", "--show-current") !== environment.KAJI_BRANCH_NAME
) {
  throw new Error("KAJI_BRANCH_NAME does not match the worktree branch");
}
const artifactPath = path.join(
  worktree,
  ".kaji-artifacts/baseline/baseline.json",
);
if (process.argv.includes("--validate")) {
  const artifact = artifactSchema.parse(
    JSON.parse(readFileSync(artifactPath, "utf8")),
  );
  const ancestor = spawnSync("git", [
    "-C",
    worktree,
    "merge-base",
    "--is-ancestor",
    artifact.measuredCommit,
    "HEAD",
  ]);
  validateReusableArtifact(artifact, {
    issueId: environment.KAJI_ISSUE_ID,
    branch: environment.KAJI_BRANCH_NAME,
    ancestors: new Set(ancestor.status === 0 ? [artifact.measuredCommit] : []),
  });
  writeVerdict(
    environment.KAJI_VERDICT_PATH,
    "PASS",
    "Clean TypeScript baseline artifact is valid",
    `measured_commit=${artifact.measuredCommit}; tests=${artifact.summary.total}`,
  );
  process.exit(0);
}
if (git(worktree, "status", "--porcelain") !== "") {
  writeVerdict(
    environment.KAJI_VERDICT_PATH,
    "ABORT",
    "Baseline requires a clean worktree",
    "git status --porcelain was non-empty",
  );
  process.exit(0);
}
const diagnosticDirectory = path.join(worktree, ".kaji-artifacts/baseline");
mkdirSync(diagnosticDirectory, { recursive: true });
const reportPath = path.join(diagnosticDirectory, "vitest-report.json");
const command = [
  "exec",
  "--offline",
  "--",
  "vitest",
  "run",
  "--reporter=./scripts/test-tag-reporter.ts",
  "--reporter=json",
  `--outputFile=${reportPath}`,
];
const testRun = spawnSync("npm", command, {
  cwd: worktree,
  encoding: "utf8",
  env: process.env,
});
const rawReport: unknown =
  testRun.status === 0 || testRun.status === 1
    ? JSON.parse(readFileSync(reportPath, "utf8"))
    : {};
const classification = classifyVitestReport(rawReport);
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
  .parse(rawReport);
const artifact = artifactSchema.parse({
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
      .map((testCase) => ({
        identity: testCase.fullName,
        messageHead: (testCase.failureMessages?.[0] ?? "test failed")
          .split("\n", 1)[0]
          ?.slice(0, 240),
      })),
  ),
});
atomicWrite(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
writeVerdict(
  environment.KAJI_VERDICT_PATH,
  artifact.status === "clean" ? "PASS" : "ABORT",
  artifact.status === "clean"
    ? "TypeScript baseline is clean"
    : `TypeScript baseline is ${artifact.status}`,
  `status=${artifact.status}; total=${artifact.summary.total}; failed=${artifact.summary.failed}`,
);
