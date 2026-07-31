import path from "node:path";

import { z } from "zod";

const reportSchema = z.object({
  success: z.boolean(),
  numTotalTests: z.number().int().nonnegative(),
  numPassedTests: z.number().int().nonnegative(),
  numFailedTests: z.number().int().nonnegative(),
  numPendingTests: z.number().int().nonnegative().default(0),
  numTodoTests: z.number().int().nonnegative().default(0),
  testResults: z.array(z.unknown()).default([]),
});

const summarySchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  todo: z.number().int().nonnegative(),
});

export const BaselineArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    issueId: z.string().min(1),
    branch: z.string().min(1),
    measuredCommit: z.string().regex(/^[0-9a-f]{40}$/i),
    measuredAt: z.iso.datetime(),
    runner: z.literal("vitest"),
    command: z.array(z.string()).min(1),
    exitCode: z.number().int(),
    summary: summarySchema,
    status: z.enum(["clean", "blocked", "invalid"]),
    stopReason: z.string().nullable(),
    failures: z.array(
      z.object({
        file: z.string().min(1),
        full_name: z.string().min(1),
        error_type: z.string().min(1),
        message_head: z.string().min(1),
      }),
    ),
  })
  .superRefine((artifact, context) => {
    const accounted =
      artifact.summary.passed +
      artifact.summary.failed +
      artifact.summary.skipped +
      artifact.summary.todo;
    if (accounted !== artifact.summary.total) {
      context.addIssue({
        code: "custom",
        message: "Baseline summary does not account for every test",
      });
    }
    if (
      artifact.status === "clean" &&
      (artifact.exitCode !== 0 ||
        artifact.summary.total === 0 ||
        artifact.summary.failed !== 0 ||
        artifact.failures.length !== 0 ||
        artifact.stopReason !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Clean baseline artifact contains failure state",
      });
    }
    if (artifact.status !== "clean" && artifact.stopReason === null) {
      context.addIssue({
        code: "custom",
        message: "Non-clean baseline artifact requires a stop reason",
      });
    }
  });

const reusableArtifactSchema = z.object({
  schemaVersion: z.literal(1),
  issueId: z.string().min(1),
  branch: z.string().min(1),
  measuredCommit: z.string().min(1),
  status: z.literal("clean"),
});

export interface BaselineClassification {
  status: "blocked" | "clean" | "invalid";
  stopReason: string | null;
}

export interface ArtifactValidationContext {
  ancestors: ReadonlySet<string>;
  branch: string;
  issueId: string;
}

export interface BaselineGuardInput {
  branch: string;
  expectedBranch: string;
  gitTopLevel: string;
  implementationCommits: readonly string[];
  lockfilePresent: boolean;
  nodeModulesPresent: boolean;
  nodeVersion: string;
  npmVersion: string;
  status: string;
  worktree: string;
}

export function evaluateBaselineGuards(input: BaselineGuardInput): void {
  if (!path.isAbsolute(input.worktree)) {
    throw new Error("KAJI_WORKTREE_DIR must be an absolute path");
  }
  if (path.resolve(input.gitTopLevel) !== path.resolve(input.worktree)) {
    throw new Error("KAJI_WORKTREE_DIR does not match git top-level");
  }
  if (input.branch !== input.expectedBranch) {
    throw new Error("KAJI_BRANCH_NAME does not match the worktree branch");
  }
  if (input.status !== "") {
    throw new Error("Baseline requires a clean worktree");
  }
  if (input.implementationCommits.length > 0) {
    throw new Error("Baseline rejected an implementation commit");
  }
  if (input.nodeVersion !== "24.18.1") {
    throw new Error("Node.js 24.18.1 is required");
  }
  if (input.npmVersion !== "11.16.0") {
    throw new Error("npm 11.16.0 is required");
  }
  if (!input.lockfilePresent || !input.nodeModulesPresent) {
    throw new Error("Run make setup in this worktree before baseline");
  }
}

export function sanitizeFailure(
  file: string,
  fullName: string,
  message: string,
  worktree: string,
  sensitiveValues: readonly string[] = [],
): {
  file: string;
  full_name: string;
  error_type: string;
  message_head: string;
} {
  const resolvedWorktree = path.resolve(worktree);
  const resolvedFile = path.isAbsolute(file)
    ? path.resolve(file)
    : path.resolve(resolvedWorktree, file);
  const relativeFile = path.relative(resolvedWorktree, resolvedFile);
  const safeFile =
    relativeFile.startsWith("..") || path.isAbsolute(relativeFile)
      ? `<outside-worktree>/${path.basename(resolvedFile)}`
      : relativeFile.split(path.sep).join("/");
  const rawMessageHead =
    message.split(/\r?\n/).find((line) => line.trim() !== "") ??
    "Error: test failed";
  const stripAnsi = (value: string): string =>
    value
      .split(String.fromCharCode(27))
      .map((part, index) =>
        index === 0 ? part : part.replace(/^\[[0-9;]*m/, ""),
      )
      .join("");
  const normalizedMessageHead = stripAnsi(rawMessageHead);
  const errorType =
    /^([A-Za-z_$][\w.$]*(?:Error|Exception)?)\s*:/.exec(
      normalizedMessageHead,
    )?.[1] ?? "Error";

  const redact = (value: string): string => {
    let redacted = stripAnsi(value)
      .replaceAll(`file://${resolvedWorktree}`, "<worktree>")
      .replaceAll(resolvedWorktree, "<worktree>");
    for (const sensitiveValue of sensitiveValues) {
      if (sensitiveValue.length >= 4) {
        redacted = redacted.replaceAll(sensitiveValue, "<redacted>");
      }
    }
    return redacted
      .replace(
        /\b(secret|token|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
        "$1=<redacted>",
      )
      .replace(
        /(?:\/(?:home|Users|tmp)\/|[A-Za-z]:\\)[^\s)]+/g,
        "<absolute-path>",
      )
      .slice(0, 300);
  };

  return {
    file: safeFile,
    full_name: redact(fullName),
    error_type: errorType,
    message_head: redact(rawMessageHead),
  };
}

export function classifyVitestReport(report: unknown): BaselineClassification {
  const parsed = reportSchema.safeParse(report);
  if (!parsed.success) {
    return { status: "invalid", stopReason: "invalid_report" };
  }
  const summary = parsed.data;
  if (summary.numTotalTests === 0) {
    return { status: "invalid", stopReason: "zero_tests" };
  }
  if (summary.numFailedTests > 0 || !summary.success) {
    return { status: "blocked", stopReason: "test_failures" };
  }
  const accounted =
    summary.numPassedTests +
    summary.numFailedTests +
    summary.numPendingTests +
    summary.numTodoTests;
  if (accounted !== summary.numTotalTests) {
    return { status: "invalid", stopReason: "summary_mismatch" };
  }
  return { status: "clean", stopReason: null };
}

export function validateReusableArtifact(
  artifact: unknown,
  context: ArtifactValidationContext,
): z.infer<typeof reusableArtifactSchema> {
  const parsed = reusableArtifactSchema.parse(artifact);
  if (parsed.issueId !== context.issueId) {
    throw new Error("Baseline artifact issue does not match the current issue");
  }
  if (parsed.branch !== context.branch) {
    throw new Error(
      "Baseline artifact branch does not match the current branch",
    );
  }
  if (!context.ancestors.has(parsed.measuredCommit)) {
    throw new Error("Baseline measured commit is not an ancestor of HEAD");
  }
  return parsed;
}
