import { createHash } from "node:crypto";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { verifyChecksum } from "./verify-static.ts";

const VERSION = "1.7.12";
const CHECKSUMS = {
  "darwin-arm64":
    "aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f",
  "darwin-x64":
    "5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644",
  "linux-arm64":
    "325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6",
  "linux-x64":
    "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8",
} as const;

const platform =
  `${process.platform}-${process.arch}` as keyof typeof CHECKSUMS;
const checksum = CHECKSUMS[platform];
if (checksum === undefined) {
  throw new Error(`Unsupported actionlint platform: ${platform}`);
}
const archivePlatform = `${process.platform}_${process.arch === "x64" ? "amd64" : "arm64"}`;
const archiveName = `actionlint_${VERSION}_${archivePlatform}.tar.gz`;
const response = await fetch(
  `https://github.com/rhysd/actionlint/releases/download/v${VERSION}/${archiveName}`,
);
if (!response.ok) {
  throw new Error(`Failed to download actionlint: HTTP ${response.status}`);
}
const archive = Buffer.from(await response.arrayBuffer());
const actual = createHash("sha256").update(archive).digest("hex");
verifyChecksum(actual, checksum);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "actionlint-"));
const archivePath = join(temporaryDirectory, archiveName);
await writeFile(archivePath, archive);
const extraction = spawnSync(
  "tar",
  ["-xzf", archivePath, "-C", temporaryDirectory],
  {
    encoding: "utf8",
  },
);
if (extraction.status !== 0) {
  throw new Error(`Failed to extract actionlint: ${extraction.stderr}`);
}
const destinationDirectory = ".tools";
await mkdir(destinationDirectory, { recursive: true });
const temporaryBinary = join(
  destinationDirectory,
  `actionlint.tmp-${process.pid}`,
);
await writeFile(
  temporaryBinary,
  await readFile(join(temporaryDirectory, "actionlint")),
);
await chmod(temporaryBinary, 0o755);
await rename(temporaryBinary, join(destinationDirectory, "actionlint"));
process.stdout.write(`Installed actionlint v${VERSION} (${platform})\n`);
