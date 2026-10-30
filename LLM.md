# @hanzo/app

The workspace rooms — Home, Chat, Inbox, Contacts, Meet, Cal, Drive, Board,
Work, Bots, Settings — and the frame that holds them (Room, Shell,
Orgs), once, for every surface. hanzo.ai and hanzo.team import them; neither
keeps a copy. Repo `github.com/hanzoai/app`, npm `@hanzo/app`.

## Why its own package and its own repo

`@hanzo/ui` is presentational: data in, events out, no fetch. The rooms are
connected — an IAM session, an `@hanzo/ai` client, billing and plan reads — and
bring `@hanzo/ai`, `@hanzo/voice`, `@hanzo/build`, `@hanzo/usage` and
`@hanzo/personas`. They sit beside `@hanzo/ui` the way `@hanzo/build` does
(`hanzoai/build`), in a repo of their own: the `hanzoai/ui` workspace re-resolves
its whole peer graph on any lockfile change, and a re-resolve there turns 21
latent type errors in `pkg/ui` on, so a new package inside it could not land
without breaking the ui release.

## What a host passes

Two halves, because two kinds of caller read them.

```ts
// Once, at module scope, in a module the host's root imports (pure: where.ts).
import { configure } from '@hanzo/app'
configure({ site: '', home: '/home', signUp: '/signup', api, iam, key, plans })
// A host whose IAM session is not in localStorage names its store (Hanzo
// Desktop: its keychain); lib/session reads the token, expiry and claims there.
configure({ session: keychain })
```

```tsx
// Where the rooms render (client: host.tsx).
<Rooms router={useRouter()} path={usePathname()} route={route} Link={NextLink}>
  <Room mode="cal"><CalScheduler /></Room>
</Rooms>
```

The app's addresses are paths (lib/host.ts, "The app's addresses" below): Chat
is `/chat[/<id>]`, Dev `/dev[/<place>]`, Studio `/studio[/<place>]`
(@hanzo/studio's `route`: `c/<id>`, `library`, `explore`, `activity`).
`useDevHost` reads Dev's place from `path`, and App gives Studio the same host
at Studio's place; the host serves its one Chat, Dev and Studio page for every
path under each (hanzo.ai: lib/edge.ts `APP`). `dev(ref)` opens Dev on a run, a
repository or a site from any surface.

| address | hanzo.ai | hanzo.team |
|---|---|---|
| `site` — where the app's pages live (`/dev`, `/legal/*`, `/pricing`) | `''` | `https://hanzo.ai` |
| `home` — the rooms' Home | `/home` | `/` |
| `brand` — the product's name wherever a room prints it: the sidebar's wordmark, Home's and Chat's titles, the composer's placeholder, the setup, the shared page (`brand()`) | `Hanzo AI` (default) | `Hanzo Team` (`@hanzogui/shell/registry` `brandName`) |
| `signUp` | `/signup` | `/start` |
| `Landing`, `Signup` — the front door of a workspace rooted at `/` | — | team's components |
| `team` — every room behind the per-seat Team plan, organizations founded through `Start` | — | `true` |
| `track` — the host's own funnel call, where it boots its own tags | — (@hanzo/event's tag manager) | `lib/analytics/tags` |
| `plans` — the first-paint plan catalogue | build data | — (the live `GET /v1/billing/plans`) |

- A string a room prints that names the product reads `brand()` at render
  time, never a literal: "Hanzo AI" written into a room is "Hanzo AI" on
  hanzo.team.
- Plain modules read addresses through `where()` / `site()` and must import
  them from `./where`, never `./host`: `host.tsx` is `'use client'`, and a
  server component calling a client module's export throws ("Attempted to call
  site() from the server").
- A module-level constant must not capture an address: `configure()` may run
  after the module evaluates. Read at call time (`get route()`, `invite()`,
  `dev()`, `signUp()`).
- The session is IAM's (`@hanzo/iam/react`; the host mounts `IamProvider`).
- Copy is `@hanzo/i18n`'s, from npm, one source: nothing is vendored here. A
  room takes `useI18n` from `@hanzo/i18n/react` and passes authored English
  through `t()`, a name or address as a `{name}` argument, never concatenated.
  The host mounts `I18nProvider`; with none, `t` returns the English, so a host
  or a test without one reads English. A string the package's catalogs lack
  renders English until the next catalog run in `hanzoai/i18n`. Needs
  @hanzo/i18n ≥ 0.4.0 (`phrase`, `pieces`, `t` with an element argument).
  - The catalog is extracted from the syntax tree, so the first argument of
    `t()` is a literal (or a ternary of literals); copy written as data is
    `phrase('Library')` where it is written and `t(row.label)` where it is drawn.
    The function is always named `t`: a `say(…)` alias is invisible to the
    extractor.
  - A component's own `label`/`title` props arrive translated; it never calls
    `t` on a prop.
  - A plain module that words a sentence takes `t: Say = english` last
    (`src/say.ts`): `say(e, t('this board'), 'read', t)`, `ago(at, now, t)`,
    `paused(…, t)`, `renewal(sub, t)`, `quote(plan, interval, t)`, `join(names, t)`.
    A cache holds the answer, never the sentence (tools.ts).
  - Products keep their names in every language: Dev, Studio, Tabs, Team,
    Hanzo Dev, `brand()`, `wordmark()`. Data, names, model ids, plan names and
    the server's words are drawn as they come.
  - Right to left: sides are logical gui props (`marginInlineStart`,
    `paddingInlineEnd`, `insetInlineEnd`, `borderInlineStartWidth`, `text="start"`);
    what a kit or a package sets physically (@hanzo/ui `Grip`/@hanzo/build
    `Gutter` `side`, a menu's `placement`, Sidebar's `borderRightWidth`) is chosen
    by `useI18n().dir`. An arrow along the line wears `data-i18n-mirror`; a key,
    count or id outside a sentence `data-i18n-ltr` or `<bdi dir="ltr">`.
- The look is `@hanzo/appearance`'s. The host mounts `<Look />` once at its
  root, inside `IamProvider`: it applies the person's layers for the org in
  scope on every page and syncs them with IAM when signed in (`useLook`). The
  Settings panel is the Appearance panel, theme row included. No theme library
  is imported.
- Navigation to another origin (`site()` on hanzo.team) is a document load in
  `Room`; same-origin routes go through the host's router.
- A module a server page renders (`ProviderMark`) carries no `'use client'` and
  imports gui primitives from `./ui`, never `@hanzo/ui`: the root barrel would
  register its whole client surface on the route (81 KB on a model page).
- Gmail from the browser is `lib/gmail` (`@hanzo/app/lib/gmail`): the one
  reader and writer of Setup's Google token store (`hanzo.onboarding.google.*`),
  `connect()` (Setup's consent popup), `gmail(email?)` (the live token that may
  send, the chosen account else the most recently connected) and `send(token,
  message)` (one RFC 2822 multipart/alternative message). The token stays in
  the browser: about an hour, no refresh, reconnect when it ends.
- Setup's three steps are GitHub, Slack and a plugin. Step 3 opens Dev's
  Customize (`-/customize/plugins`) and is done once the org has a row in
  `GET /v1/tool/plugins/authored` or `GET /v1/tool/mcp/servers`. Google
  Workspace is the private beta `workspace` (lib/betas): its connect is drawn
  only where `opens('workspace')` lets the reader in, until Google verifies the
  Drive and Gmail scopes; nobody else meets the unverified-app screen.

## Rules the rooms keep

- The app's places are marks on its rail (Rail.tsx): Chat, Dev, Studio, Tabs,
  Library, Scheduled tasks, Customize, then More (Team, on a host of its own),
  and the account at the foot. Tabs is drawn in the app at /tabs (Terminals.tsx:
  @hanzo/tabs `Workspace` and `useFleet` with the reader's bearer, the pane
  edge to edge, no sidebar); nothing on the rail leaves for tabs.hanzo.ai.
  @hanzo/tabs is taken from its git commit (hanzo-inc/tabs, pinned in the
  catalog) until it publishes to npm. The rail moves
  the app, and Shell's sidebar wears the product's name alone; the one Chat |
  Dev switch is a phone's bar, which has no rail. Dev's own places (New run,
  Projects, Issues, Templates: @hanzo/build `own`) are rows in Dev's sidebar
  (Column), with no group labels. Library, Scheduled tasks and Customize each
  take the sidebar (Rail.tsx `raised`): Back (to where the reader was, Chat or
  Dev), the place's name, and its own rows — Customize's tabs Agents first
  (`tabs`), Library's Upload and kinds (`library`, the kind in the address,
  /dev/artifacts/<kind>), Scheduled tasks' New task and the person's tasks
  (`useScheduled`) — and the page draws none of them itself (the host's
  `sections`). Shut, the sidebar takes them with it and the rail stays.
- Settings is the host's own pages, one tree at /settings (hanzo.ai's
  app/(app)/settings, with a column of its own), never a place of Dev's
  (owner, 2026-10-22: "don't stick all settings under /dev"). `lib/host.ts`
  `settings(section)` names the page: General `/settings`, the organization's
  `/settings/organization[/members|billing|usage|keys]`; a section with no page
  of its own (the builder's Account, Privacy, Memory, Notifications…) opens
  General. Every way in reaches it through the host's router (`visit`): the
  account menu's rows and Chat's See usage (`showSettings`, answered in
  App.tsx), ⌘, / Ctrl+,, the palette, and a builder section the builder moves
  to (`app()` writes the page, never `/dev/settings`). From a phone's menu the
  page takes the menu's history entry (Drawer.tsx `exit`): `depart` pops the
  entry when the address has not moved, and the router moves it only after the
  press returns, so popping there sent the reader back to the app. Machines
  and Environments, which the builder files under its Settings, stay Dev's
  places at /dev/machines and /dev/environments, with Dev's sidebar.
- Skills, connectors, plugins and agents have one home, Dev's Customize: Shell's
  Customize row and Settings' Plugins and Skills rows lead there (`app()`), and
  Directory lists only Works with and Channels. A list is the registry's answer
  or a plain line saying why there is none — never rows standing in for it.
- The apps and models in beta are one list, `lib/betas.ts` (`BETAS`, `GROUPS`):
  every app or model no one has yet on hanzo.ai or platform.hanzo.ai, with its id,
  name, line, group and where it opens. The Creative group is the six creative
  models (Koma, Iro, Mori, Oto, Koe, Uta); Models holds what is in research
  preview (Zen 7: no public weights, no callable id). A beta is PRIVATE (a
  SuperAdmin grants it) or PUBLIC (an admin promoted it): `lib/optin.ts` is the
  one client for the reader's opt-in (`GET`/`PUT /v1/flag/optin`, `{on, blocked,
  public}`) and the organization's block (`PUT /v1/flag/optin/org`). An opted-in
  reader gets every public beta unless their org blocked it; staff get every
  beta. Who is in is still `GET /v1/flag/platform` through `opens`; a public beta
  only reads "Public beta" and says how to turn it on. The switch is Settings,
  General (`experimental.tsx`); no pane holds org-admin settings, so the org
  block has a client and no switch yet. hanzo.ai/beta reads the same list. Each is the cloud's
  principal switch `beta.<id>` (cloud apps/flags betas.go, same ids), answered by
  `GET /v1/flag/platform`; `opens` is the one predicate (a SuperAdmin opens
  every one). `Betas.tsx` `useBetas` reads the switches and the person's CRM
  beta record (`GET /v1/marketing/beta`) once a token, and asks with
  `POST /v1/marketing/beta/request`. The rail's More lists the granted ones,
  each at its `href`, then Betas, the dialog of all of them. A switch only adds:
  nothing a person has is hidden by one. The grant is a SuperAdmin's,
  `POST /v1/admin/flags/beta.<id>/grant {user, on}`.
- Betas (`/beta`) stands alone, as Tabs does: the rail and the pane, no
  sidebar, and a phone's bar and menu carry no Dev places (its bar has no New).
  A host that runs its own beta program passes it as `App`'s `betas` (`Hosted`
  in App.tsx), drawn as the whole pane in place of `BetasPane`; hanzo.ai passes
  its application, plan and referral board there.
- A scroller says `overflowY="auto" overflowX="hidden"` (or the reverse for a
  strip that scrolls sideways), never `overflow="scroll"`: a classic scrollbar
  draws its track and steppers whether or not anything overflows. The bars
  themselves are @hanzo/design's (base.css ≥ 0.5.34).
- A pane is cut by `pane()` (ground.ts) on design's first paper rung,
  `--shadow-sheet-1`, over the floor's `--glass`: the second rung's drop and
  `--glass-strong` read as a gradient through a translucent pane.
- Files go with a chat message by the paperclip or a drop on the room
  (`lib/attach`): an image as an `image_url` part through @hanzo/ai's
  `send(text, images)` (≥ 0.6.20), a text file fenced under its name, any other
  kind refused by name.

## A conversation's menu

`thread.tsx` `ConversationMenu` wraps a list of conversation rows — the
column's Recents and the shell's /chat list — and mounts ONE menu for all of
them: gui's ContextMenu (a right-click at the cursor, a long-press on touch)
and one gui Menu whose triggers are every row's ⋯ (a gui Menu takes many
triggers and anchors to the one pressed), plus the Rename, Delete and Share
dialogs (`Share.tsx` `ShareDialog`, the header's panel in a dialog). A row
(`ThreadRow`) is its markup and a trigger. Entries: Rename (Ctrl+Alt+R), Pin
or Unpin (Ctrl+Alt+P), Share…, Copy link, Open in new tab, Archive or
Unarchive, Delete. The address of a conversation is `site(talk(id))`; a
⌘/Ctrl-click or a middle-click on a row opens it in a new tab. Chat's header
offers the same menu from its ⋯ (`ThreadMore`, inside a `ConversationMenu` of
the one conversation the pane holds).

- The keys act on the row whose menu is open, else on the conversation the
  pane holds — never while the reader types, inside a dialog or one of the
  menu's dialogs is open, and once a press, not per key repeat (`chord.ts`).
  They match the letter on the key (`e.key`), and the key's place (`e.code`)
  only where Option or AltGr made it another character. One capture-phase
  listener on the page serves every list.
- A change shows at once and is taken back with a toast on a refusal or after
  15 s without an answer (`pending.ts`): every `useThreadList` draws the
  changes in flight over what it read. One conversation's changes go to the
  store one after another, and a refusal takes back that change alone. A
  settled change is kept until every list has read after it, by one clock that
  stamps reads and answers, so no list flashes its older read. A new client
  (another reader or organization) drops them (`bind`).
- Stars from before pins were the server's (`hanzo.starred-threads`) are asked
  for as pins once a page, after the first list read answers, and forgotten
  once the store takes any (`stars.ts` `carry`); a store without the route
  keeps them for a later visit.
- Never `@hanzo/ui/product/menu`'s ContextMenu here: it portals its panel under
  gui's `pointer-events: none` host and takes no click.

## Layout

Paths below are under `pkg/app`.

- `src/*.tsx` — the rooms, as `components/workspace/*` was in hanzo.ai; each is
  a subpath (`@hanzo/app/CalScheduler`).
- `src/bots/*` — the Bots room.
- `src/lib/*` — the workspace's infrastructure, one copy for every host:
  `session`, `destination`, `api`, `ai` (useAi), `account`, `tier`, `limits`,
  `plans`, `pay` (the pay site and money, apart from the plan catalogue), `share`, `coding`, `todo`, `durable`, `tags`, `host` (estate routing and the app's addresses),
  `mix`, `hydrated` … Apps import these from the package
  (`@hanzo/app/lib/session`) and keep no copy.
- `lib/session` `orgs()` is every org of the token's `orgs` claim its claims
  open, hanzoai/authz `Claims.opens` (cloud scopes every request by it): never a
  brand's directory (`DIRECTORIES`: hanzo-id, lux-id, zoo-id, pars-id, authz
  `IsDirectory`), a customer account's home and nobody's tenant; `admin` only for
  a SuperAdmin; a platform org (`PLATFORM`, authz `platformOrgs`: the brands and
  the estate's namespaces) only for its owners and admins and a SuperAdmin, so a
  customer who is a plain member of `hanzo` is offered nothing there and makes an
  org of its own. No picker offers what it drops and no request is scoped to it. `home()` is the claim's
  first entry, directory or not: `me()` keys the account by it.
  `superAdmin()` is @hanzo/iam's `superAdmin(claims)` (hanzoai/authz
  `Claims.Sudo`): a person whose `orgs[0].org` is `admin`, never a program and
  never an empty home shifted onto a later entry. No copy of the rule lives here.
- The chooser is `Orgs.tsx` `Pick`: on arrival with several orgs and none picked,
  or over the room when `choose()` fires (the account menu's All organizations).
  Rows are the token's orgs with IAM's rows beside them (`GET
  /v1/iam/organizations`: the first page carries all of one's own) — the mark
  (@hanzo/ui `Avatar`: IAM's avatar, emoji or logo, else the initial in the
  slug's hue, which needs the host to load `@hanzo/tokens/css/data`), the role
  the token signs (`role()`), the plan billing reads per org. The search filters
  them as typed (`lib/orgname` `matches`, IAM's own rule). A person founds one
  there through `createOrg` (`POST /v1/account/orgs`, which files it in IAM and
  makes them its owner; IAM's `/v1/iam/onboard` gets no CORS answer for an app
  origin), the slug following the name as IAM's `slugifyOrg` makes it and a
  typed slug refused, never folded (`refusal`). A SuperAdmin gets no create (IAM refuses them a customer org)
  and an `Everyone` section instead: IAM's list searched on the server, paged
  by cursor, each row stepped into through `support()` (IAM `assume`, audited).
  An organization's mark is its IAM row alone: Hanzo's H is `admin/hanzo`'s
  `avatar`, never drawn here for a brand.
- `Chrome` is the one bar over a focused page, imported from the
  `@hanzo/app/Chrome` subpath and never the root: the root loads in plain
  Node, and the UI packages Chrome pulls in do not. It stands over the chooser and
  every gate screen (`Orgs.tsx` `Page`, once someone is signed in; "Signing you
  in" stands alone), and the host's own focused pages (the way in, the way to
  pay, a beta application), none of which draws a bar of its own. Sticky, 60px
  under the notch, `header[data-slot="masthead"]`, its side the page's gutter
  (@hanzo/design `--page-gutter`, 20px where a host loads no tokens). The brand
  at the start (@hanzogui/shell `HanzoWordmark`, `brand()` in words, going to the
  host's `/`; `a[data-slot="home"]`) is a 34px pill whose 12px padding the bar
  takes back with a -12px start margin, the shape hanzo.ai's marketing bar gives
  its name, so the name's first letter stands at the gutter on every page of
  every host: 20 / 30.7 / 57.6 / 72px at 390 / 768 / 1440 / 1800, measured
  against hanzo.ai's `/` (owner, 2026-10-29: "all the same wordmark alignment").
  Under a mouse or pen, and under keyboard focus, the pill takes the soft
  outline a section's label wears (`--border-strong`, no ground) and lucide's
  arrow opens before the name (`data-lit`): this goes back to the site. A
  finger's tap navigates and does not light it. hanzo-inc/pay draws its own
  bar to the same measure (`.pay-bar`, `.pay-mark`). Then the host's `back`;
  at the end a host's own account control when it hands one in (`account`;
  null draws none: hanzo.ai passes the account pill its marketing bar wears),
  else, signed in, the face, name and
  address with Use another account (`rememberDestination`, then sign-out, so the
  sign-in comes back to the page, as hanzo.ai's /join does) and Log out
  (lib/signout, the account menu's). Under gui's `md` the account folds into its
  face, a menu of the address and the same two ways out. Signed out, the brand
  alone. It reads the session from `IamProvider` and its copy through `t()`.
- `src/team.gen.ts` — the core team's persona files as strings, generated from
  `@hanzo/personas` by `scripts/team.mjs`, so no host needs an asset loader:
  every member the package publishes, in the crew's order (`ORDER`, then any
  other). That list is the default cast (`team.ts` `TEAM`).
- `src/lib/integrations.ts` — the integrations catalogue, the one copy:
  hanzo.ai's /integrations pages render it, Directory's "Works with" tab lists
  it (loaded when the tab opens).
- `src/lib/terms.ts` — the Terms and AUP versions (`POLICY`), the one copy:
  hanzo.ai's legal pages print them, every sign-up card records them.
- `assets/` — the files the rooms name by path: the cast's portraits
  (`assets/agents`, `/agents/<id>.png` in `cast.tsx`), the Bots room's
  avatars (`assets/bots`) and the personas roster (`assets/personas`, written
  by `scripts/team.mjs` at build and ignored by git: `index.json` lists every
  figure, `<slug>.md` is a figure's PERSONA.md where one is written). A host
  serves the directory at its root: it copies `@hanzo/app/assets` into
  `public/` on `prebuild`/`predev` and keeps no copy in git.

## The app's addresses

`lib/host.ts` is the one module that writes and reads the web app's addresses,
and they are paths: `/chat`, `/chat/<id>` (`talk`), `/dev` and every builder
place under it (`app`, from @hanzo/build/route `href`): `/dev/run/<id>`,
`/dev/projects`, `/dev/projects/<org>/<repo>` a repository,
`/dev/projects/<slug>` a deployed site, `/dev/issues`, `/dev/artifacts`,
`/dev/machines`, `/dev/environments`, `/dev/customize[/<tab>]` … and no
`/dev/settings`: a builder Settings section is the site's page (`settings`).
`place` reads a path back, `go` moves the app with a history entry, `visit`
moves to any address of the site (the app's by `go`, Settings through the
host's router), `dev(ref)` is the door from anywhere (through `site()`), `page`
folds a record for analytics, and `remember`/`resume` keep the mode `/`
reopens. Retired addresses — `/?at=`, `/?chat=`,
`/dev?run=|project=|view=|at=`, and the builder's own grammar under /dev that
0.1.35–0.1.38 wrote (`/dev/sess_<id>`, `/dev/-/<place>`, `/dev/<org>/<repo>`,
`/dev/<slug>`) — are moved to their paths by the host before `App` draws
(hanzo.ai `app/_door.tsx` `moved`); nothing here reads them. The rooms' own links to hanzo.team's
/chat (`/chat?q=`, `/chat?thread=`) are that app's addresses and stay as they
are.

**IAM's API is the gateway's.** `api()` (api.hanzo.ai on every Hanzo host) answers
`/v1/iam/*`, so the account door (`lib/account.tsx`), the host's account and the
appearance account (`host.tsx`, `look.tsx`) ask it there; a browser on hanzo.ai
sends nothing to hanzo.id. `iam()` is the identity origin and only names IAM's own
pages (/account, /account/security, /join, the org switcher's link out).

**Where each host signs in** (`lib/host.ts`). `answers()`: hanzo.ai (and testnet,
devnet, the dev proxy) answers IAM on its own origin and signs people in there.
`visits()`: cloud.hanzo.ai, hanzo.bot and bot.hanzo.ai keep a session of their own
but sign in on hanzo.ai, sending the host's own authorize request to
hanzo.ai/login, which finishes it and returns the code to the host's callback.
`guest()`: hanzo.app, `*.hanzo.app` and hanzo.chat sign nobody in and hand off to
the same address on hanzo.ai.

## Build and ship

The repository is a pnpm workspace of the packages it publishes, each under
`pkg/`: `pkg/app` is @hanzo/app. Commands run at the root over every package
(`pnpm -r`). In a package, `pnpm build` = team strings → `tsc` →
`scripts/specifiers.mjs` (every relative import fully specified, so Node's ESM
loader resolves dist outside a bundler). Gates: `pnpm typecheck`,
`pnpm lint:design` (ratchet in each package's `hanzo-design.allow.json`),
`pnpm test`, `pnpm build`, then each package's root imported in plain Node
(`node --input-type=module -e "await import('./dist/index.js')"`). Publish: bump
a package's `version`, push main; `.github/workflows/publish.yml` publishes each
package whose version npm does not serve, the contract before the app.

## Plan usage

The shared composer now exposes **Usage** in Chat, Dev and Studio (`src/Usage.tsx`). It combines explicitly estimated context, API-reported last-response tokens, organization-scoped 30-day account totals, plan windows, and links to Upgrade / Buy credits. See all usage opens Settings → Usage, also directly available in the account menu. The host Settings usage page shows tokens, requests and spend for every plan. `lib/served.ts` observes streamed/JSON usage without consuming responses; `lib/tokens.ts` isolates last-turn counts by IAM subject, organization, model and transcript. Never label estimates as reported usage or substitute zero for unavailable reads.

The plan is named, read and drawn once, in @hanzo/build (≥ 0.2.53), and the
rooms mount it: `label` names a plan by family with its rung as a small tag
(`max-20x` reads Max, 20x; never a slug or an id), `useStanding` reads the
tier, the limits, the free allowance and the balance, `Meter` leads the
account menu's account row › (`Me`, the one account menu), `Plan` is
Settings → Usage and `Credits` is Settings → Billing. A plan's meter is its
session, day and month as shares, never money; Free reads the free allowance
left today; only an account with no plan and money in its balance sees the
balance, its meter. Credits live in Billing only.

`lib/limits.ts` is @hanzo/ui's `useLimits` reading `GET /v1/ai/limits` with
`scope()`; `lib/served.ts` hands every `/v1/chat/{completions,public}` answer to
`observe`, so `X-Hanzo-Usage`/`-Fallback` and a `billing_error` refusal update it
at once. Chat draws no bar; once the reader is turned away one `LimitedBanner`
over the composer says `paused()`: the plan by name and when it comes back, then
two ways — Continue with credits (writes `setCreditsAfterAllowance(true)` and
asks the last question again) where the org holds credit, else Add credits; and
the upgrade — plus See usage, which opens the shell's Settings → Usage, or the
site's /settings/organization/usage (App answers `showSettings` there). A switch goes
through the chip's pick. The model picker marks a paused model "Paused" (its
class `limited`, or a `paused` entry naming it) and still picks it, and a
refusal is said in the thread in the server's words. The pure half (`label`,
`spent`, `ways`) is `@hanzo/build/plan`, so it loads in Node.

## The live web

`lib/web.ts` `researched` is the client's fetch. A turn on an Enso or Zen model
carries `WEB` as a mark; the turn is looked up BEFORE the model is asked —
`POST /v1/websearch {q, language}` with the top two pages read through
`/v1/crawl`, and the pages the turn names — and the model is asked once WITHOUT
tools, so the answer streams: the gateway answers a request that offers tools
whole. The model asks for no lookups of its own.

- Search is the default. `needs` skips only code, arithmetic, a passage set
  under a short instruction ending in a colon (200+ characters of prose, not a
  list, no question mark anywhere in the turn), a greeting, and a turn carrying
  files (attached or carried) or a picture, whose words never go to an outside
  engine. It reads the text's shape, never topic words: a list of English "now"
  words passed over "чума россия новости".
- Links the person points at (a short line, not inside a quote) are read first;
  a question about them also searches. `opened` reads an address by its parts,
  never words inside them: a path segment that is an action (accept,
  unsubscribe, resetpassword…) or carries another address, an action as a query
  value, a click/unsubscribe relay host, or a user name keeps it closed, and the
  model is told it was withheld; otherwise it opens without its credential and
  tracker parameters (t, token, fbclid, long opaque values). A query says an
  address as its host and path words (a withheld one as its host alone), never
  its query string. `language` reads the script, then the commonest words, then
  the reader's languages.
- What was found goes at the END OF THE LEADING SYSTEM TURN, between random
  markers. Not a system turn of its own: hanzoai/ai's text pipeline keeps only
  the last system turn and would drop the room's. Not the user turn: `enso-auto`
  routes on `lastUserText`. The empty-answer re-ask rides there too.

## Voice

Every voice path runs on `@hanzo/voice` against the platform's speech
services, with the reader's IAM bearer (`useIamToken`) and the host from
`base()`: `/v1/audio/transcriptions` and `/v1/audio/transcript` (`zen-scribe`)
listen, `/v1/audio/speech` (`zen-voice-mini`) reads, `/v1/voice` converses. The browser's recogniser and speechSynthesis only
stand in when the platform refuses, and the refusal is shown (`<Voice/>`'s
label, `SpeakButton`'s, Meet's status line).

- Chat's mic dictates into the draft (`useDictation`: each utterance lands
  after what the draft held). While it is open a finished reply is read through
  the machine's `say`, part by part in each speaker's voice, and a part spoken
  over ends the reading.
- Chat's talk button is talk mode (`useTalk`, the realtime socket `/v1/voice`):
  hands-free, the answer spoken back, its words drawn above the composer
  (`composer-talk-reply`). Its own conversation; nothing posts into the thread.
- Meet's hands-free is the dictation machine: each utterance is answered and the
  answer read by `say`, so barge-in stops it. Meet's Transcribe is the live
  transcript (`useTranscript`, `/v1/audio/transcript`): settled text goes into
  the notes, the decoding tail shows under them (`live-caption`).
- Listen (`SpeakButton`), the Meet speaker test and briefing use `speakAgent`,
  called from the click so Safari lets the reply play.
- `cast.tsx` voices are speech-service ids (`am_michael`, `bf_emma`): first
  letter accent, second register. Never OpenAI names.
- The model picker never offers a model whose `outputs` lacks `text`.

## Models

The model and the effort are ONE choice for Chat and Dev, kept in this browser
by @hanzo/build (`useMind`, `hanzo.mind` = `{model, effort}`, Enso and High by
default). The model is named under the composer, and its picker offered, only
where the person turned the model selector on (`composing.model`,
default off) — one setting for every composer, not a Chat preference: Settings →
Appearance writes it (`@hanzo/appearance` `composing`) and `@hanzo/ui/chat`'s
`Composer` reads it. The effort is always shown, in the composer's row: Chat's is
the six steps (Auto, Low, Medium, High, XHigh, Max, sent as
`reasoning_effort`); Dev's is @hanzo/build's (Auto, High, XHigh, Max — a coding
run takes low, medium or high, so Auto names none and the rest name high).
Choosing one of Dev's four in Chat or Settings moves Dev's too (`shared`); Low
and Medium are Chat's alone. On Free (`GET /v1/ai/limits` `plan` = `free`, and every
visitor) the choice is the catalog's free class alone: Enso Free by default,
every other model listed with Upgrade, which opens the upgrade instead of
picking. With the selector on, the composer draws `ModelPicker`'s quiet pill:
the catalog
(`GET /v1/models`, read once and shared with Dev): Hanzo's families first, then
every maker. A listed pick is sent as picked; only a name the catalog does not
list falls to `served`. A model's class and family are the catalog's fields,
never read from its id. A premium pick holds for the conversation and is never
kept (`usePick`); Settings' default picker writes the same choice and offers no
premium model. A paid plan's pick is not gated: the gateway refuses or answers
from Enso, and the room shows that. The live web rides a turn whose model the
catalog files under Enso or Zen (`house`).

## Chat and Dev are drawn alike

- The composer is `@hanzo/ui/chat`'s `Composer` (Chat passes its slots to
  `Chat`'s `composer`), one frame for Chat, Dev and Studio, drawn the way the
  person's composer setting says (the key that sends, the chips, the model
  selector, the mode; Chat's defaults hide the chips and the mode): the field on top ("Type /
  for skills"), then one row — `+` at the start and what the conversation
  carries as chips (who is in the room, the skills on, Research, Plan), and at
  the end dictation (the mic and its menu: the microphones with a live level,
  Dictation settings, Language) and one round button that is voice mode while
  the draft is empty, send with words, stop while a turn runs. Under the frame,
  at its end: the model (only under the model selector), the effort and, in
  Dev, the mode pill (Auto, Manual, Plan; Chat's is Auto or Manual, the approval mode Settings keeps, and off until the person turns it on). Manual pauses before each plugin runs for a message
  (allow once, always in this chat, deny; `gear.allowed`), and Dev asks before
  a run starts. Dev puts where the run goes, its repository and its branch as
  pills above the field, and chips for its repositories, issues and templates under it. Under that, three suggestions while nothing has been said (the
  person's activity, then signup, then Hanzo's starters; above the frame on a
  phone). Each is one short action and pressing it does it (@hanzo/build
  `Act`): open goes to what it names, send is sent here at once (`submit`),
  task is handed to Dev (`hand`, which Dev's New `taken`s and starts), schedule
  is made (`book`) and opened in Scheduled tasks; a send pressed in Dev arrives
  here the same way and is sent once the room is a new chat. `/` lists the
  skills above the frame. As wide as the words above it (`measure`); cut as a
  pane in the app's frame. At rest the frame is two rows, a line of text and
  the tools, and grows with the text. The opening above it is one line,
  "What's up, <first name>?", the first word of the display name capitalised
  (`given`; the username is never used, so with no display name it is "What's
  up?"; Dev: "Build what's next."); no line sits above the composer: the
  free-chat note at the foot is the one note.
- `+` (@hanzo/build `Plus`): Upload or add files (Ctrl+U), Agents ›
  (`useAgentShelf`: the org's agents, the cast first; a pick seats or unseats
  one; Create agent opens `Hire`), Skills › (the org's active skills; a pick
  puts its SKILL.md in the room's system turn), Plugins › (@hanzo/build
  `usePlugins`: what runs for this person — Work in a project, Deep research,
  Sketch, Template Creator, Presentations, PDF; `@` lists the same), then
  Research (the Deep research plugin: a Hanzo model plans the searches, the
  pages are read, and the turn asks for a cited report) and Memory (what Hanzo
  remembers, from /v1/ai/memory/list, in the system turn). A plugin that
  prepares a message is asked in `submit`, just before it goes: its words ride
  the turn's own block (`carrying`, the block files ride in, so the transcript
  draws the words alone and `lookup` does not search the turn again), and an
  answer of its own (Presentations' deck) is drawn as the reply with no model
  asked.
  What a conversation carries is @hanzo/build's `useCarry`/`useGear`: per
  conversation in /v1/pref `gears` (the last 30), the person's default in
  `gear` (only Research, Memory and the mode carry to a new conversation).
  Design system › lists Studio's brands, the one store: one attached is said to
  the model on every message (colours, type, radii, components, voice) and
  Presentations runs with it as the deck's brand. "Create design system" turns
  on the Design system plugin and starts the brief; a Hanzo model drafts it
  under a strict schema, it is saved as a brand, drawn as a page in the side
  panel and attached. A row with no service behind it is not drawn: Connectors
  (a chat completion runs no tool the client did not loop) and Devices (Dev's
  runs only) are not offered in Chat.
- The side panel is @hanzo/build's `Panel`, page tabs only in Chat: an
  artifact rendered from its own bytes, a file or an address. A tab can be
  pinned (`Deck.pin`): it leads the strip and closes only on purpose. Tabs, order and the chosen one are kept per
  conversation (`useDeck`, `chat:<channel>`); open or shut is kept on a laptop
  (`hanzo.side.chat.open`), where the frame's column holds it (`Beside`), and a
  phone opens it over the whole window. The header's Panel button and ⌘. /
  Ctrl+. toggle it.
- The column is @hanzo/build's `useSplit` (Paned), the one Dev's run stands its
  panel in. Its edge is @hanzo/build's `Gutter` (the kit's `Grip` with its
  inline bar, centred in the gutter, drawn only while reached for), the same
  one the sidebar's edge uses; the width is the person's, kept in
  their preferences (`side.width`, `PATCH /v1/pref`, read by the `PrefsProvider`
  App mounts, one document for Chat and Dev; without one, as in hanzo.team's
  shell, it lasts the page). Pulled over the conversation the column takes its
  room, the conversation hidden and never unmounted, until the strip's Show chat
  or a pull back out; the strip's full-screen button puts the panel over the
  window and Escape returns. A drag writes two elements a frame, no React commit.
  An answer that finishes writing a page while the panel is open opens it there.
- `pane.ts` holds only what goes with the next message (files, refusals).

## Agents

- The composer's `+` › Agents is `useAgentShelf()` (crew.tsx): the org's own
  agents (`useCrew`), the core team's first (agents.ts `ordered`), each by its
  `Face` at 16px. Nothing stands in for an agent the org has not added: a new
  org has none and loads none until Customize › Agents' Add default agents makes
  the cast (agents.ts `CAST`: the core team, then QA, Ops and Support, each with
  a $10 a month, $1 a run budget; @hanzo/build `hire`). On is
  in the open conversation (`useOpen().agents`) and a pick toggles it there
  (`openAgent`). Create agent and Browse personas open `Hire` through `make()`;
  the host mounts `<AgentMaker />` once beside the composer to draw it. Manage
  agents is Dev's Customize › Agents (`app('-/customize/agents')`). The Shelf,
  Row and Link types are @hanzo/ui/chat's, re-exported by agents.ts.
- `Hire` (New agent) starts from a persona: @hanzo/personas' figures, fetched
  from `/personas/index.json`, fill the name, the instructions (the figure's
  PERSONA.md body word for word, or one paragraph saying who it is where none is
  written) and the face's description (agents.ts `draft`).
- A face is drawn by Hanzo's own image model, `zen-image` (agents.ts `PAINTER`,
  hanzo-inc/zen catalog.yaml), named on every `/v1/images/generations` call: the
  endpoint refuses a call with no model. One call per press of Draw or
  Regenerate, and one on Create when no picture or emoji was chosen; a drawing
  that fails on Create says why and the next press creates without one. Every
  face goes through `mark` and is kept as the row's `avatar`.

## The app is `App`

`@hanzo/app/App` is the web app as the whole window: the rail, the sidebar,
Chat and Dev, moved by the path (`place`) and written back with `go`. A host
mounts IamProvider and `<Rooms>` with its router and `path`, and draws `App`
for a signed-in reader; the signed-out page is the host's. hanzo.ai's `/` and
the desktop app's main window draw this one component, so a change here
reaches both. The desktop's router is `history` itself: `go` writes it and the
host re-renders on `popstate` and on its own push and replace.

The window, ChatGPT desktop's shape (the parity record is the owner's
reference captures; outer window, inner panel):

    [◧]   Hanzo AI     🔔 ⌕ │╭ Launch checklist      ⇪ Share  ⋯  ☷  ⊞ ╮
    [💬]  ✎ New chat         ││                                         │
    [</>] Pinned             ││        the conversation, 16px body       │
    [📚]  Recents            ││                                         │
    [⏱]                      ││   … can make mistakes.                  │
    [🧩]                      ││   ( + Ask Hanzo AI     Enso ⌄  🎤  ⬆ )   │
    [⋯]                       │╰─────────────────────────────────────────╯
    [me]

- OUTER: the rail (Rail.tsx) and the sidebar (Column.tsx) stand on the floor,
  no fill, no edge. INNER: the content is one rounded panel (`pane()`), inset
  from the window's edges and from the sidebar by `--pane-gap`; Chat's tabs
  are a second panel beside it (Paned), Dev's run floats its own two.
- The rail, one order: Chat, Dev, Studio (@hanzo/studio, the app's third mode
  at /studio), Library, Scheduled tasks, Customize, then More (Tabs, Team: the
  products on hosts of their own; on a phone the three places lead it), the
  account's face at the foot. Each mark is 36px on a 44px pitch, its name its
  tooltip, lit where the reader is (Dev is not lit on a place of the rail's),
  and each owns the sidebar beside the rail: Chat its conversations and
  recents, Dev its own places and its runs, Studio its own, the three places
  theirs. Nothing on the rail is listed inside
  Dev (owner, 2026-10-20: 0.1.83 had moved the three into Dev's sidebar; 0.1.85
  put them back).
- The sidebar's toggle is at the window's top-left: the rail's first mark in a
  browser tab. A host that is a window passes `bar` (`<App bar={{ inset, drag
  }} />`) and App draws the window's 40px bar: the toggle, then Back and
  Forward through the host's router, `inset` px clear for the window's own
  controls, `drag` the attributes its shell reads as the drag region. Shut is
  kept per browser under `hanzo.build.rail`; the sidebar's edge pulled in past
  its floor shuts it too.
- The sidebar: the mode's name (18/600, no chevron), the bell (the org's run
  activity) and the search (the palette, below;
  ⌘K / Ctrl+K from anywhere), New chat or Dev's places, then Pinned and
  Recents as plain 14px titles on a 31px pitch — no dates, no icons; a run's
  state is a dot at its end. The Recents view menu stands at the heading's end.
- The account menu (Me.tsx) is the one account menu: the rail's face draws it
  for Chat, Dev and Studio, and the shell's sidebar foot for every other app
  (`Who`, the host's person, org, api, token and sign-out). @hanzo/ui's
  DropdownMenu, top to bottom: the account row (face, name, email) whose ›
  holds the meter and the organizations (switch, create, settings, Team, All
  organizations for a SuperAdmin); the two accounts apart, each a row that
  works in it — the organization with its plan ("hanzo · Enterprise") and the
  person's own ("Personal · Pro", or "Personal · No plan" with Get Pro, the pay
  site's cart for the personal organization); the trigger reads where the
  reader works ("hanzo · Enterprise"). Submenus open in a portal of their own
  over every pane (@hanzo/ui ≥ 8.29.4). Upgrade plan (named by the plan: Enterprise
  plan, Agency plan, else Upgrade plan; the pay site, `leave`);
  Personalization (Settings → General), Profile (Settings → General), Settings
  (⌘, / Ctrl+,); Help ›; Log out. Settings' rows go through `showSettings`,
  which App answers with the site's page at /settings (`settings`)
  and the shell with its pane. Help › (help.ts, every address through `site()`): Help center
  (/support), Privacy center (/legal), Release notes (hanzoai/cli releases, as
  the site's nav), Download apps (/download), Keyboard shortcuts, then Terms of
  Service (/legal/terms) and Privacy Policy (/legal/privacy). Keyboard
  shortcuts is a dialog over help.ts `KEYS`, the one list of the app's keys;
  ⌘/ / Ctrl+/ opens it from anywhere (the phone menu's copy at its foot, `above`,
  leaves the key to the rail's own). Report a bug is not drawn: the one intake,
  `POST /v1/help/tickets` (cloud apps/help), answers 503 "help center not
  configured" until the Help model is installed in the public help org.
- Chat's header: the conversation's title at the left, then Share (icon and
  word), the row's own ⋯ menu (`ThreadMore`), the Summary (@hanzo/build
  `Summary` over RightPane.tsx `useSections`: Outputs led by Create file or
  site, Sources with its +, each row opening in a tab) and the tabs' control (@hanzo/build `PanelToggle`), never a second
  sidebar toggle. New chat anywhere is `empty()`; App moves an emptied
  conversation's address to /chat.
- The transcript reads at the reference's type (Prose.tsx): a 16px body on a
  24px line, headings 28/24/20.
- A phone has neither rail nor sidebar (under gui's `md`): its bar (Top.tsx,
  the owner's iPhone reference) is three glass pieces on one 48px line under
  the device's top inset — a 44px circle that opens the sidebar as a drawer
  (below); the 158×48 pill Chat | Dev, which
  moves the app as the rail does (neither lit in Studio); and a 44px circle for
  the mode's New (New chat, else the mode's `nav` `NEW` row). Glass is `pane()`
  cut round with a `--border-strong` edge, so the solid fallback and both themes
  are design's.
- A phone's drawer (Drawer.tsx, the ChatGPT iOS app's shape): the menu stands
  BEHIND on the floor (`--pane-floor`) and the pane slides toward the END side
  over it, raised — `Lift` fills it with `--pane-solid` under its content, a step
  brighter than the floor in both themes, start corners rounded
  (`--radius-composer`), edge and drop (`RAISED`) — leaving `STRIP` (64px) of it
  in sight (slide.ts `OPEN`). The menu is the column: head, the mode's rows, the
  places as rows (Rail `rows`: Studio, Tabs, More led by Library, Scheduled tasks
  and Customize; Chat and Dev are the bar's), Pinned and Recents, and the foot
  (`Foot`): the account's face (`Me` `above`) and the accent New chat pill
  (`--accent`). It is a modal dialog: everything else in the window `inert`,
  focus in on open and back to the opener on shut, Escape closes unless a menu it
  opened holds the focus, a tap on the strip or a pull toward the start closes
  it, and opening pushes a same-address history entry that Back pops; a move
  made from it replaces that entry (`depart`), so Back never reopens it. The
  slide is a transform written on the pane (`--drawer-way`, `--drawer-at`, no
  React commit while a finger drags); its sign is read off the pane's
  `direction` as it opens, so `dir="rtl"` slides left, and everything else is a
  logical inset. Reduced motion: no transition, shut at once. The phone window
  is `overflow: clip`: a hidden overflow would let a `scrollIntoView` inside the
  slid pane scroll the window sideways (measured: 314px).
- A phone's window stands in the VISUAL viewport (view.ts `useView`), so the
  keyboard never covers the composer: `window.visualViewport` resize and scroll,
  once a frame, write `--view-top`, `--view-height` and `--keyboard` on the
  window, which is `position: fixed` at `top: var(--view-top, 0px)`, `height:
  var(--view-height, 100dvh)`. The stage's foot is the home indicator's inset
  while the keyboard is down (`FOOT`). A pinch zoom is not followed. Every
  descendant reads `--keyboard` (px the keyboard takes, 0 when down).
- What a person reads calls these apps, and a team's conversation spaces
  channels; "room" is a name in the code only (the package, `Room`, `rooms.ts`,
  `useRooms`, the `rooms` card kind), kept for the @hanzo/apps rename.

## Previews: `@hanzo/app/TeamPreview`, `@hanzo/app/preview`

`TeamPreview` is Hanzo Team drawn in gui props and playing a working day,
laid out the way a team chat is read: the organizations a person belongs to
down the far left, each its initial in its own hue (@hanzo/ui `Avatar` seeded on
the org's id, as the org chooser draws it; the active one ringed, the others
counting what is unread there; "+" under them, the reader at the foot), the
workspace's column (its name, search, Channels bold and counted when unread,
Direct messages with who is here, the org's Agents with their roles), the
channel (name, topic, who is in it, the huddle), the messages with their cards
(a pull request, a draft, a file, a meeting, a list, a question, design
options), reactions and threads, who is typing, and the composer. A thread
stands beside the channel from 1000px of the preview's own width and over it
below; below 560px (or `phone`) it is the phone app: the orgs and the channels
under the channel's name, the channels wrapping rather than scrolling so every
one is on screen and none passes the edge (each with its count), and the rail
and the column a drawer, drawn only while it is open. It always lays itself out by its
own width.

The day is `src/workday.ts`, data and nothing else: thirteen scenes, 162
events, 6.4 minutes before it plays again (`LENGTH`; `workday.test.ts` holds it
over five). Four organizations: Acme (a sample company, nine channels), Orbit
(an open-source project Acme's people maintain with others), Friday Club
(friends) and Night Lab. The morning hops across three of them in under thirty
seconds (the test holds it): Acme's #general, Orbit thanking Dev for a fix that
landed upstream, friends planning tonight's build, and back to Acme's #eng. Then
at Acme a bug becomes a pull request that is reviewed, passes and merges
(#eng); Su drafts a support reply that Nia warms up (#support); Opera sorts the
inbox and Ada approves a batch, Law catches a renewal clause (#inbox); Fin
builds the deck and the model, Sal sends four intros and books a meeting
(#fundraise); Des shows two directions and hands off to Dev (#design); Huma
books interviews (#hiring); Mark's post is cut and translated, the checklist
closes in a huddle, and it goes live (#launch); Vi closes the day (#general).
Then the switcher flips to Friday Club, where friends build a recipe app and
Vi books game night. A message to a room out of view leaves it unread, and that
is what the next room is opened by. `pace` derives every wait from what came
before (the reading time of a message and its card, the typing, a room just
opened), and `frame` folds the events up to a beat into the whole screen, so
the component keeps no script state and every room holds at most 14 messages.

Pressing an org or a channel plays that room's own scene (`SCENE`); a draft's
Send, a question's answer and a design option answer a press; a thread opens
from its reply count. From the first press nothing loops over the reader. A
reader who asked for less motion, the server and the first paint get `STILL`:
#eng with the pull request merged, its thread and reactions, #support waiting.
People wear their initials (`Face`); agents wear the crew's memoji,
`/memoji/<id>.svg`, which this package ships in `assets/memoji` (every host
copies `assets/` into its public root). Every word is `phrase`/`t()`; names,
channels, files and repositories stay as written, and nothing on the screen is
a measurement.

hanzo.team's landing and hanzo.ai's /team open on it, and hanzo.ai's hero plays
it in its cycle: one component for every host, which is why it lives here.

`@hanzo/app/preview` is the clock every product preview plays on (hanzo.ai's
BotPreview too): `usePlay` (a script of beats, each `wait` ms after the last,
played while on screen, paused under the pointer, looped after `REST`),
`useStage` (seen, visible, held, its own width), `useStill` (reduced motion: the
whole script, still, and nothing plays), and what a host passes,
`PreviewProps`:

- `play` (default true; false holds the frame it is on);
- `onEnd` (the script's end; the last frame then holds, and a new key replays it;
  never under reduced motion);
- `compact` (fills the box it is given, a device's screen, and lays itself out by
  its own width: the desktop app from 600px, the phone's below);
- `phone` (the phone app whatever the width).

## The palette

ONE search (Palette.tsx, its decisions in seek.ts): the sidebar's search,
⌘K / Ctrl+K from anywhere (a field included; `summons`), which toggles it, in
Chat, Dev and Studio, and in the workspace frame (Shell) its bar's Search and
⌘K. No other search box: the Recents filter and the old `Find`
(`OrgCommandPalette`) are gone. It is @hanzo/ui's `CommandMenu` in a dialog
with no close button: one surface (the field and the list on the dialog's
ground, a hairline between), no box or ring on the field, a quiet `esc` at its
end, icons bare, the field's text, headings and labels on one edge. 640 wide,
as tall as its rows up to 520, its top fixed at 12% so typing never moves the
field; a phone's is a sheet the size of the screen, rows 44 high.

- An empty field lists Recent (chats and Dev tasks mixed, newest six, each its
  kind's icon), Actions, and Go to. A query searches Go to with the deeper
  places, Actions, Chats, Dev tasks (the product's own first on a tie),
  Projects, Agents, Skills and Connectors; each group keeps its best five and
  the group with the best answer leads (`find`, `rank`, `fit`: every word
  found, the label's start first, a typo's letters in order last). A title is
  drawn tidied (`lib/title.ts` `tidy`: a first message's `<workspace-files>`
  markup and a leading JSON object stripped, cut at 80), in the palette, the
  sidebar and the bell's Activity (56). Arrows move, Enter opens, Escape
  closes; Keyboard shortcuts is a page of help.ts's `KEYS`, Backspace comes
  back.
- GO TO IS DERIVED (`places`): the products (Chat, Dev, Studio, Tabs, Team),
  Dev's places from @hanzo/build `nav`, Settings, Referral and Beta status (the
  site's pages, loaded by the browser), Help center, and the apps in beta the
  reader may open (lib/betas.ts through `useBetas`, as the rail's More); a query also reaches
  Settings' pages (the `sections` that have one, `paged`, opened at
  /settings, with the account menu's names for General as keywords),
  Customize's tabs (`tabs`), the Library's kinds (`library`), Studio's places
  (@hanzo/studio `nav`) and the rest of help.ts's pages. A page added to any of
  those registries is in the palette with nothing written here. Machines is
  Dev's, never a Settings row.
- Under the composer: nothing. No plan line, no model line, no Terms · Privacy.
  The free lane's notice went in 0.1.83, the sheet that asked again at send
  went in 0.1.93, and the line under the composer went in 0.1.94. The
  data-share choice is made once at onboarding. The side panel is per conversation (`usePanel("chat:<thread>")`): shut
  until the reader opens it or a preview lands, never carried from the last
  chat.
- Every list is read once as it opens and searched in the page; nothing is
  read per key. Chats are titles: the conversations store (hanzoai/agent
  v1.0.14, `GET /v1/agents/chat/conversations`) answers the whole list and
  searches nothing, title or content, and no transcript is fetched to search
  one. They are the sidebar's last read (`useThreadList` keeps each client's
  last read per shelf), drawn at once and read again behind it. Dev tasks are
  `useSessions(host)`, Projects `GET /v1/projects` (name, slug, repository),
  Skills the org's active ones (`GET /v1/tool/skills?activated=true`),
  Connectors `GET /v1/tool/mcp/servers`, Agents the org's and the house cast
  (crew.tsx `ordered(useCrew())`). A read the palette closes on is aborted.
  Studio's conversations are not listed: @hanzo/studio exports no reader of
  them (its `useChats` is internal).
- A row opens where it lives: a chat at `talk(id)`, a task or a project in Dev
  (`app(id)`), an agent in a new chat with it alone (`withAgents`), a skill or
  a connector in Dev's Customize. The actions (`actions`): New chat, New Dev
  task, New Studio creation, New scheduled task, Upload (the Library's own),
  Switch model (opens the composer's model menu, New chat's on a page without
  one), Toggle theme (`host.chooseTheme`), Switch organization (session.ts
  `choose`), Keyboard shortcuts, Log out; what the host cannot do is not
  offered. A frame passes its own `actions`: one with a Go to row's id stands
  in for it, the rest follow under Go to (Shell's apps and Setup rows).

## What each app still owns

hanzo.ai: its marketing site, the gate in front of `App` (`_web.tsx`), the plan snapshot,
`lib/models` (the catalogue; naming comes from `@hanzo/app/lib/models`).
hanzo.team: its landing, sign-up, sign-in gate, the `/agents` page, and its own
`lib/host` (BRAND, BOOKING), `lib/auth/client` (its sign-in flow) and
`lib/analytics/tags` (its GA4/Pixel boot).
