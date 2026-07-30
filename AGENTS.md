# AGENTS.md

## Project

Framework-neutral Node.js/TypeScript application starter managed by kaji.

## Always apply

- Use Node 24.18.1 and npm 11.16.0; do not weaken exact pins or the lockfile.
- Validate external input with Zod at the boundary.
- Write tests first and give every Vitest case exactly one `small`, `medium`, or
  `large` tag.
- Run `make check` before committing code. It is non-destructive and offline
  after `make setup`.
- Keep relative source imports ending in `.ts`; the build rewrites them to
  `.js`.
- Never share `node_modules`, `tools/kaji/.venv`, or `.tools` between worktrees.
- Use Conventional Commits and merge feature branches with `--no-ff`.

## Routing

- TypeScript rules:
  [docs/reference/typescript-standards.md](docs/reference/typescript-standards.md)
- Testing: [docs/dev/testing-convention.md](docs/dev/testing-convention.md)
- kaji lifecycle: [docs/dev/kaji-workflow.md](docs/dev/kaji-workflow.md)
- Worktrees: [docs/dev/git-workflow.md](docs/dev/git-workflow.md)
