# Shared skill rules

Consumer skills use `./scripts/kaji` as the only kaji entry point and refer to
the starter-owned workflows under `.kaji/wf/custom/`. They validate the
clean-only TypeScript baseline with
`node scripts/baseline-precheck.ts --worktree [worktree_dir] --issue [issue_id] --validate`
and use `make check` as the pre-commit quality gate.

Skills must not assume a root Python project, a shared dependency directory, or
known-failure baseline comparison. Worktree paths are resolved absolutely from
the Issue metadata.

Agent steps run under a hard attempt deadline exposed as `attempt_deadline_utc`
and `step_timeout_seconds`. Long-running skills check the remaining time, finish
external side effects first, and save the verdict last; `issue-implement` Step
1.5 owns the pre-deadline checkpoint, and `issue-design` / `issue-review-design`
own the long-running acceptance placement rule.

Every skill used by a Codex step needs `.agents/skills/<skill>/SKILL.md`;
`kaji run` and `kaji validate` preflight reject a missing link. Keep one
`.agents/skills/<skill>` symlink per `.claude/skills/<skill>` directory, which
`make verify-static` enforces.
