import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "vitest";

test(
  "delegates arguments and exit status through the locked tools/kaji project",
  { tags: ["medium"] },
  () => {
    const directory = mkdtempSync(path.join(tmpdir(), "kaji-wrapper-"));
    const capture = path.join(directory, "arguments.txt");
    const uv = path.join(directory, "uv");
    writeFileSync(
      uv,
      `#!/usr/bin/env bash\nprintf '%s\\n' "$@" >"${capture}"\nexit 23\n`,
      "utf8",
    );
    chmodSync(uv, 0o755);
    const result = spawnSync("./scripts/kaji", ["issue", "view", "391"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
    });
    expect(result.status).toBe(23);
    expect(readFileSync(capture, "utf8").split("\n")).toEqual([
      "run",
      "--project",
      "tools/kaji",
      "--locked",
      "--offline",
      "kaji",
      "issue",
      "view",
      "391",
      "",
    ]);
  },
);
