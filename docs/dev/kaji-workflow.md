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
them with kaji `v0.20.1`, resolved as
`9f85c86f9ae776956f7f4f65e7488d90034fbb98`.

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
