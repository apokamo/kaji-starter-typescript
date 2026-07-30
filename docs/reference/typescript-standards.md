# TypeScript standards

Use ESM and NodeNext with Node native type stripping. Source-relative imports
end in `.ts`; `rewriteRelativeImportExtensions` produces `.js` imports for the
build. Keep strict compiler options enabled, especially `erasableSyntaxOnly`,
`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, and
`exactOptionalPropertyTypes`.

TypeScript 6.0.3 is pinned because typescript-eslint 8.65.0 supports TypeScript
below 6.1 and compiler API consumers cannot use the TypeScript 7 native port
directly. A side-by-side `@typescript/typescript6` alias adds two compiler
identities and update complexity, so the initial starter does not use it.

Validate `process.env`, JSON, CLI arguments, and API responses with Zod. Do not
log secrets or raw invalid values.
