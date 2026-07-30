import type { Reporter, TestModule } from "vitest/node";

const KNOWN_TAGS = new Set(["small", "medium", "large"]);

export interface TagRecord {
  id: string;
  mode: "only" | "run" | "skip" | "todo";
  tags: readonly string[];
}

export function auditTagRecords(records: readonly TagRecord[]): void {
  if (records.length === 0) {
    throw new Error("Test tag audit rejected a corpus with zero tests");
  }
  const findings: string[] = [];
  for (const record of records) {
    if (record.mode === "only") {
      findings.push(`${record.id}: .only is forbidden`);
    }
    if (record.tags.length !== 1) {
      findings.push(
        `${record.id}: expected exactly one effective tag, got ${record.tags.length}`,
      );
      continue;
    }
    const tag = record.tags[0];
    if (tag === undefined || !KNOWN_TAGS.has(tag)) {
      findings.push(`${record.id}: unknown tag ${tag ?? "<missing>"}`);
    }
  }
  if (findings.length > 0) {
    throw new Error(`Test tag audit failed:\n${findings.join("\n")}`);
  }
}

export default class TestTagReporter implements Reporter {
  onTestModuleCollected(testModule: TestModule): void {
    const records = [...testModule.children.allTests()].map((testCase) => ({
      id: testCase.fullName,
      mode: testCase.options.mode,
      tags: testCase.tags,
    }));
    auditTagRecords(records);
  }
}
