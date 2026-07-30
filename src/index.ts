import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.ts";

export interface ApplicationResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

export interface ApplicationOutput {
  writeStderr(value: string): void;
  writeStdout(value: string): void;
}

export const processOutput: ApplicationOutput = {
  writeStderr: (value) => process.stderr.write(value),
  writeStdout: (value) => process.stdout.write(value),
};

export function runApplication(
  environment: Readonly<Record<string, string | undefined>>,
): ApplicationResult {
  const config = loadConfig(environment);
  if (!config.ok) {
    return {
      exitCode: 1,
      stderr: `${config.error}\n`,
      stdout: "",
    };
  }
  return {
    exitCode: 0,
    stderr: "",
    stdout: `${config.value.message}\n`,
  };
}

export function main(
  environment: Readonly<Record<string, string | undefined>>,
  output: ApplicationOutput,
): number {
  const result = runApplication(environment);
  if (result.stdout !== "") {
    output.writeStdout(result.stdout);
  }
  if (result.stderr !== "") {
    output.writeStderr(result.stderr);
  }
  return result.exitCode;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main(process.env, processOutput);
}
