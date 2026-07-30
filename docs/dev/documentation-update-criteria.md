# Documentation update criteria

Update public documentation when a command, configuration key, workflow path,
quality requirement, setup prerequisite, or user-visible error changes. Keep
English as the source and update the Japanese counterpart in the same change.

Internal refactors that preserve those contracts do not require artificial
documentation churn. `make verify-docs` checks README files, agent instructions,
`docs/`, and consumer skills for broken local links.
