import { expect, test } from "vitest";

import { auditTagRecords } from "../scripts/test-tag-reporter.ts";

test("accepts exactly one known effective tag", { tags: ["small"] }, () => {
  expect(() =>
    auditTagRecords([
      { id: "tests/example.test.ts > works", mode: "run", tags: ["small"] },
    ]),
  ).not.toThrow();
});

test.each([
  [[], /exactly one/i],
  [["small", "medium"], /exactly one/i],
  [["unknown"], /unknown/i],
])("rejects invalid effective tags", { tags: ["small"] }, (tags, expected) => {
  expect(() =>
    auditTagRecords([
      { id: "tests/example.test.ts > invalid", mode: "run", tags },
    ]),
  ).toThrow(expected);
});

test("rejects focused tests", { tags: ["small"] }, () => {
  expect(() =>
    auditTagRecords([
      { id: "tests/example.test.ts > focused", mode: "only", tags: ["small"] },
    ]),
  ).toThrow(/only/i);
});
