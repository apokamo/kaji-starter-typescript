import { expect, test } from "vitest";

import {
  classifyVitestReport,
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
