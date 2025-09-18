# Repository Guidelines

## Project Structure & Module Organization
- Source is organized as an Nx monorepo.
- Apps: `apps/hanzo-desktop` (Tauri + Vite desktop app).
- Libraries: `libs/hanzo-*` (shared UI, state, i18n, etc.).
- Assets & docs: `assets/`, `docs/`. CI and helper scripts: `ci-scripts/`, `scripts/`.
- Build outputs: `dist/`.

## Build, Test, and Development Commands
- Install: use Node 20+ and pnpm. Example: `pnpm install` (root) or `pnpm -C apps/hanzo-desktop install`.
- Dev (desktop): `make dev` or `pnpm -C apps/hanzo-desktop tauri dev`.
- Build (desktop): `make build` or `pnpm -C apps/hanzo-desktop tauri build`.
- Icons: `make icons` (invokes `generate_hanzo_icons.py`).
- Lint/Format: `make lint`, `make format` (ESLint/Prettier).
- Env check: `make check-env` (verifies Node, pnpm, Rust, Python).
- Unit tests: `npm run test:contrast` (example Vitest suite) or `npx vitest`.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; UTF-8; trim trailing whitespace (see `.editorconfig`).
- Formatting: Prettier (single quotes, Tailwind plugin). Run `make format`.
- Linting: ESLint with React, Hooks, Import ordering, and Nx boundaries. Run `make lint`.
- TypeScript: prefer `import type { X }` and inline type imports.
- Filenames: kebab-case for files; PascalCase for React components; `.test.ts(x)` for tests co-located with source.

## Testing Guidelines
- Framework: Vitest. Example test: `libs/hanzo-ui/src/utils/contrast.test.ts`.
- Naming: `*.test.ts`/`*.test.tsx`. Group related specs with `describe` and use focused, deterministic `it` blocks.
- Run: `npm run test:contrast` for targeted tests; `npx vitest` for broader runs.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (e.g., `feat:`, `fix:`, `ci:`). Optional scope allowed (e.g., `fix(desktop): ...`).
- PRs: include a concise description, linked issues, and screenshots/GIFs for UI changes. Note any Make targets used (`make build`, `make icons`). Ensure lint/tests pass.

## Security & Configuration Tips
- Desktop builds require Rust/Cargo and Tauri. Verify with `make check-env`.
- Keep secrets out of the repo. Use environment variables and do not commit `.local` files.
