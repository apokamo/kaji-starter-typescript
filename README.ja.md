# kaji TypeScript Starter

kaji workflow、typed lint、Vitest S/M/L
test、coverage を接続した、framework 非依存の Node.js/TypeScript application
starter です。

## 開始手順

1. **Use this template** で repository を作成します。
2. Node 24.18.1 / npm 11.16.0 を選択します。
3. `make setup && make check` を実行します。
4. `package.json` の `starter-app` と `.kaji/config.toml`
   の owner/name をまとめて変更します。
5. 必要なら `npm run set-agent -- codex` を実行します。

未変更の `starter-app` でも `npm run dev`、`npm run build`、`npm start`
が動作します。kaji は常に `./scripts/kaji` から起動してください。

[ドキュメント索引](docs/README.md)も参照してください。
