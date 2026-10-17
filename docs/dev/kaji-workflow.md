# kaji workflow

The repository owns three workflows under `.kaji/wf/custom/`: GitHub dev,
dev-thorough, and docs. The two development workflows retain the
`review-design -> baseline -> implement` topology and execute
`node scripts/baseline-precheck.ts` directly.

Run GitHub development with:

```bash
./scripts/kaji run .kaji/wf/custom/dev/dev.yaml <issue-id>
```

The optional upstream `review-poll` step is not bundled; teams with an external
review bot may add it, must also port the upstream `issue-close` Step 2.5
approval-evidence check, and must re-run `make validate-workflows`.

## Workflow provenance

The custom workflows were derived from the managed Python starter at commit
`dd80139b7dff3df190c0dabf8279fc6c59b881b4`. Release synchronization compares
them with kaji `v0.23.0`, resolved as
`a52bb3d4dd74d21bb6ebbc4d77d40c57da3b25e0`.

The intentional TypeScript differences are:

- executable workflows are consumer-owned under `.kaji/wf/custom/`;
- the two development workflows retain the upstream step IDs and topology but
  use the agentless TypeScript baseline command
  `node scripts/baseline-precheck.ts`;
- `issue-start` performs worktree-local `make setup` before baseline;
- the optional `review-poll` step is omitted until an external review bot is
  configured; and
- all kaji commands use the project-local `./scripts/kaji` wrapper.

During a managed-starter update, record whether each upstream workflow change is
ported into these files, absorbed by the pinned kaji release, or intentionally
not applicable.

## v0.20.1 synchronization record

| Classification | v0.20.1 change                                                                            | Starter decision                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ported         | The project-local kaji dependency                                                         | Pin `tools/kaji` to `v0.20.1` and refresh its lockfile.                                                                   |
| Ported         | v0.19.0 breaking removal of `inject_verdict`                                              | Remove the deleted field from the fix-skill context-variable documentation.                                               |
| Ported         | Portable custom-workflow validation                                                       | Discover YAML files with `find` rather than Bash `globstar`, which macOS Bash 3.2 does not support.                       |
| Starter repair | Baseline worktree identity and toolchain availability                                     | Compare canonical worktree paths on macOS and pin the kaji tool Python to available exact version `3.13.13`.              |
| Absorbed       | Herdr interactive-terminal support and recovery behavior in the kaji harness              | The pinned CLI supplies these capabilities; no starter-owned code is copied.                                              |
| Not applicable | Upstream's `dev-thorough-codex`, `docs-fable`, and repository-specific Herdr skill wiring | This starter owns its custom workflows and keeps the headless default; it does not vendor upstream workflow/model policy. |

## v0.21.0 synchronization record

| Classification | v0.21.0 change                                                                                                           | Starter decision                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ported         | The project-local kaji dependency                                                                                        | Pin `tools/kaji` to `v0.21.0` and refresh its lockfile.                                                                                                       |
| Ported         | Baseline commands pass the target worktree explicitly because agent steps get no `KAJI_WORKTREE_DIR` (#430)              | `scripts/baseline-precheck.ts --validate` accepts `--worktree` / `--issue`; the skills and baseline docs pass them; a medium test covers a `KAJI_*`-free run. |
| Ported         | Local provider deprecation with a stderr warning (#438)                                                                  | `README.md` noted the deprecation next to the local workflow; the local workflows were later removed with kaji v0.23.0.                                       |
| Absorbed       | `kaji issue resolve-verdict` falls back to run artifacts, exit code 7 (#426)                                             | The pinned CLI supplies this; no starter-owned code or skill text changes.                                                                                    |
| Absorbed       | Configurable `[incident]` labels with `kaji:` default names (#434)                                                       | Handled by the pinned harness. The starter ships no `[incident]` section or label file, and incident recording is fail-open.                                  |
| Not applicable | `dev-small` workflow, `issue-small-change-*` skills, and the matching `i-pr` / `review` text (#427)                      | Trial workflow that upstream does not publish to starters.                                                                                                    |
| Not applicable | starter-sync tracking schema, `kaji starter` CLI, and the update/review/release starter skills and runbook (#423)        | Maintainer-only; never copied into a starter.                                                                                                                 |
| Not applicable | Official workflow model and effort changes (#436) and upstream `dev-thorough` model IDs                                  | This starter owns its custom workflows and does not vendor upstream model policy.                                                                             |
| Not applicable | Upstream-only `.kaji/config.toml` `[incident]` override, `.github/labels.yml`, CHANGELOG, design docs, and harness tests | Repository-specific to kaji; the starter has no counterpart asset.                                                                                            |

## v0.22.0 and v0.23.0 synchronization record

kaji v0.22.0 and v0.23.0 were synchronized together as one batch from the
`kaji-v0.21.0` snapshot.

| Classification | Change                                                                                                                                                       | Starter decision                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ported         | The project-local kaji dependency                                                                                                                            | Pin `tools/kaji` to `v0.23.0` and refresh its lockfile.                                                                                                                                                                                                                                               |
| Ported         | v0.23.0 breaking removal of the local provider (#448)                                                                                                        | Delete `dev-local.yaml` / `docs-local.yaml`, `scripts/dogfood-local`, its Makefile target and contract test, and `.kaji/issues/`; drop local-provider branches and local Issue IDs from the skills; accept only `github` in `baseline-precheck.ts`; expect three custom workflows in `verify-static`. |
| Ported         | Attempt deadline across prompts and runners (#421)                                                                                                           | `issue-implement` gains the Step 1.5 pre-deadline checkpoint; `issue-design` / `issue-review-design` gain the long-running acceptance placement rule; `shared-skill-rules.md` summarizes both.                                                                                                        |
| Ported         | Attempt-local `tmp/kaji/` and `TMPDIR` / `TMP` / `TEMP` injection (#407)                                                                                     | Ignore `tmp/` in Git and ESLint so attempt directories never dirty the worktree or the quality gate.                                                                                                                                                                                                  |
| Ported         | Codex steps require `.agents/skills/<skill>/SKILL.md` (#408)                                                                                                 | The starter already ships one symlink per skill and `verify-static` enforces it; `shared-skill-rules.md` now states the preflight requirement.                                                                                                                                                        |
| Absorbed       | `[paths].design_dir` and `kaji config design-dir` (#397)                                                                                                     | The pinned CLI supplies it; the starter keeps the default `draft/design` and ships no kaji configuration reference.                                                                                                                                                                                   |
| Absorbed       | Codex `$<skill>` invocation, resume sandbox argument, step-scoped verdict comment fallback, Herdr launcher test, runner split (#408, #458, #449, #465, #474) | Handled by the pinned harness; no starter-owned asset changes.                                                                                                                                                                                                                                        |
| Absorbed       | tmux interactive terminal backend deprecation warning (#475)                                                                                                 | The starter config uses `agent_runner = "headless"` and its docs never mention tmux, so it is unaffected.                                                                                                                                                                                             |
| Not applicable | `review-poll` head-SHA approval evidence, `codex-review-state:v1`, and `issue-close` Step 2.5 (#429, #473)                                                   | The starter does not bundle `review-poll`; teams that add it must port Step 2.5 too.                                                                                                                                                                                                                  |
| Not applicable | `dev-small` completion-criteria guard (#444) and incident skills following `[incident] kind_label` (#457)                                                    | The starter ships neither `dev-small` nor incident skills.                                                                                                                                                                                                                                            |
| Not applicable | Official workflow model assignments (#480), upstream custom workflows, series files, labels, CHANGELOG, design docs, and harness tests                       | Repository-specific to kaji; this starter owns its workflows and does not vendor upstream model policy.                                                                                                                                                                                               |
| Not applicable | starter-sync maintainer skills and runbook                                                                                                                   | Maintainer-only; never copied into a starter.                                                                                                                                                                                                                                                         |
