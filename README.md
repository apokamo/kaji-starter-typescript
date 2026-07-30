# kaji TypeScript Starter

Application-first, framework-neutral Node.js/TypeScript starter with kaji
workflows, typed linting, Vitest S/M/L tests, coverage, and reproducible tools.

## Start

1. Create a repository with **Use this template**.
2. Select Node 24.18.1 and npm 11.16.0.
3. Run `make setup && make check`.
4. Rename `starter-app` in `package.json` and update the repository owner/name
   in `.kaji/config.toml` together.
5. Optionally run `npm run set-agent -- codex` and commit the workflow changes.

The pristine `starter-app` identity is valid and immediately runnable:

```bash
npm run dev
npm run build
npm start
```

Use `./scripts/kaji` for every kaji command. GitHub development uses
`.kaji/wf/custom/dev/dev.yaml`; local trials use
`.kaji/wf/custom/local/dev-local.yaml` after `./scripts/kaji local init`.

See the [documentation index](docs/README.md) and
[Japanese README](README.ja.md). Report starter problems in the
[kaji issue tracker](https://github.com/apokamo/kaji/issues).
