# TypeScript baseline

The baseline step validates runner environment with Zod, measures the feature
worktree with Vitest JSON output, and atomically writes schema-v1
`.kaji-artifacts/baseline/baseline.json`. Only a non-empty, internally
consistent, fully passing corpus is `clean`/`PASS`. Test failures are `blocked`;
guard, command, schema, or summary failures are `invalid`. Both stop
implementation.

Later skills call `node scripts/baseline-precheck.ts --validate` and require the
clean artifact's issue/branch to match and measured commit to be an ancestor.
Validation mode is read-only: it does not post baseline evidence or write the
calling step's `KAJI_VERDICT_PATH`. The calling skill owns its verdict and saves
it only after that step's required external side effects are complete.
