import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { expect, test } from "vitest";

test(
  "build removes stale output and rewrites relative TypeScript imports",
  { tags: ["medium"] },
  () => {
    mkdirSync("dist", { recursive: true });
    writeFileSync("dist/stale.js", "stale\n", "utf8");
    const result = spawnSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync("dist/stale.js")).toBe(false);
    expect(readFileSync("dist/index.js", "utf8")).toContain(
      'from "./config.js"',
    );
    expect(existsSync("dist/tests")).toBe(false);
  },
);
