# kaji workflow

The repository owns five workflows under `.kaji/wf/custom/`: GitHub dev,
dev-thorough, docs, and local dev/docs. The three development workflows retain
the `review-design -> baseline -> implement` topology and execute
`node scripts/baseline-precheck.ts` directly.

Run GitHub development with:

```bash
./scripts/kaji run .kaji/wf/custom/dev/dev.yaml <issue-id>
```

Run `./scripts/kaji local init` before selecting a local workflow. The optional
upstream `review-poll` step is not bundled; teams with an external review bot
may add it and must re-run `make validate-workflows`.

## Workflow provenance

The five custom workflows were derived from the managed Python starter at commit
`dd80139b7dff3df190c0dabf8279fc6c59b881b4`. Release synchronization compares
them with kaji `v0.21.0`, resolved as
`a03c53bb35784c391bed612d61847091b7fe1b6d`.

The intentional TypeScript differences are:

- executable workflows are consumer-owned under `.kaji/wf/custom/`;
- the three development workflows retain the upstream step IDs and topology but
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
| Ported         | Local provider deprecation with a stderr warning (#438)                                                                  | `README.md` notes the deprecation next to the local workflow; `dev-local.yaml` is kept.                                                                       |
| Absorbed       | `kaji issue resolve-verdict` falls back to run artifacts, exit code 7 (#426)                                             | The pinned CLI supplies this; no starter-owned code or skill text changes.                                                                                    |
| Absorbed       | Configurable `[incident]` labels with `kaji:` default names (#434)                                                       | Handled by the pinned harness. The starter ships no `[incident]` section or label file, and incident recording is fail-open.                                  |
| Not applicable | `dev-small` workflow, `issue-small-change-*` skills, and the matching `i-pr` / `review` text (#427)                      | Trial workflow that upstream does not publish to starters.                                                                                                    |
| Not applicable | starter-sync tracking schema, `kaji starter` CLI, and the update/review/release starter skills and runbook (#423)        | Maintainer-only; never copied into a starter.                                                                                                                 |
| Not applicable | Official workflow model and effort changes (#436) and upstream `dev-thorough` model IDs                                  | This starter owns its custom workflows and does not vendor upstream model policy.                                                                             |
| Not applicable | Upstream-only `.kaji/config.toml` `[incident]` override, `.github/labels.yml`, CHANGELOG, design docs, and harness tests | Repository-specific to kaji; the starter has no counterpart asset.                                                                                            |
