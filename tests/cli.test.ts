import { spawnSync } from "node:child_process";

import { expect, test } from "vitest";

test(
  "runs the TypeScript entry point with native type stripping",
  { tags: ["large"] },
  () => {
    const result = spawnSync(process.execPath, ["src/index.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, APP_MESSAGE: "native-ready" },
      timeout: 10_000,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("native-ready\n");
    expect(result.stderr).toBe("");
  },
);

test(
  "fails without exposing an invalid configuration value",
  { tags: ["large"] },
  () => {
    const secret = "secret-" + "x".repeat(200);
    const result = spawnSync(process.execPath, ["src/index.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, APP_MESSAGE: secret },
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("APP_MESSAGE");
    expect(result.stderr).not.toContain(secret);
  },
);
