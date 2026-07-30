import { z } from "zod";
import { parse } from "yaml";

const packagePolicySchema = z.object({
  engines: z.object({ node: z.literal(">=24.12 <25") }),
  packageManager: z.literal("npm@11.16.0"),
  devEngines: z.object({
    runtime: z.object({
      name: z.literal("node"),
      version: z.literal("24.18.1"),
      onFail: z.literal("error"),
    }),
    packageManager: z.object({
      name: z.literal("npm"),
      version: z.literal("11.16.0"),
      onFail: z.literal("error"),
    }),
  }),
  allowScripts: z.record(z.string(), z.literal(true)),
});

const REQUIRED_NPM_SETTINGS = {
  "allow-scripts-pin": "true",
  "engine-strict": "true",
  "strict-allow-scripts": "true",
  "strict-peer-deps": "true",
} as const;

export function verifyPackagePolicy(
  packageJson: unknown,
  npmSettings: Readonly<Record<string, string>>,
): void {
  const parsed = packagePolicySchema.parse(packageJson);
  const approvedScripts = Object.keys(parsed.allowScripts);
  if (approvedScripts.length === 0) {
    throw new Error("allowScripts must approve audited exact package versions");
  }
  for (const packageSpec of approvedScripts) {
    if (!/@\d+\.\d+\.\d+$/.test(packageSpec)) {
      throw new Error(
        `allowScripts entry is not version-pinned: ${packageSpec}`,
      );
    }
  }
  for (const [setting, expected] of Object.entries(REQUIRED_NPM_SETTINGS)) {
    if (npmSettings[setting] !== expected) {
      throw new Error(
        `Required npm setting is missing or disabled: ${setting}`,
      );
    }
  }
}

export function verifyActionReferences(workflow: string): void {
  const referencePattern = /^\s*-\s+uses:\s*([^\s#]+)\s*$/gm;
  for (const match of workflow.matchAll(referencePattern)) {
    const reference = match[1];
    if (reference === undefined || reference.startsWith("./")) {
      continue;
    }
    const separator = reference.lastIndexOf("@");
    const revision = separator === -1 ? "" : reference.slice(separator + 1);
    if (!/^[0-9a-f]{40}$/i.test(revision)) {
      throw new Error(`GitHub Action must use a full commit SHA: ${reference}`);
    }
  }
}

export function verifyChecksum(actual: string, expected: string): void {
  if (!/^[0-9a-f]{64}$/.test(expected) || actual !== expected) {
    throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  }
}

const FORBIDDEN_CONSUMER_TERMS = [
  ".kaji/wf/official/",
  ".venv/bin/",
  "pytest",
  "ruff",
  "mypy",
  "uv run kaji",
  "known_failures",
  "--compare",
  "verdict: ok",
] as const;

export function verifyConsumerText(filename: string, text: string): void {
  for (const forbidden of FORBIDDEN_CONSUMER_TERMS) {
    if (text.includes(forbidden)) {
      throw new Error(
        `Forbidden consumer vocabulary ${forbidden}: ${filename}`,
      );
    }
  }
}

export function verifySkillMetadata(name: string, text: string): void {
  const frontmatter = parse(text.split("---", 3)[1] ?? "") as {
    name?: string;
  };
  if (frontmatter.name !== name) {
    throw new Error(`Skill frontmatter does not match directory: ${name}`);
  }
}

export function verifyTemplateIdentity(
  packageName: string | undefined,
  repository: string,
): void {
  const pristinePackage = packageName === "starter-app";
  const pristineRepository = repository === "apokamo/starter-app";
  if (pristinePackage !== pristineRepository) {
    throw new Error("Template identity is only partially customized");
  }
}
