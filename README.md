# hanzoai/app

[![Open in Hanzo](https://hanzo.app/badges/open-in-hanzo.svg)](https://hanzo.app/dev/open?repo=github.com/hanzoai/app&ref=main&action=open) [![Edit with Hanzo](https://hanzo.app/badges/edit-with-hanzo.svg)](https://hanzo.app/dev/open?repo=github.com/hanzoai/app&ref=main&action=edit) [![Deploy with Hanzo](https://hanzo.app/badges/deploy-with-hanzo.svg)](https://hanzo.app/dev/open?repo=github.com/hanzoai/app&ref=main&action=deploy)

Hanzo's app SDK, one package per directory under `pkg/`:

- `pkg/app` — **@hanzo/app**, the shell and the first-party apps every Hanzo
  host draws (hanzo.ai, hanzo.team, Hanzo Desktop).

`pnpm install`, then `pnpm typecheck`, `pnpm lint:design`, `pnpm test` and
`pnpm build` run over every package. A package ships to npm when its
`package.json` names a version npm does not serve (`.github/workflows/publish.yml`).
