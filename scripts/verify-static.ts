import { lstatSync, realpathSync } from "node:fs";

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
  const referencePattern = /^\s*(?:-\s+)?uses:\s*([^\s#]+)(?:\s+#.*)?\s*$/gm;
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

// uv 0.9.27 has no managed download for CPython 3.13.13; 0.13.1 does. Update
// both values together after checking `uv python list <python> --all-versions`.
export const VERIFIED_PYTHON_TOOLCHAIN = {
  uv: "0.13.1",
  python: "3.13.13",
} as const;

export function verifyPythonToolchain(
  ciWorkflow: string,
  pythonVersion: string,
): void {
  const workflow = parse(ciWorkflow) as {
    jobs?: Record<
      string,
      { steps?: Array<{ uses?: string; with?: { version?: unknown } }> }
    >;
  };
  const setupUvSteps = Object.values(workflow.jobs ?? {})
    .flatMap((job) => job.steps ?? [])
    .filter((step) => step.uses?.startsWith("astral-sh/setup-uv@") === true);
  if (setupUvSteps.length === 0) {
    throw new Error("CI contract missing: astral-sh/setup-uv");
  }
  for (const step of setupUvSteps) {
    if (step.with?.version !== VERIFIED_PYTHON_TOOLCHAIN.uv) {
      throw new Error(
        `CI uv version must be ${VERIFIED_PYTHON_TOOLCHAIN.uv}, got ${String(step.with?.version)}`,
      );
    }
  }
  if (pythonVersion.trim() !== VERIFIED_PYTHON_TOOLCHAIN.python) {
    throw new Error(
      `tools/kaji/.python-version must be ${VERIFIED_PYTHON_TOOLCHAIN.python}, got ${pythonVersion.trim()}`,
    );
  }
}

export function verifyChecksum(actual: string, expected: string): void {
  if (!/^[0-9a-f]{64}$/.test(expected) || actual !== expected) {
    throw new Error(`Checksum mismatch: expected ${expected}, got ${actual}`);
  }
}

const FORBIDDEN_CONSUMER_PATTERNS = [
  { label: ".kaji/wf/official/", pattern: /\.kaji\/wf\/official\// },
  { label: ".venv/bin/", pattern: /\.venv\/bin\// },
  { label: "pytest", pattern: /\bpytest\b/i },
  { label: "ruff", pattern: /\bruff\b/i },
  { label: "mypy", pattern: /\bmypy\b/i },
  { label: "uv run kaji", pattern: /\buv run kaji\b/ },
  { label: "direct Python module invocation", pattern: /\buv run python\b/ },
  { label: "known_failures", pattern: /\bknown_failures\b/ },
  { label: "--compare", pattern: /--compare\b/ },
  { label: "verdict: ok", pattern: /verdict:\s*ok\b/i },
  { label: "@Vitest.mark", pattern: /@Vitest\.mark\./ },
  { label: "Python temporary fixture", pattern: /\btmp_path\b/ },
  { label: "Python import error", pattern: /\bImportError\b/ },
  { label: "pytest coverage flag", pattern: /--cov(?:=|\b)/ },
  { label: "pytest name filter", pattern: /\bnpm test\b[^\n]*\s-k(?:\s|$)/ },
  { label: "pip install", pattern: /\bpip install\b/ },
  {
    label: "Python link checker",
    pattern: /\bpython3\s+scripts\/check[_-]doc[_-]links\.py\b/,
  },
  {
    label: "Python source or test path",
    pattern: /\b(?:src|tests)\/[A-Za-z0-9_./-]+\.py\b/,
  },
  {
    label: "kaji Python implementation path",
    pattern: /\b(?:prompt|verdict|cli_main)\.py\b/,
  },
  { label: "Python runtime library", pattern: /\b(?:Pydantic|typer)\b/ },
] as const;

export function verifyConsumerText(filename: string, text: string): void {
  for (const forbidden of FORBIDDEN_CONSUMER_PATTERNS) {
    if (forbidden.pattern.test(text)) {
      throw new Error(
        `Forbidden consumer vocabulary ${forbidden.label}: ${filename}`,
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

export function verifyAgentSkillSymlink(
  name: string,
  entry: string,
  expectedTarget: string,
): void {
  let isSymbolicLink: boolean;
  try {
    isSymbolicLink = lstatSync(entry).isSymbolicLink();
  } catch (error) {
    throw new Error(`Missing agent skill symlink: ${name}`, { cause: error });
  }
  if (!isSymbolicLink) {
    throw new Error(`Agent skill entry is not a symlink: ${name}`);
  }
  let actualTarget: string;
  try {
    actualTarget = realpathSync(entry);
  } catch (error) {
    throw new Error(`Broken agent skill symlink: ${name}`, { cause: error });
  }
  if (actualTarget !== realpathSync(expectedTarget)) {
    throw new Error(`Agent skill symlink targets the wrong path: ${name}`);
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
