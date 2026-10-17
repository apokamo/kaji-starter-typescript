.PHONY: setup check lint format fmt typecheck test test-small test-medium test-large coverage build validate-workflows verify-docs verify-static

setup:
	npm ci
	uv sync --project tools/kaji --locked
	node scripts/setup-tools.ts

check: format lint typecheck
	npm run audit:tags
	$(MAKE) coverage
	$(MAKE) build
	$(MAKE) validate-workflows
	$(MAKE) verify-static

lint:
	npm run lint

format:
	npm run format:check

fmt:
	npm run format:write

typecheck:
	npm run typecheck

test:
	npm test

test-small:
	npm run test:small

test-medium:
	npm run test:medium

test-large:
	npm run test:large

coverage:
	npm run coverage

build:
	npm run build

validate-workflows:
	UV_OFFLINE=1 ./scripts/kaji validate

verify-docs:
	node scripts/check-doc-links.ts

verify-static: verify-docs
	npm run verify:static
