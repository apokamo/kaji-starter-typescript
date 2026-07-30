# Git and worktrees

Create feature changes in a worktree and merge with `--no-ff`. `issue-start`
runs `make setup` in each new worktree. Do not symlink `node_modules`,
`tools/kaji/.venv`, or `.tools` from another checkout.
