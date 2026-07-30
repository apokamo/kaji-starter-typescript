import { spawn, spawnSync } from "node:child_process";

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
  "starts watch mode and terminates within a bounded smoke test",
  { tags: ["large"] },
  async () => {
    const child = spawn(process.execPath, ["--watch", "src/index.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, APP_MESSAGE: "watch-ready" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`watch output timed out: ${stdout} ${stderr}`));
      }, 5_000);
      child.stdout.on("data", () => {
        if (stdout.includes("watch-ready")) {
          clearTimeout(timeout);
          child.kill("SIGTERM");
          resolve();
        }
      });
      child.once("error", reject);
    });
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    expect(stdout).toContain("watch-ready");
    expect(stderr).toBe("");
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

test(
  "starts the clean production build with the same application contract",
  { tags: ["large"] },
  () => {
    const build = spawnSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(build.status, build.stderr).toBe(0);
    const start = spawnSync("npm", ["start"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, APP_MESSAGE: "built-ready" },
      timeout: 10_000,
    });
    expect(start.status).toBe(0);
    expect(start.stdout).toContain("built-ready");
    expect(start.stderr).toBe("");
  },
);
