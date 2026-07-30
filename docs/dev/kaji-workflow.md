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
them with kaji `v0.18.0`, resolved as
`3245248bc5fb18d358d7b0922362c3483876947d`.

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
