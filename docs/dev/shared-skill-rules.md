# Shared skill rules

Consumer skills use `./scripts/kaji` as the only kaji entry point and refer to
the starter-owned workflows under `.kaji/wf/custom/`. They validate the
clean-only TypeScript baseline with
`node scripts/baseline-precheck.ts --worktree [worktree_dir] --issue [issue_id] --validate`
and use `make check` as the pre-commit quality gate.

Skills must not assume a root Python project, a shared dependency directory, or
known-failure baseline comparison. Worktree paths are resolved absolutely from
the Issue metadata.
