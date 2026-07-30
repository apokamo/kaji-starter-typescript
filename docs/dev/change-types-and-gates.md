# Change types and quality gates

Runtime behavior changes use Red → Green → Refactor and permanent tagged tests.
Documentation-only changes use the deterministic documentation link gate.
Metadata and packaging changes use the closest static or build verification.

Every code change must pass `make check` before commit. Do not weaken a gate or
add a skip because a local tool is missing; run `make setup` in that worktree.
