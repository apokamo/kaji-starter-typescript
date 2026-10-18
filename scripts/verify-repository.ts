import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { parse } from "yaml";

import {
  verifyActionReferences,
  verifyAgentSkillSymlink,
  verifyConsumerText,
  verifyPackagePolicy,
  verifyPythonToolchain,
  verifySkillMetadata,
  verifyTemplateIdentity,
} from "./verify-static.ts";

function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, "utf8"));
}

function readNpmSettings(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(".npmrc", "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split("=", 2) as [string, string]),
  );
}

verifyPackagePolicy(readJson("package.json"), readNpmSettings());
const lock = readJson("package-lock.json") as {
  lockfileVersion?: number;
  packages?: Record<string, { hasInstallScript?: boolean; version?: string }>;
};
if (lock.lockfileVersion !== 3)
  throw new Error("package-lock.json must use lockfileVersion 3");
const packageJson = readJson("package.json") as {
  allowScripts?: Record<string, boolean>;
  name?: string;
};
for (const [location, metadata] of Object.entries(lock.packages ?? {})) {
  if (metadata.hasInstallScript === true) {
    const name = location.replace(/^node_modules\//, "");
    if (packageJson.allowScripts?.[`${name}@${metadata.version}`] !== true) {
      throw new Error(`Unapproved install script: ${name}@${metadata.version}`);
    }
  }
}

const workflowRoot = ".kaji/wf/custom";
const workflowFiles = readdirSync(workflowRoot, { recursive: true })
  .filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.endsWith(".yaml"),
  )
  .map((entry) => path.join(workflowRoot, entry))
  .sort();
if (workflowFiles.length !== 3)
  throw new Error(`Expected 3 custom workflows, got ${workflowFiles.length}`);
for (const filename of workflowFiles) {
  const source = readFileSync(filename, "utf8");
  const workflow = parse(source) as {
    steps?: Array<{ exec?: string[]; skill?: string }>;
  };
  verifyActionReferences(source);
  for (const step of workflow.steps ?? []) {
    if (step.skill !== undefined) {
      const skillPath = path.join(".claude/skills", step.skill, "SKILL.md");
      if (!lstatSync(skillPath).isFile())
        throw new Error(`Missing workflow skill: ${step.skill}`);
    }
  }
}
const ci = readFileSync(".github/workflows/ci.yml", "utf8");
verifyActionReferences(ci);
verifyPythonToolchain(ci, readFileSync("tools/kaji/.python-version", "utf8"));
for (const required of [
  "permissions:",
  "contents: read",
  "persist-credentials: false",
  "npm",
  "make check",
]) {
  if (!ci.includes(required))
    throw new Error(`CI contract missing: ${required}`);
}
for (const name of readdirSync(".claude/skills")) {
  const entry = path.join(".agents/skills", name);
  const expectedTarget = path.join(".claude/skills", name);
  verifyAgentSkillSymlink(name, entry, expectedTarget);
  const skillPath = path.join(".claude/skills", name, "SKILL.md");
  try {
    const skill = readFileSync(skillPath, "utf8");
    verifySkillMetadata(name, skill);
  } catch (error) {
    if (name !== "_shared") throw error;
  }
}
const consumerRoots = [
  "README.md",
  "README.ja.md",
  "AGENTS.md",
  "CLAUDE.md",
  "docs",
  ".claude/skills",
];
for (const root of consumerRoots) {
  const candidates = lstatSync(root).isDirectory()
    ? readdirSync(root, { recursive: true })
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => path.join(root, entry))
    : [root];
  for (const filename of candidates) {
    if (lstatSync(filename).isFile()) {
      const text = readFileSync(filename, "utf8");
      verifyConsumerText(filename, text);
    }
  }
}
const repository =
  readFileSync(".kaji/config.toml", "utf8").match(
    /repo\s*=\s*"([^"]+)"/,
  )?.[1] ?? "";
verifyTemplateIdentity(packageJson.name, repository);
execFileSync(".tools/actionlint", [".github/workflows/ci.yml"], {
  stdio: "inherit",
});
process.stdout.write("Repository static contracts valid\n");
