# Testing convention

Every effective Vitest test has exactly one tag:

- `small`: pure logic without process, filesystem, or network.
- `medium`: temporary filesystem, subprocess stubs, or internal integration.
- `large`: real local process or end-to-end behavior. Permanent large tests
  require no network, credentials, or agent CLI.

`make test-small`, `make test-medium`, and `make test-large` select the same
corpus. `make coverage` runs all three and enforces 80% for statements,
branches, functions, and lines in `src/**/*.ts`.
