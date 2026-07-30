import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "vitest";

const requiredOptions = {
  allowImportingTsExtensions: true,
  erasableSyntaxOnly: true,
  exactOptionalPropertyTypes: true,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  noUncheckedIndexedAccess: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  rewriteRelativeImportExtensions: true,
  skipLibCheck: false,
  strict: true,
  useUnknownInCatchVariables: true,
  verbatimModuleSyntax: true,
} as const;

test(
  "keeps every strict compiler option required by the starter contract",
  { tags: ["medium"] },
  () => {
    const config = JSON.parse(readFileSync("tsconfig.json", "utf8")) as {
      compilerOptions?: Record<string, unknown>;
    };
    for (const [name, value] of Object.entries(requiredOptions)) {
      expect(config.compilerOptions?.[name], name).toBe(value);
    }
  },
);

test(
  "rejects source fixtures that violate every high-value strict option",
  { tags: ["medium"] },
  () => {
    const result = spawnSync(
      "node_modules/.bin/tsc",
      ["-p", "tests/fixtures/compiler/tsconfig.json"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 30_000,
      },
    );
    expect(result.status).not.toBe(0);
    for (const diagnostic of [
      "TS1294",
      "TS2322",
      "TS2375",
      "TS6133",
      "TS4114",
      "TS7029",
      "TS2835",
    ]) {
      expect(result.stdout, diagnostic).toContain(diagnostic);
    }
  },
);
