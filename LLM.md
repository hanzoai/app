# @hanzo/rooms

The workspace rooms — Home, Chat, Inbox, Contacts, Meet, Cal, Drive, Board,
Work, Bots, Settings — and the frame that holds them (Room, Shell,
Orgs), once, for every surface. hanzo.ai and hanzo.team import them; neither
keeps a copy. Repo `github.com/hanzoai/rooms`, npm `@hanzo/rooms`.

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
import { configure } from '@hanzo/rooms'
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

## Rules the rooms keep

- The app's products are marks on its rail (Rail.tsx), Chat first and Dev
  second, then More, a menu of the products on hosts of their own (Tabs, Team),
  and the account at the foot. The rail moves the app, and Shell's sidebar wears
  the product's name alone; the one Chat | Dev switch is a phone's bar, which
  has no rail. Dev's
  places are rows in the sidebar (Column), from @hanzo/build's `nav`
  (≥ 0.2.53), the one list every rail draws, each under a quiet group label
  (Work, Make, Run, Setup); Shell draws its Setup rows the same way. Shut, the
  sidebar takes Dev's places with it and the rail stays.
- Skills, connectors, plugins and agents have one home, Dev's Customize: Shell's
  Customize row and Settings' Plugins and Skills rows lead there (`app()`), and
  Directory lists only Works with and Channels. A list is the registry's answer
  or a plain line saying why there is none — never rows standing in for it.
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

- `src/*.tsx` — the rooms, as `components/workspace/*` was in hanzo.ai; each is
  a subpath (`@hanzo/rooms/CalScheduler`).
- `src/bots/*` — the Bots room.
- `src/lib/*` — the workspace's infrastructure, one copy for every host:
  `session`, `destination`, `api`, `ai` (useAi), `account`, `tier`, `limits`,
  `plans`, `pay` (the pay site and money, apart from the plan catalogue), `share`, `coding`, `todo`, `durable`, `tags`, `host` (estate routing and the app's addresses),
  `mix`, `hydrated` … Apps import these from the package
  (`@hanzo/rooms/lib/session`) and keep no copy.
- `lib/session` `orgs()` is every org of the token's `orgs` claim but a brand's
  directory (`DIRECTORIES`: hanzo-id, lux-id, zoo-id, pars-id, hanzoai/authz
  `IsDirectory`): a directory is a customer account's home and nobody's tenant,
  so no picker offers it and no request is scoped to it. `home()` is the claim's
  first entry, directory or not: `me()` keys the account by it.
  `superAdmin()` is @hanzo/iam's `superAdmin(claims)` (hanzoai/authz
  `Claims.Sudo`): a person whose `orgs[0].org` is `admin`, never a program and
  never an empty home shifted onto a later entry. No copy of the rule lives here.
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
  serves the directory at its root: it copies `@hanzo/rooms/assets` into
  `public/` on `prebuild`/`predev` and keeps no copy in git.

## The app's addresses

`lib/host.ts` is the one module that writes and reads the web app's addresses,
and they are paths: `/chat`, `/chat/<id>` (`talk`), `/dev` and every builder
place under it (`app`, from @hanzo/build/route `href`): `/dev/run/<id>`,
`/dev/projects`, `/dev/projects/<org>/<repo>` a repository,
`/dev/projects/<slug>` a deployed site, `/dev/issues`, `/dev/artifacts`,
`/dev/machines`, `/dev/environments`, `/dev/customize[/<tab>]`,
`/dev/settings[/<section>]` … `place` reads a path back, `go` moves the app with
a history entry, `dev(ref)` is the door from anywhere (through `site()`), `page`
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

`pnpm build` = team strings → `tsc` → `scripts/specifiers.mjs` (every relative
import fully specified, so Node's ESM loader resolves dist outside a bundler).
Gates: `pnpm typecheck`, `pnpm lint:design` (ratchet in
`hanzo-design.allow.json`), `pnpm build`. Publish: bump `version`, push main;
`.github/workflows/publish.yml` publishes what npm does not serve.

## Plan usage

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
builder's Usage (`useDevHost` answers `showSettings` there). A switch goes
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
by @hanzo/build (`useMind`, `hanzo.mind` = `{model, effort}`, Enso and Medium by
default). On Free (`GET /v1/ai/limits` `plan` = `free`, and every
visitor) the choice is the catalog's free class alone: Enso Free by default,
every other model listed with Upgrade, which opens the upgrade instead of
picking. Chat's composer draws @hanzo/build's chip (`Tune`): the effort (Low,
Medium, High — what `reasoning_effort` and a coding run's `effort` both take;
a model the catalog lists as not reasoning offers none), a sentence saying
what serves the ask, and `@hanzo/ui/models` `ModelPicker` over the whole catalog
(`GET /v1/models`, read once and shared with Dev): Hanzo's families first, then
every maker. A listed pick is sent as picked; only a name the catalog does not
list falls to `served`. A model's class and family are the catalog's fields,
never read from its id. A premium pick holds for the conversation and is never
kept (`usePick`); Settings' default picker writes the same choice and offers no
premium model. A paid plan's pick is not gated: the gateway refuses or answers
from Enso, and the room shows that. The live web rides a turn whose model the
catalog files under Enso or Zen (`house`).

## Chat and Dev are drawn alike

- The composer is @hanzo/build's `prompt` (Chat passes it to `@hanzo/ui/chat`
  `Chat`'s `composer`), one frame for Chat and Dev: the field on top ("Type /
  for skills"), then one row — `+` at the start and what the conversation
  carries as chips (who is in the room, the skills on, Research, Plan), and at
  the end dictation (the mic and its menu: the microphones with a live level,
  Dictation settings, Language) and one round button that is voice mode while
  the draft is empty, send with words, stop while a turn runs. Under the frame,
  at its end: the model, the effort (dim) and the mode pill (Auto, Plan); Dev
  puts where the run goes and its repository at that row's start. Under that,
  up to three suggestions while nothing has been said (above the frame on a
  phone). `/` lists the skills above the frame. As wide as the words above it
  (`measure`); cut as a pane in the app's frame.
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
  panel in. Its edge is the kit's `Grip`; the width is the person's, kept in
  their preferences (`side.width`, `PATCH /v1/pref`, read by the `PrefsProvider`
  App mounts, one document for Chat and Dev; without one, as in hanzo.team's
  shell, it lasts the page). Pulled over the conversation the column takes its
  room, the conversation hidden and never unmounted, until the strip's Show chat
  or a pull back out; the strip's full-screen button puts the panel over the
  window and Escape returns. A drag writes two elements a frame, no React commit.
  An answer that finishes writing a page while the panel is open opens it there.
- `pane.ts` holds only what goes with the next message (files, refusals).

## Agents

- The composer's `+` › Agents is `useAgentShelf()` (crew.tsx): the org's agents
  (`useCrew`) with the default cast filling in any member the org keeps no row
  for, the cast first (agents.ts `ordered`), each by its `Face` at 16px; on is
  in the open conversation (`useOpen().agents`) and a pick toggles it there
  (`openAgent`). Create agent and Browse personas open `Hire` through `make()`;
  the host mounts `<AgentMaker />` once beside the composer to draw it. Manage
  agents is Dev's Customize › Agents (`app('-/customize/agents')`). The Shelf,
  Row and Link types are @hanzo/build plus.tsx's, copied in agents.ts until
  build publishes them.
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

`@hanzo/rooms/App` is the web app as the whole window: the rail, the sidebar,
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
- The rail, one order: Chat, Dev, Studio (@hanzo/studio, the app's third mode at /studio),
  Library (Dev's Artifacts), Scheduled tasks (Automations), Customize, then More (Projects, Templates, Issues, Machines,
  Environments | Tabs, Team), the account's face at the foot. Each mark is an
  app: 36px on a 44px pitch, its name its tooltip, lit where the reader is.
  Library, Scheduled tasks and Customize are Dev places raised to the rail.
- The sidebar's toggle is at the window's top-left: the rail's first mark in a
  browser tab. A host that is a window passes `bar` (`<App bar={{ inset, drag
  }} />`) and App draws the window's 40px bar: the toggle, then Back and
  Forward through the host's router, `inset` px clear for the window's own
  controls, `drag` the attributes its shell reads as the drag region. Shut is
  kept per browser under `hanzo.build.rail`; the sidebar's edge pulled in past
  its floor shuts it too.
- The sidebar: the mode's name (18/600, no chevron), the bell (the org's run
  activity and Notification settings) and the search (the palette, below;
  ⌘K / Ctrl+K from anywhere), New chat or Dev's places, then Pinned and
  Recents as plain 14px titles on a 31px pitch — no dates, no icons; a run's
  state is a dot at its end. The Recents view menu stands at the heading's end.
- The account menu (Me.tsx) is the one account menu: the rail's face draws it
  for Chat, Dev and Studio, and the shell's sidebar foot for every other app
  (`Who`, the host's person, org, api, token and sign-out). @hanzo/ui's
  DropdownMenu, top to bottom: the account row (face, name, plan) whose ›
  holds the meter and the organizations (switch, create, settings, Team, All
  organizations for a SuperAdmin); Upgrade plan (named by the plan: Enterprise
  plan, Agency plan, else Upgrade plan; the pay site, `leave`);
  Personalization (Settings → General), Profile (Settings → Account), Settings
  (⌘, / Ctrl+,); Help ›; Log out. Settings' rows go through `showSettings`,
  which App answers with the builder's Settings (dev.tsx) and the shell with
  its pane. Help › (help.ts, every address through `site()`): Help center
  (/support), Privacy center (/legal), Release notes (hanzoai/cli releases, as
  the site's nav), Download apps (/download), Keyboard shortcuts, then Terms of
  Service (/legal/terms) and Privacy Policy (/legal/privacy). Keyboard
  shortcuts is a dialog over help.ts `KEYS`, the one list of the app's keys;
  ⌘/ / Ctrl+/ opens it from anywhere (the drawer's copy of the rail, `above`,
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
  the device's top inset — a 44px circle that opens the sidebar as a drawer, the
  rail laid along the drawer's foot (`flat`); the 158×48 pill Chat | Dev, which
  moves the app as the rail does (neither lit in Studio); and a 44px circle for
  the mode's New (New chat, else the mode's `nav` `NEW` row). Glass is `pane()`
  cut round with a `--border-strong` edge, so the solid fallback and both themes
  are design's.
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

## The palette

ONE search (Palette.tsx, its decisions in seek.ts): the sidebar's search,
⌘K / Ctrl+K from anywhere (a field included; `summons`) in Chat, Dev and
Studio, and in the workspace frame (Shell) its bar's Search and ⌘K. No other
search box: the Recents filter and the old `Find` (`OrgCommandPalette`) are
gone. It is @hanzo/ui's `CommandMenu` in a dialog, 680 wide and 520 tall,
the whole screen on a phone (its rows a 44px target, the kit's `touch`).

- An empty field lists Recent chats, the newest eight; a query lists Chats,
  Projects, Agents, Skills and Actions, each its best five (`find`, `rank`:
  every word found, the label's start first). Arrows move, Enter opens, Escape
  closes; Keyboard shortcuts is a page of the app's keys, Backspace comes back.
- Every list is read once as it opens and searched in the page; nothing is
  read per key. Chats are titles: the conversations store (hanzoai/agent
  v1.0.14, `GET /v1/agents/chat/conversations`) answers the whole list and
  searches nothing, title or content, and no transcript is fetched to search
  one. They are the sidebar's last read (`useThreadList` keeps each client's
  last read per shelf), drawn at once and read again behind it. Projects are
  `GET /v1/projects` (name, slug, repository), Skills the org's active ones
  (`GET /v1/tool/skills?activated=true`), Agents the org's and the house cast
  (crew.tsx `ordered(useCrew())`). A read the palette closes on is aborted.
- A row opens where it lives: a chat at `talk(id)`, a project in Dev
  (`app(slug)`), an agent in a new chat with it alone (`withAgents`), a skill
  in Dev's Customize, an action runs: New chat, New Dev task, Settings,
  Customize, Keyboard shortcuts, Log out (`lib/signout`). A frame passes its
  own `actions`; one with a palette action's id stands in for it (Shell's
  Settings opens its own pane), the rest follow (Shell's apps and Setup rows).

## What each app still owns

hanzo.ai: its marketing site, the gate in front of `App` (`_web.tsx`), the plan snapshot,
`lib/models` (the catalogue; naming comes from `@hanzo/rooms/lib/models`).
hanzo.team: its landing, sign-up, sign-in gate, the `/agents` page, and its own
`lib/host` (BRAND, BOOKING), `lib/auth/client` (its sign-in flow) and
`lib/analytics/tags` (its GA4/Pixel boot).
