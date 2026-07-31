import { expect, test } from "vitest";

import {
  verifyActionReferences,
  verifyChecksum,
  verifyPackagePolicy,
} from "../scripts/verify-static.ts";
import { resolveActionlintRelease } from "../scripts/setup-tools.ts";

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
  [
    {
      ...validPackage,
      devEngines: {
        ...validPackage.devEngines,
        runtime: {
          ...validPackage.devEngines.runtime,
          version: "24.18.0",
        },
      },
    },
    /24\.18\.1/,
  ],
  [
    { ...validPackage, allowScripts: { "fsevents@latest": true } },
    /version-pinned/i,
  ],
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

test.each(["engine-strict", "strict-peer-deps"])(
  "rejects a missing or disabled npm policy",
  { tags: ["medium"] },
  (setting) => {
    const npmSettings: Record<string, string> = {
      "engine-strict": "true",
      "strict-peer-deps": "true",
      "strict-allow-scripts": "true",
      "allow-scripts-pin": "true",
    };
    npmSettings[setting] = "false";
    expect(() => verifyPackagePolicy(validPackage, npmSettings)).toThrow(
      new RegExp(setting),
    );
  },
);

test.each([
  "steps:\n  - uses: actions/checkout@v4\n",
  "steps:\n  - uses: actions/checkout@v4 # mutable reference\n",
  "steps:\n  - name: Checkout\n    uses: actions/checkout@v4\n",
  "steps:\n  - name: Checkout\n    uses: actions/checkout@v4 # mutable reference\n",
])(
  "rejects mutable GitHub Action references with optional comments",
  { tags: ["medium"] },
  (workflow) => {
    expect(() => verifyActionReferences(workflow)).toThrow(/full commit SHA/i);
  },
);

test("rejects a modified tool archive checksum", { tags: ["medium"] }, () => {
  expect(() => verifyChecksum("0".repeat(64), "1".repeat(64))).toThrow(
    /checksum mismatch/i,
  );
});

test("rejects an unsupported tool checksum entry", { tags: ["medium"] }, () => {
  expect(() => verifyChecksum("0".repeat(64), "")).toThrow(
    /checksum mismatch/i,
  );
});

test(
  "resolves only the checksum-pinned actionlint platform matrix",
  { tags: ["medium"] },
  () => {
    expect(resolveActionlintRelease("linux", "x64")).toMatchObject({
      archivePlatform: "linux_amd64",
      platform: "linux-x64",
    });
    expect(() => resolveActionlintRelease("win32", "x64")).toThrow(
      /unsupported actionlint platform/i,
    );
  },
);
