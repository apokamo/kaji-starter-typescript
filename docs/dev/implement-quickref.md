# Implementation quick reference

- Treat the approved design as the implementation contract.
- Resolve and work only in the Issue worktree.
- Validate the clean baseline artifact before editing runtime code.
- Write one-tag Vitest tests first and observe Red before Green.
- Run `make check`, commit only Issue-scope files, then perform the pre-handoff
  review and post the implementation report.

See [Testing convention](testing-convention.md),
[Baseline check](baseline-check.md), and
[Workflow completion criteria](workflow-completion-criteria.md).
