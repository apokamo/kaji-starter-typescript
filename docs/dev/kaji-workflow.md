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
