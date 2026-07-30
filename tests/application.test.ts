import { expect, test, vi } from "vitest";

import { main, processOutput, runApplication } from "../src/index.ts";

test("returns stdout for a valid configuration", { tags: ["small"] }, () => {
  expect(runApplication({ APP_MESSAGE: "ready" })).toEqual({
    exitCode: 0,
    stderr: "",
    stdout: "ready\n",
  });
});

test(
  "returns sanitized stderr for an invalid configuration",
  { tags: ["small"] },
  () => {
    const secret = "secret-" + "x".repeat(200);
    const result = runApplication({ APP_MESSAGE: secret });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("APP_MESSAGE");
    expect(result.stderr).not.toContain(secret);
    expect(result.stdout).toBe("");
  },
);

test(
  "adapts application output to process streams",
  { tags: ["small"] },
  () => {
    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    processOutput.writeStdout("out");
    processOutput.writeStderr("err");
    expect(stdout).toHaveBeenCalledWith("out");
    expect(stderr).toHaveBeenCalledWith("err");
    stdout.mockRestore();
    stderr.mockRestore();
  },
);

test.each([
  [{ APP_MESSAGE: "ready" }, 0, ["ready\n"], []],
  [{ APP_MESSAGE: "" }, 1, [], ["Invalid APP_MESSAGE: must be non-empty\n"]],
])(
  "writes the application result to the selected stream",
  { tags: ["small"] },
  (environment, exitCode, expectedStdout, expectedStderr) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    expect(
      main(environment, {
        writeStderr: (value) => stderr.push(value),
        writeStdout: (value) => stdout.push(value),
      }),
    ).toBe(exitCode);
    expect(stdout).toEqual(expectedStdout);
    expect(stderr).toEqual(expectedStderr);
  },
);
