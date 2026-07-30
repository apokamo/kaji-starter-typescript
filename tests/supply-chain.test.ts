import { expect, test } from "vitest";

import {
  verifyActionReferences,
  verifyChecksum,
  verifyPackagePolicy,
} from "../scripts/verify-static.ts";

const validPackage = {
  engines: { node: ">=24.12 <25" },
  packageManager: "npm@11.16.0",
  devEngines: {
    runtime: { name: "node", version: "24.18.1", onFail: "error" },
    packageManager: { name: "npm", version: "11.16.0", onFail: "error" },
  },
  allowScripts: { "fsevents@2.3.3": true },
};

test(
  "accepts pinned runtime and install-script policy",
  { tags: ["medium"] },
  () => {
    expect(() =>
      verifyPackagePolicy(validPackage, {
        "engine-strict": "true",
        "strict-peer-deps": "true",
        "strict-allow-scripts": "true",
        "allow-scripts-pin": "true",
      }),
    ).not.toThrow();
  },
);

test.each([
  [{ ...validPackage, packageManager: "npm@latest" }, /npm/i],
  [{ ...validPackage, allowScripts: {} }, /allowScripts/i],
])(
  "rejects weakened package policy",
  { tags: ["medium"] },
  (packageJson, expected) => {
    expect(() =>
      verifyPackagePolicy(packageJson, {
        "engine-strict": "true",
        "strict-peer-deps": "true",
        "strict-allow-scripts": "true",
        "allow-scripts-pin": "true",
      }),
    ).toThrow(expected);
  },
);

test("rejects mutable GitHub Action references", { tags: ["medium"] }, () => {
  expect(() =>
    verifyActionReferences("steps:\n  - uses: actions/checkout@v4\n"),
  ).toThrow(/full commit SHA/i);
});

test("rejects a modified tool archive checksum", { tags: ["medium"] }, () => {
  expect(() => verifyChecksum("0".repeat(64), "1".repeat(64))).toThrow(
    /checksum mismatch/i,
  );
});
