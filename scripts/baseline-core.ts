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
