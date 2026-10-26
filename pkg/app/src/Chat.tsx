"use client";

// /chat's pane: the conversation.
//
// `@hanzo/ai` holds the thread and `@hanzo/ui/chat` draws it — `<Chat {...useChat()} />`
// is one call by design, and the two packages were shaped to make exactly that
// call typecheck. Nothing about the conversation is written here.
//
// WHO CAN SEND: an account. `/v1/agents/chat` answers a signed-out caller
// "a validated principal is required" — measured on production, with and
// without the publishable key the bundle ships and with a browser's own Origin
// — so a visitor's first message comes back refused however the room is drawn.
// The room says that in the reader's words and offers the way past it; what it
// must not do is describe an account they do not have.
//
// The free MODEL is a separate question and still exists: `anonymous` opens on
// the free pool, so what changes at sign-in is the menu, not the room.
//
// The FREE lane is about PRICE, not identity: a free turn spends no balance and
// is data-shared in exchange. That choice is made once, at onboarding, where
// the terms are linked. Nothing under the composer repeats it. Signing in buys
// the paid models and a history that follows you; it is never the price of
// asking a question.
//
// This file used to branch on `isAuthenticated` and hand a visitor a composer
// whose only action was a trip to hanzo.id, captioned "Sign in to send". The
// branch is gone. If the gateway refuses an anonymous free turn, that answer
// belongs in the thread where the reader can see it, not in a caption that
// pre-emptively refuses on the gateway's behalf.

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isolate, phrase } from "@hanzo/i18n";
import { useI18n } from "@hanzo/i18n/react";
import { billed, detail, familyOf, planRequired, plainly, refused } from "./failure";
import { english, type Say } from "./say";
import { Prose } from "./Prose";
import {
  useAgent,
  useAi,
  useChat,
  type ChatMessage,
} from "@hanzo/ai/react";
import { Chat as ChatSurface, Failure, Parts, words, type Said } from "@hanzo/ui/chat";
import { carriedIn, carrying, compose, partsOf, said as told, weigh } from "./lib/attach";
import { download, dropped, fileOf, pct, readable, refOf, retrieve, type Api, type FileRef, type WorkFile } from "./lib/files";
import { channel, drop, hold, landed, localOf, spend, take, usePane, useWorkFile, type Held, type Via } from "./pane";
import { Face, brief as roomBrief, join, roleOf, roomTurn, roster as rosterLine, rosterOf, speakers, speaksOf, voiceOf } from "./cast";
import { cleanForSpeech, speakAgent } from "./speech";
import { AgentMaker, HOUSE, useAgentShelf, useCrew } from "./crew";
import { called } from "./team";
import { Anchor, Box, Button, Text, View, XStack, YStack } from "@hanzo/ui";
import { useMedia } from "@hanzo/gui";
import { given, tidy } from "./lib/title";
import { useIam, useIamToken } from "@hanzo/iam/react";
import { bearer, hasSession, named, org } from "./lib/session";
import { api } from "./lib/api";
import { app, dev, go } from "./lib/host";
import { useRooms } from "./host";
import { chats, house, paidPlan, paused, setCreditsAfterAllowance, useLimits } from "./lib/limits";
import { LimitedBanner } from "@hanzo/ui/product/LimitedBanner";
import type { LimitAction } from "@hanzo/ui/product/limits";
import { WEB } from "./lib/web";
import { useHydrated } from "./lib/hydrated";
import { base, served } from "./lib/ai";
import { onServed, type Served as Heard } from "./lib/served";
import { refused as worded, speech, useDictation, useTalk, useVoice } from "@hanzo/voice";
import { Check, Clock, FileText, Image as ImageMark, Library as LibraryMark, Paperclip, Sparkles, X, Zap } from "lucide-react";
import { FREE, ENSO } from "./lib/ai";
import { openThread, useOpen } from "./open";
import { Beside, Framed } from "./Shell";
import { SEED, look, useSections, useSites, type Mark } from "./RightPane";
import { Share } from "./Share";
import { ConversationMenu, ThreadMore, useThreadList } from "./thread";
import { Schedule } from "./Schedule";
import { keepFile, useAttach, useKeep } from "./keep";
import { dragWindow, toggleWindowMaximize } from "./WindowControls";
import {
  artifacts,
  lead,
  nameOf,
  PAGE,
  Panel,
  PanelToggle,
  prompt,
  renders,
  Reply,
  Served,
  Summary,
  useDeck,
  useKey,
  Suggestions,
  useCarry,
  useLanguage,
  useMention,
  useMind,
  useSuggestions,
  book,
  hand,
  taken,
  want,
  path as devPath,
  type Act,
  CHAT_MODES,
  usePanel,
  type Artifact,
  frames,
  name as tabName,
  type Kind,
  type Listen,
  type PromptOptions,
} from "@hanzo/build";
import type { ModelCatalogEntry as Model } from "@hanzo/ui/models/catalog";
import { checkoutUrl, payUrl } from './lib/pay';
import { Upgrade, useFree, type Ask } from './Upgrade';
import { enter, LOGIN } from './lib/destination';
import { first } from './lib/first';
import { BAD } from "./lib/mix";
import { brand } from './where'
import { BAND } from './ground'
import { ThinkingEffort, type EffortLevel } from './ThinkingEffort'
import { shared, useChatPreferences } from './lib/chatPreferences'

// NO REASONING PANEL HERE. Every assistant turn opened a "Thinking" disclosure
// listing seven steps — "Planning CSS extraction for chat styles", "Designing
// responsive top bar grid layout" — typed into this file as a literal array.
// They were the same seven under every answer in every conversation, and they
// described the writing of this component rather than anything a model did. A
// reasoning trace belongs to a turn; when the wire carries one it can be drawn
// from the turn, and until then the answer stands on its own.
//
// The queued-message box went with it: a second unmounted component, holding
// the file's last use of the chevrons imported for the panel.

/**
 * The room's reading measure: the design system's prose width, which is what
 * the Width setting (@hanzo/appearance) retunes. 48rem is 768px, the width this
 * room has always read at, so an untouched setting changes nothing.
 */
const MEASURE = "var(--container-prose, 48rem)";

/**
 * The text this screen arrived with, TYPED INTO THE COMPOSER — never sent.
 *
 * `?q=` means "a question came with the page", and the previous answer to that
 * was to send it on mount. That was wrong in a way one send did not fix: a link
 * is not consent to spend. The
 * question reached two routes (/chat and, once /models mounted `Ask`, that page
 * too), so `hanzo.ai/models?q=…` was a URL that spent a stranger's credits on
 * text a stranger chose and wrote it into their history. Prefilling removes the
 * whole class rather than capping it at one — a human presses send, or nothing
 * is spent.
 *
 * `q` is still CONSUMED from the address: it has done its job once it is in the
 * box, and leaving it there means a reload re-types over whatever was written
 * since.
 */
function useOpening(): { text: string; thread: string | null } {
  const [text, setText] = useState("");
  const [thread, setThread] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const url = new URL(window.location.href);
    const asked = url.searchParams.get("q");
    // A conversation carried in from hanzo.chat. The free chat records the thread
    // under the reader's own account and sends its id, never the transcript; this
    // room opens that thread once the reader is signed in. Struck from the bar
    // like `?q=`, for the same reasons.
    const carried = url.searchParams.get("thread");
    if (asked !== null || carried !== null) {
      url.searchParams.delete("q");
      url.searchParams.delete("thread");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    const found = (asked || "").trim();
    if (found) setText(found);
    const id = (carried || "").trim();
    if (id) setThread(id);
  }, []);

  return { text, thread };
}

/** Types an arriving question into a composer once it lands. */
function useSeed(initial: string | undefined, set: (t: string) => void) {
  const apply = useRef(set);
  apply.current = set;
  useEffect(() => {
    if (initial) apply.current(initial);
  }, [initial]);
}

export function Chat() {
  const { isAuthenticated, isLoading } = useIam();
  const hydrated = useHydrated();
  // Read HERE, not in the child, and it stays here now that there is one child:
  // two components consuming `?q=` meant whichever mounted first stripped it and
  // the one that ended up on screen found nothing.
  const { text: opening, thread: carried } = useOpening();

  const settled = hydrated && !isLoading;
  const signedIn = isAuthenticated || hasSession();

  // The carried thread opens once there is somebody to open it for. Before
  // sign-in it waits; `rememberDestination` already keeps `?thread=` through the
  // trip to the issuer and back, so the id arrives here a second time and opens.
  useEffect(() => {
    if (carried && settled && signedIn) openThread(carried);
  }, [carried, settled, signedIn]);

  // The client is the SHELL's — one per room, so the thread and the roster share
  // a session rather than each minting its own. `Thread` is therefore only ever
  // mounted under the provider the shell already put above it.
  //
  // ONE room, for everyone. `anonymous` changes which models are on offer and
  // nothing else — the composer and the transcript are the same components
  // either way, because a visitor is having the same conversation.
  //
  // The conversations are NOT drawn here. `Threads` is the list and the shell
  // owns the column it sits in — one sidebar for six rooms, already built, and a
  // second one in this pane would be two designs for one job. This file draws
  // the conversation; the shell draws the room.
  return <Thread initial={opening} anonymous={settled && !signedIn} />;
}

/**
 * The same conversation, embedded in a page that is not /chat.
 *
 * R8: there were TWO live chat surfaces, so /models mounts this one and the
 * second is gone. The data-share choice is made once at onboarding; this room
 * does not ask again when a message is sent. It carries no
 * heading of its own: the host page already has one, and a second `<h1>` is the
 * defect that took the landings off /chat and /dev.
 *
 * The host supplies the `AiProvider`, because the host is what knows whether it
 * already has one.
 */
export function Ask({
  placeholder,
  idle,
}: {
  placeholder?: string;
  idle?: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useIam();
  const hydrated = useHydrated();
  const { text: opening } = useOpening();
  const signedIn = isAuthenticated || hasSession();

  if (!(hydrated && !isLoading)) return <>{idle}</>;
  return (
    <Thread
      placeholder={placeholder}
      initial={opening}
      anonymous={!signedIn}
      heading={null}
    />
  );
}

/**
 * The resting placeholder.
 *
 * The package defaults to "Ask anything" and argues for it against
 * "Message <model>" — a name that moves renames the control every time the
 * model does. This is not that: it is the PRODUCT's name — the host's brand,
 * Hanzo AI or Hanzo Team — and it is already how this file addresses a
 * character (`Message ${persona.name}`). `label` stays "Ask anything", so the
 * accessible name does not move when the placeholder does.
 */
const message = (): string => `Ask ${brand()}`;

/** The panel offers no kinds of its own in Chat: its tabs are pages. */
const NONE: readonly Kind[] = [];

/** The id the room's system turn is held under in the thread. */
const ROOM = "room";

/** The models that route a turn rather than name the one that answers it. */
const ROUTERS = new Set(["enso", "enso-auto", "enso-free", "hanzo/enso", "auto", "free"]);

/** The id of the turn drawn in the thread when a turn is refused. */
const FAILED = "failed";

/** The turns with the room's system turn first, or without one for an empty room. */
function seated(turns: ChatMessage[], turn: string | null): ChatMessage[] {
  const rest = turns.filter((one) => one.id !== ROOM);
  return turn ? [{ id: ROOM, role: "system", content: turn }, ...rest] : rest;
}

/** An answer that came back with nothing in it. */
const blank = (one: ChatMessage): boolean =>
  one.role === "assistant" && !String(one.content ?? "").trim() && !one.tool_calls?.length;

/** What an unanswered question met: a refusal, an empty answer, or a stream that said nothing. */
interface Failed {
  error: Error | null;
  empty?: boolean;
  stalled?: boolean;
}

/**
 * The agents a question speaks to: those it names, or the whole room when it
 * names nobody — the rule the room's brief gives the model (cast.tsx `brief`).
 */
export function addressed(question: string, room: string[]): string[] {
  const named = room.filter((name) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu").test(question),
  );
  return named.length ? named : room;
}

/**
 * Which kind of refusal a failed turn met, read off the platform's own codes:
 * the caller's wallet (`insufficient_balance`, the ai service's spend check), a visitor's
 * spent free messages (`public_allowance_spent`), or a model provider that did
 * not answer (`providers_exhausted`, or any 5xx that is not the balance lookup).
 */
export function refusalOf(error: Error): { wallet: boolean; visitor: boolean; provider: boolean } {
  const status = (error as { status?: unknown }).status;
  const body = (error as { body?: unknown }).body as { code?: unknown; error?: { code?: unknown } } | null | undefined;
  const codes = [body?.code, body?.error?.code, (error as { code?: unknown }).code].filter(
    (one): one is string => typeof one === "string",
  );
  const has = (code: string) => codes.includes(code);
  return {
    wallet: has("insufficient_balance"),
    visitor: has("public_allowance_spent"),
    provider:
      !has("balance_unavailable") &&
      !has("insufficient_balance") &&
      (has("providers_exhausted") || (typeof status === "number" && status >= 500)),
  };
}

/** What the server said about a failure, folded under its plain line. */
function Why({ text }: { text: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <YStack gap="$1">
      <XStack render="button" aria-expanded={open} onPress={() => setOpen((v) => !v)} cursor="pointer">
        <Text fontSize="$2" color="$soft">
          {t(open ? "Hide details" : "Details")}
        </Text>
      </XStack>
      {open ? (
        <Text fontSize="$2" color="$soft">
          {text}
        </Text>
      ) : null}
    </YStack>
  );
}

/**
 * How long a turn may stream without a word before it is stopped and said to
 * have failed. Long enough for a model that reasons at High effort before it
 * writes, which streams no words while it does.
 */
const STALL = 300_000;

/** Characters of a streaming reasoning trace a turn shows: its tail. */
const THOUGHT = 320;

/**
 * How long a send waits for a freshly attached file to have passages before it
 * goes without them. Long enough for a page or a short document to be read; a
 * large one keeps indexing, and the turn says it is not readable yet.
 */
const READ_WAIT = 45_000;

/** Files named the way a sentence lists them: in the reader's words through `t`, in English for the model. */
function names(list: readonly { name: string }[], t: Say = english): string {
  const all = list.map((f) => f.name);
  if (all.length < 2) return all[0] ?? "";
  return all.length === 2
    ? t("{first} and {second}", { first: all[0]!, second: all[1]! })
    : t("{first}, {second} and {more} more", { first: all[0]!, second: all[1]!, more: all.length - 2 });
}

/** Why the files had no passages to give, from what the index last said of each. */
function unread(list: readonly WorkFile[]): string | undefined {
  const parts = list.map((f) =>
    f.status === "stored"
      ? `${f.name} is kept but not indexed${f.error ? `: ${f.error}` : ""}`
      : f.status === "failed"
        ? `${f.name} could not be indexed${f.error ? `: ${f.error}` : ""}`
        : f.status !== "ready"
          ? `${f.name} is still being indexed`
          : null,
  );
  const said = parts.filter(Boolean).join("; ");
  return said || undefined;
}

/** The files a turn carries that are indexed less than whole, and why. */
function partly(list: readonly WorkFile[]): string | undefined {
  const parts = list.filter((f) => f.note).map((f) => `${f.name}: ${f.note!.replace(/\n/g, " ")}`);
  return parts.length ? parts.join("; ") : undefined;
}

/** How far a file has got, in a word or two, in the reader's words. */
function progress(state: Held["state"], sent: number, f: WorkFile | undefined, t: Say): string {
  if (state === "uploading") return t("{percent}%", { percent: Math.floor(sent * 100) });
  if (state === "queued") return t("queued");
  if (state === "indexing") {
    const word = f?.stage ? t(STAGE[f.stage]) : t("indexing");
    const at = f ? pct(f) : undefined;
    return at === undefined ? word : t("{stage} {percent}%", { stage: word, percent: at });
  }
  if (state === "ready" && f?.clipped) return t("ready, in part");
  return t(STATE[state]);
}

/** What each stage of a file's ingest is doing, in a word. */
const STAGE: Record<NonNullable<WorkFile["stage"]>, string> = {
  extract: phrase("reading"),
  toc: phrase("contents"),
  passages: phrase("passages"),
  graph: phrase("linking"),
  embed: phrase("vectors"),
};

/** A file's state where `progress` names it by the index's own word. */
const STATE: Record<Held["state"], string> = {
  uploading: phrase("uploading"),
  queued: phrase("queued"),
  indexing: phrase("indexing"),
  ready: phrase("ready"),
  stored: phrase("stored"),
  failed: phrase("failed"),
};

/** How a file is drawn: a picture, a PDF's tile, or a chip. Read off its type, else its name, since a store may answer with neither. */
function kindOf(name: string, type: string): "image" | "pdf" | "file" {
  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(name)) return "image";
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  return "file";
}

// SIGNED ADDRESSES FOR PICTURES, by workspace file: a list of turns mounts and
// remounts its chips, and asking the store each time would be a request per
// picture per redraw. Kept for less than a signature lives (the store's are
// five minutes), so a chip mounted later reads a fresh one; a picture already
// drawn keeps its pixels whatever becomes of its address.
const signed = new Map<string, { at: number; got: Promise<string> }>();
const SIGNED_FOR = 4 * 60_000;

function signedOf(api: Api, id: string, file?: WorkFile): Promise<string> {
  const kept = signed.get(id);
  if (kept && Date.now() - kept.at < SIGNED_FOR) return kept.got;
  const got = (file?.bucket && file.key ? Promise.resolve(file) : fileOf(api, id)).then((f) => download(api, f.bucket, f.key));
  signed.set(id, { at: Date.now(), got });
  got.catch(() => signed.delete(id));
  return got;
}

/**
 * Where a picture's thumbnail reads from: the bytes on this machine where this
 * document holds them (the held file's object URL, which outlives its send),
 * else a signed address for the workspace's copy — a file taken from Drive, or
 * a turn read back after a reload. '' until there is one.
 */
function usePicture(on: boolean, href: string, id: string | undefined, file: WorkFile | undefined): string {
  const api = useAi();
  const near = on ? href || (id ? localOf(id) : "") : "";
  const [far, setFar] = useState("");
  const bucket = file?.bucket;
  useEffect(() => {
    if (!on || near || !id) return;
    let live = true;
    signedOf(api, id, file).then(
      (url) => live && setFar(url),
      () => {},
    );
    return () => {
      live = false;
    };
    // The file's record moves with every stage of its ingest; its address does not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, near, id, bucket, api]);
  return near || far;
}

/** Edge of a picture's or a PDF's thumbnail, in px. */
const THUMB = 48;

/**
 * One file put into a message.
 *
 * A PICTURE SHOWS ITSELF and a PDF shows a tile, each with its name and size
 * beside it; any other kind is a chip of its name. Nothing is filled behind
 * them: a hairline on whatever they sit on, so a file reads alike over the
 * composer and inside a turn's bubble, in a light room and a dark one. A second
 * fill on the bubble's was the darker grey that read as a stain. The word for
 * how far a file has got shows only while it is getting there — a picture of
 * the file already says it is attached — and `data-state` keeps the index's own
 * word for whoever reads it.
 *
 * Pressing one opens it beside the conversation (`onOpen`).
 */
function Chip({
  name,
  type,
  size,
  state,
  sent,
  file,
  picture,
  onOpen,
  onRemove,
  onSave,
}: {
  name: string;
  type: string;
  size: number;
  state: Held["state"];
  sent: number;
  file?: WorkFile;
  /** The picture's address, or '' — none yet, or not a picture. */
  picture: string;
  onOpen: () => void;
  onRemove?: () => void;
  /** Keeps it in the reader's Library. */
  onSave?: () => Promise<unknown>;
}) {
  const { t, dir } = useI18n();
  const kind = kindOf(name, type);
  const bad = state === "failed";
  const why = state === "failed" || state === "stored" ? file?.error : file?.note;
  // A picture the browser cannot draw (HEIC, a lapsed signature) falls back to its glyph.
  const [broken, setBroken] = useState("");
  const word = state === "ready" ? (file?.clipped ? t("in part") : "") : progress(state, sent, file, t);
  // Each part keeps its own order in right-to-left text: a size or a percent is not reordered with the words around it.
  const meta = [kind === "pdf" ? "PDF" : "", size > 0 ? weigh(size) : "", word]
    .filter(Boolean)
    .map((part) => (dir === "rtl" ? isolate(part) : part))
    .join(" \u00b7 ");
  const remove = (
    <>
      {onSave ? <Keep name={name} onSave={onSave} /> : null}
      {onRemove ? (
        <Box render="button" aria-label={t("Remove {name}", { name })} onClick={onRemove} p="$1" rounded="$10" shrink={0} hoverStyle={{ bg: "$hover" }}>
          <X size={12} aria-hidden />
        </Box>
      ) : null}
    </>
  );
  const marks = {
    role: "listitem",
    "data-slot": "file-chip",
    "data-state": state,
    "data-kind": kind,
    "data-stage": file?.stage ?? "",
    ...(why ? { title: why } : null),
  } as object;

  if (kind === "file")
    return (
      <XStack {...marks} self="center" items="center" gap="$1" paddingInlineEnd={onRemove ? "$1" : "$2.5"} rounded="$10" borderWidth={1} borderColor="$borderColor" maxW={320}>
        <XStack render="button" aria-label={t("Open {name}", { name })} onClick={onOpen} items="center" gap="$1.5" paddingInlineStart="$2.5" py="$1" minW={0} cursor="pointer">
          <Paperclip size={12} aria-hidden color="var(--muted-foreground)" />
          <Text fontSize="$2" color="$ink" numberOfLines={1}>
            {name}
          </Text>
          {meta ? (
            <Text fontSize="$1" color={bad ? BAD : "$soft"} numberOfLines={1} shrink={0}>
              {meta}
            </Text>
          ) : null}
        </XStack>
        {remove}
      </XStack>
    );

  const drawn = kind === "image" && picture && broken !== picture;
  const Glyph = kind === "pdf" ? FileText : ImageMark;
  return (
    <XStack {...marks} items="center" gap="$1" p="$1" paddingInlineEnd={onRemove ? "$1" : "$2.5"} rounded="$4" borderWidth={1} borderColor="$borderColor" maxW={280}>
      <XStack render="button" aria-label={t("Open {name}", { name })} onClick={onOpen} items="center" gap="$2" minW={0} cursor="pointer">
        <YStack
          data-slot="file-thumb"
          width={THUMB}
          height={THUMB}
          shrink={0}
          rounded="$3"
          overflow="hidden"
          items="center"
          justify="center"
          gap="$0.5"
          borderWidth={drawn ? 0 : 1}
          borderColor="$borderColor"
        >
          {drawn ? (
            <View
              render={<img src={picture} alt="" loading="lazy" decoding="async" onError={() => setBroken(picture)} />}
              width="100%"
              height="100%"
              objectFit="cover"
              display="block"
            />
          ) : (
            <>
              <Glyph size={18} aria-hidden color="var(--muted-foreground)" />
              {kind === "pdf" ? (
                <Text fontSize={9} fontWeight="600" letterSpacing={0.5} color="$soft">
                  PDF
                </Text>
              ) : null}
            </>
          )}
        </YStack>
        {/* `text` because a button centres what it holds; a name and its size read from the line's start. */}
        <YStack minW={0} gap="$0.5">
          <Text fontSize="$2" color="$ink" numberOfLines={1} text="start">
            {name}
          </Text>
          {meta ? (
            <Text fontSize="$1" color={bad ? BAD : "$soft"} numberOfLines={1} text="start">
              {meta}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      {remove}
    </XStack>
  );
}

/**
 * "Save to Library" on a file the reader put into the conversation: pressed, it
 * keeps the file in their Library and says so; a refusal is its title.
 */
function Keep({ name, onSave }: { name: string; onSave: () => Promise<unknown> }) {
  const { t } = useI18n();
  const [state, setState] = useState<"" | "saving" | "saved">("");
  const [wrong, setWrong] = useState("");
  const label = state === "saved" ? t("{name} is in your Library", { name }) : wrong || t("Save {name} to Library", { name });
  return (
    <Box
      render="button"
      aria-label={label}
      {...({ title: label } as object)}
      data-slot="keep"
      data-state={state || (wrong ? "failed" : "")}
      aria-disabled={state !== ""}
      onClick={() => {
        if (state) return;
        setState("saving");
        setWrong("");
        onSave().then(
          () => setState("saved"),
          (e: unknown) => {
            setState("");
            setWrong((e as Error)?.message || t("{name} was not saved.", { name }));
          },
        );
      }}
      p="$1"
      rounded="$10"
      shrink={0}
      opacity={state === "saving" ? 0.5 : 1}
      hoverStyle={{ bg: "$hover" }}
    >
      {state === "saved" ? <Check size={12} aria-hidden /> : <LibraryMark size={12} aria-hidden color={wrong ? BAD : undefined} />}
    </Box>
  );
}

/** A file held for the next message: uploading, then indexing, then ready. */
function HeldChip({ one, onOpen, onRemove, onSave }: { one: Held; onOpen: (m: Mark) => void; onRemove: () => void; onSave?: (url: string, id: string) => Promise<unknown> }) {
  const live = useWorkFile(one.file?.id);
  const file = live ?? one.file;
  const state = one.state === "uploading" ? one.state : (file?.status ?? one.state);
  const picture = usePicture(kindOf(one.name, one.type) === "image", one.href, file?.id, file);
  // The mark the column's Sources row opens for the same file, so both open it alike.
  const mark: Mark = { id: one.id, name: one.name, kind: kindOf(one.name, one.type) === "image" ? "image" : "file", href: one.href || undefined, file: file?.id, mime: one.type };
  return (
    <Chip
      name={one.name}
      type={one.type}
      size={one.size}
      state={state}
      sent={one.sent}
      file={file ?? (one.error ? ({ error: one.error } as WorkFile) : undefined)}
      picture={picture}
      onOpen={() => onOpen(mark)}
      onRemove={onRemove}
      // Its bytes are on this machine until the upload lands, and are kept by the workspace file it became.
      onSave={onSave && one.href ? () => onSave(one.href, file?.id ?? one.id) : undefined}
    />
  );
}

/** A file a sent turn carried, as the index says of it now. */
function TurnChip({ f, onOpen, onSave }: { f: FileRef; onOpen: (m: Mark) => void; onSave?: (url: string, id: string) => Promise<unknown> }) {
  const api = useAi();
  const live = useWorkFile(f.id);
  const picture = usePicture(kindOf(f.name, f.type) === "image", "", f.id, live);
  const mark: Mark = { id: f.id, name: f.name, kind: kindOf(f.name, f.type) === "image" ? "image" : "file", file: f.id, mime: f.type };
  // The bytes on this machine where this document still holds them, else the workspace's copy.
  const save = onSave ? async () => onSave(localOf(f.id) || (await signedOf(api, f.id, live)), f.id) : undefined;
  return <Chip name={f.name} type={f.type} size={f.size} state={live?.status ?? "ready"} sent={1} file={live} picture={picture} onOpen={() => onOpen(mark)} onSave={save} />;
}

/** A question that carried files: its words, the files put into it, and those read again. */
function Carried({
  text,
  attached,
  reused,
  onOpen,
  onSave,
}: {
  text: string;
  attached: FileRef[];
  reused: FileRef[];
  onOpen: (m: Mark) => void;
  onSave?: (url: string, id: string, f: FileRef) => Promise<unknown>;
}) {
  const { t } = useI18n();
  return (
    <YStack gap="$2" data-slot="turn-files">
      {text ? <Prose text={text} /> : null}
      {attached.length ? (
        <XStack gap="$1.5" flexWrap="wrap" role="list" aria-label={t("Files in this message")}>
          {attached.map((f) => (
            <TurnChip key={f.id} f={f} onOpen={onOpen} onSave={onSave ? (url, id) => onSave(url, id, f) : undefined} />
          ))}
        </XStack>
      ) : null}
      {reused.length ? (
        <Text fontSize="$1" color="$soft">
          {t("Read again: {files}", { files: reused.map((f) => `${f.name} (${weigh(f.size)})`).join(", ") })}
        </Text>
      ) : null}
    </YStack>
  );
}

/**
 * "Schedule this" under a question: the quiet control that opens the dialog
 * which makes the question run itself (Schedule.tsx).
 */
function Plan({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <XStack justify="flex-end" data-slot="plan">
      <XStack
        render="button"
        aria-label={t("Schedule this")}
        onPress={onPress}
        items="center"
        gap="$1"
        px="$1"
        height={22}
        rounded="$2"
        cursor="pointer"
        opacity={0.55}
        hoverStyle={{ opacity: 1, bg: "$hover" }}
        focusStyle={{ opacity: 1 }}
      >
        <Clock size={12} aria-hidden />
        <Text fontSize="$1" color="$ink">
          {t("Schedule this")}
        </Text>
      </XStack>
    </XStack>
  );
}

/**
 * The conversation. One component for a visitor and for an account.
 *
 * `anonymous` opens on the free pool and offers only what the free pool can
 * answer, because listing a paid model to someone with no balance is an offer
 * that fails at send. Everything else — the transcript, the composer — is
 * identical, which is the point: signing in later changes the models on the
 * menu, not the room.
 */
function Thread({
  placeholder = message(),
  initial,
  anonymous = false,
  heading,
}: {
  placeholder?: string;
  initial?: string;
  anonymous?: boolean;
  /** The empty transcript's heading. `null` renders none — for a host page that
   *  already carries an `<h1>` of its own. */
  heading?: string | null;
}) {
  /**
   * The model, and WHO decides it.
   *
   * `useState(anonymous ? FREE : ENSO)` read the flag ONCE, on the first render
   * — which is the render before hydration settles, where `anonymous` is always
   * false. So every visitor opened on ENSO while the composer beside them said
   * "Enso Free". A visitor was sending on the paid pool, because a state
   * initialiser cannot see a value that arrives later.
   *
   * A CHOICE, or the identity. `null` is "nobody has chosen", which is a
   * different fact from either model and the only one that can defer to a flag
   * that settles after mount. Picking from the menu still wins, permanently.
   */
  // THE MODEL AND THE EFFORT are the one choice Chat and Dev share
  // (@hanzo/build `useMind`): the catalog from `GET /v1/models` and what the
  // reader kept, changed from the composer's chip or from Settings.
  const { t } = useI18n();
  const target = useMemo(() => ({ api: api(), token: bearer, org: org() }), [anonymous]); // eslint-disable-line react-hooks/exhaustive-deps
  // THE PLAN decides what the chip may offer: Free answers from the free lane
  // alone, so it opens there and lists the rest as upgrades (@hanzo/build).
  const catalog = useRef<Model[]>([]);
  const { limits, notice, reload: reread } = useLimits(!anonymous, org(), (id) => nameOf(id, catalog.current));
  const mind = useMind(target, anonymous ? "free" : limits?.plan);
  catalog.current = mind.models;
  // Chat's effort is its own (ThinkingEffort, sent as `reasoning_effort`); a
  // pick of one Dev offers too moves Dev's, where it is made, and opening Chat
  // never resets Dev's.
  const [chatPrefs, setChatPrefs] = useChatPreferences();
  const ai = useAi();
  // In the app's frame the composer floats on the pane as a pane of its own.
  const framed = useContext(Framed);
  const opened = useOpen();
  const { thread: open, open: reopen, agents: room, openAgent, seat, emptied, aside, showAside, showSettings } = opened;
  // What the conversation carries beside its words (@hanzo/build `useCarry`):
  // the skills picked from `+`, what Hanzo remembers and the mode, said at the
  // end of the room's system turn so every request carries them.
  // What the plugins act on — the draft and the files held for the next message —
  // read when they act, so it is lent through a ref filled further down.
  const lent = useRef<{ draft: string; setDraft: (x: string) => void; attach: (f: File[]) => void }>({ draft: "", setDraft: () => {}, attach: () => {} });
  const carry = useCarry(target, open ?? "", (tab) => go(app(`-/customize/${tab}`)), {
    get draft() {
      return lent.current.draft;
    },
    setDraft: (x) => lent.current.setDraft(x),
    attach: (f) => lent.current.attach(f),
    go: (href) => (/^https?:/.test(href) ? void window.open(href, "_blank", "noopener,noreferrer") : go(href)),
  }, CHAT_MODES);
  useEffect(() => {
    const wantedMode = chatPrefs.approvalMode || "auto";
    if (!anonymous && carry.mode.value !== wantedMode) {
      carry.mode.set(wantedMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatPrefs.approvalMode, anonymous]);
  const agentShelf = useAgentShelf();
  // The opening greets the person by the first word of their display name, capitalised ("What’s up, Z?").
  // A username is a handle, not a name: without a display name the greeting has none.
  const firstName = useMemo(() => (anonymous ? "" : given(named()?.display ?? "")), [anonymous]);
  // Up to three things worth doing next, from the person's own activity (@hanzo/build).
  const hints = useSuggestions(target);
  // THE HEADER'S ⋯ IS THE ROW'S MENU (thread.tsx): rename, pin, share, its
  // link, a new tab, archive and delete, kept by the server. A conversation not
  // in the list yet (just begun, or archived) has no menu until it is.
  const listing = useThreadList(false, open);
  const mine = open ? listing.threads.find((t) => t.id === open) : undefined;
  const alone = useMemo(() => new Map(mine ? [[mine.id, mine]] : []), [mine]);
  // The conversation's key in `pane.ts`, the one the column beside it reads.
  const at = channel(opened);
  // The first of them: what a surface that addresses one person reads.
  const withWhom = room[0] ?? null;
  // THE SIDE PANEL (@hanzo/build `Panel`), the one Dev's runs open too: shut
  // until the reader opens it or a preview lands (`see`, a link that frames),
  // kept per conversation with its tabs, so a chat opens as it was left and
  // never as the last chat was. The header's Panel button and ⌘. move it.
  const media = useMedia();
  const wide = media.lg;
  const [panel, setPanel] = usePanel(`chat:${at}`, false, wide);
  const deck = useDeck(`chat:${at}`, SEED);
  // The org's sites, which an empty tab suggests.
  const sites = useSites();
  useKey(() => setPanel(!panel));
  // On a laptop the frame's column is the panel's; a close from the frame (its
  // edge pulled shut, the shell's own control) comes back into `panel`.
  useEffect(() => {
    if (wide) showAside(panel ? "tasks" : null);
  }, [panel, wide, showAside]);
  const wasAside = useRef(aside);
  useEffect(() => {
    if (wide && wasAside.current !== aside) {
      if (aside === null && panel) setPanel(false);
      else if (aside !== null && !panel) setPanel(true);
    }
    wasAside.current = aside;
    // Answers the frame's moves only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aside]);
  /** What an answer wrote, open in the panel as a page rendered from its own bytes. */
  const see = useCallback(
    (a: Artifact) => {
      deck.open({ kind: PAGE, title: a.name, body: a.body, type: a.mime });
      setPanel(true);
    },
    [deck, setPanel],
  );
  /**
   * OPENS A FILE A MESSAGE CARRIES, by the road the Sources tab takes (`look`):
   * a page tab in the side panel, the panel opened when it is shut — a column on
   * a laptop, a sheet on a phone.
   */
  const openFile = useCallback(
    (m: Mark) => {
      void look(deck, m, ai);
      setPanel(true);
    },
    [deck, ai, setPanel],
  );
  /**
   * WHO YOU ARE TALKING TO, when it is somebody rather than the plain model.
   *
   * Pressing a name in the roster selected a RUN, which this pane never reads,
   * so the chat opened saying nothing about them. `agent` names them, the detail
   * carries their `instructions`, and those instructions ARE the attachment:
   * seeded as the thread's system turn they ride with every message on the wire,
   * so the reply comes back in their voice rather than the house one. No second
   * send path and no `preset` running parallel to `messages` — a conversation
   * already has a place for who is speaking, and this is it.
   */
  // THE COLUMN'S OWN LIST, because that is what draws the faces beside this
  // room. `useAgent` asks the API for one agent BY REF and an agent is
  // addressed here by the name a reader picked, so it answers null for every
  // row whose id is not its name — which is why the hero had no picture and no
  // sentence for an agent the column had just drawn a memoji for.
  const { agents: roster, loading: gathering } = useCrew();
  // THE HANDLE A NAME IS FILED UNDER. The room holds the names a person reads
  // ("Dev"); the platform files a core member under its lower-case handle
  // ("dev"), so a read goes out under the org's own spelling.
  const handle = useCallback(
    (name: string) => (Array.isArray(roster) ? roster : []).find((one) => one.name.toLowerCase() === name.toLowerCase())?.name ?? name,
    [roster],
  );
  const { agent: read, loading: reading } = useAgent(withWhom && !gathering ? handle(withWhom) : null);
  // THIS agent's record only: the hook keeps the last agent's row while it reads
  // the next, so a row whose name is not the one in the room is not theirs.
  const persona = read && withWhom && read.name?.toLowerCase() === withWhom.toLowerCase() ? read : null;
  // Until the record answers, the model they are pinned to is unknown, so a send
  // waits for it rather than going out on the reader's own model.
  const resolving = Boolean(withWhom) && (gathering || reading);
  const resolvingNow = useRef(resolving);
  resolvingNow.current = resolving;
  // THE ROOM'S FACES, by name: what the column's own list says each one looks
  // like, which is what the header, the hero and a reply's byline all draw.
  const faces = useMemo(() => {
    const rows = Array.isArray(roster) ? roster : [];
    return Object.fromEntries(room.map((name) => [name, rows.find((one) => one.name.toLowerCase() === name.toLowerCase())]));
  }, [roster, room]);
  const mate = withWhom ? faces[withWhom] : undefined;
  // ONE SPELLING PER AGENT. A core member is named as hanzoai/personas names
  // them whatever the org's handle ("des" is Des, `called`); any other agent is
  // named as the org spells it, so a face pressed before the org's agents arrive
  // is named again once they do, and its row, picture and brief are the org's.
  useEffect(() => {
    const rows = Array.isArray(roster) ? roster : [];
    const named = room.map((name) => called(rows.find((one) => one.name.toLowerCase() === name.toLowerCase())?.name ?? name));
    if (named.some((name, i) => name !== room[i])) seat(named);
  }, [roster, room, seat]);
  // WHO A REPLY MAY NAME: the room, the org's agents and the house crew. A turn
  // said while someone was in the room stays split by speaker after they leave.
  const known = useMemo(
    () => [...new Set([...room, ...(Array.isArray(roster) ? roster.map((one) => called(one.name)) : []), ...HOUSE])],
    [room, roster],
  );
  // EVERYONE ELSE IN THE ROOM. `useAgent` reads the first by ref; the rest are
  // read here once each and kept, so a member who steps out and back in does
  // not cost a second read. A name the platform does not hold reads null and
  // falls to what the cast says of them.
  const [briefs, setBriefs] = useState<Record<string, string | null>>({});
  const asked = useRef(new Set<string>());
  useEffect(() => {
    for (const name of room) {
      const ref = handle(name);
      if (name === withWhom || asked.current.has(ref)) continue;
      asked.current.add(ref);
      ai.agents
        .get(ref)
        .then((found) => setBriefs((all) => ({ ...all, [name]: found?.instructions?.trim() || null })))
        .catch(() => {
          asked.current.delete(ref);
          setBriefs((all) => ({ ...all, [name]: null }));
        });
    }
  }, [ai, room, withWhom, handle]);
  // THE SYSTEM TURN: one brief as it is, or the whole room. The org's row
  // speaks for an agent it holds — the cloud keeps a core member's row in step
  // with hanzoai/personas, and an agent the org made under the same name keeps
  // its own brief — and a core member the org holds no row for speaks as
  // hanzoai/personas writes them (`speaksOf`), so a visitor pressing Feynman
  // gets Feynman rather than the house model.
  const brief = useMemo(
    () =>
      roomBrief(
        room.map((name) => ({
          name,
          says: (name === withWhom ? persona?.instructions?.trim() : briefs[name]) || speaksOf(name) || null,
        })),
      ),
    [room, withWhom, persona?.instructions, briefs],
  );
  // AN AGENT BRINGS ITS OWN MODEL. It is a field on the row, so choosing one
  // for them would be answering a question they have already answered. The
  // default for plain chats lives in Settings, so this room has no second model
  // control that can drift from it.
  //
  // NAMED, THEN CHECKED AGAINST WHAT THE GATEWAY SERVES. `enso` is the house
  // router and the right preference, but a deployment carrying a different
  // catalogue does not answer to it — and an unserved name reaches the agents
  // round as a completion for a model nobody has, which the round returns as a
  // bare "not found", after it has already recorded the question. `served`
  // keeps the house name where it is served and otherwise falls to the first
  // model that is, so a room on any catalogue can be spoken to.
  // A SPEECH MODEL NEVER ANSWERS A CHAT TURN. The catalog lists the
  // transcriber and the voice beside the chat models; one that names its
  // outputs and names no text (`chats`) is neither offered nor fallen back to.
  const isHouseModel = (m: Model) => {
    const id = (m.id || '').toLowerCase();
    const family = (m.family || '').toLowerCase();
    return id.startsWith('enso') || id.startsWith('zen') || id.startsWith('kai') ||
           family.startsWith('enso') || family.startsWith('zen') || family.startsWith('kai') ||
           m.class === 'ours';
  };
  const listed = mind.models;
  const filteredListed = useMemo(() => {
    if (chatPrefs.allowThirdPartyModels) return listed;
    return listed.filter((m) => isHouseModel(m) || m.id === ENSO || m.id === FREE);
  }, [listed, chatPrefs.allowThirdPartyModels]);
  const models = useMemo(() => filteredListed.filter(chats), [filteredListed]);
  // EVERY MODEL THE GATEWAY LISTS is offered here, through the one picker, and
  // read from the catalog's own fields (`parseModels`): its class, its family.
  // A premium model is picked for THIS conversation and never remembered as
  // the default (`useMind`), so the next chat starts on what was kept. An
  // agent's own model is sent as it is named; the gateway says which model
  // answered (`servedBy`).
  const rowOf = (id: string) => listed.find((m) => m.id === id);
  const wanted = mind.model;
  // A model the catalog lists is sent as picked, whatever it answers with; only
  // a name the catalog does not list falls to one that converses (`served`).
  const sent = anonymous ? FREE : wanted;
  const model = persona?.model || (rowOf(sent) ? sent : served(models, sent));
  // THE PLAN'S USAGE (lib/limits.ts), kept current by every chat answer's
  // headers and read again whenever a send settles, below. The room draws no
  // bars and no near note — those live on Settings → Usage. It says something
  // only once the reader is turned away: a reply answered from a free model, or
  // a refusal.
  const held = paidPlan(limits);
  const pause = notice && (notice.fallback || notice.refused) ? notice : null;
  // The banner's words and ways: the plan by name, when it comes back, and the two ways on.
  const banner = pause ? paused(pause, limits?.plan ?? "", (id) => nameOf(id, listed), Date.now(), t) : null;
  // EVERY MODEL IS CHOSEN, never asked for: one the plan does not cover still
  // picks, and the gateway answers it with the policy's refusal or from Enso,
  // which the room then shows. A turn the gateway refuses `plan_required`
  // opens the upgrade, titled with the model.
  const free = useFree(!anonymous) && !held;
  const [ask, setAsk] = useState<Ask | null>(null);
  // KEEPING THE CONVERSATION is the reader's account, not this pane's choice:
  // the store is per-org, so a signed-in reader has somewhere for it to go and
  // an anonymous one does not. `thread` names the conversation being continued
  // — the Recent they opened — so a reply lands in it rather than beside it.
  const chat = useChat({
    model,
    keep: !anonymous,
    // THE PILL THAT WAS CUT READ A SETTING NOTHING SET, and that was the right
    // reason to cut it. This is the other half: `params` is forwarded to the
    // completion, so the effort chosen on the bar rides the request. An
    // upstream that does not read `reasoning_effort` answers as it would have,
    // the way it does for `temperature`.
    // THE LIVE WEB rides every signed-in turn on an Enso or Zen model: the two
    // web tools mark the turn, and the client's fetch (lib/web.ts) looks it up
    // before the model is asked and asks without them, so a question about the
    // world, in any language, is answered from what the web says now and streams.
    params: {
      reasoning_effort: chatPrefs.effort || 'high',
      ...(!anonymous && house(rowOf(model)?.family) ? { tools: WEB } : {}),
    },
    ...(open ? { thread: open } : {}),
    onError: (e) => {
      const needs = planRequired(e);
      if (needs && free) setAsk({ ...needs, model: nameOf(model, listed) });
    },
  });
  const { send, set, error, thread: kept } = chat;

  // Threads THIS pane opened by writing them. Their transcript is already on
  // the screen — it is what was just said — so the restore below has nothing to
  // fetch for one, and fetching anyway would race a live conversation to
  // replace it with the server's copy mid-sentence.
  const written = useRef(new Set<string>());
  // The room each thread last recorded, by thread, as the names joined.
  const recorded = useRef(new Map<string, string>());

  // A conversation that has just been written down becomes the OPEN one, so the
  // rail marks the room the reader is standing in. Only on the mint, which is
  // `kept` changing: when the reader opens another Recent, `open` moves first and
  // `kept` follows it a render later (the hook takes `thread` in an effect), and
  // reopening the stale `kept` then sent the two chasing each other until React
  // stopped the page (#185).
  const minted = useRef(kept);
  useEffect(() => {
    if (kept === minted.current) return;
    minted.current = kept;
    if (kept && kept !== open) {
      written.current.add(kept);
      reopen(kept);
      // THE SERVER TITLES A THREAD FROM ITS FIRST TURN, block and all: a turn
      // that carried files or a plugin's words is renamed to the words alone.
      const first = chat.messages.find((m) => m.role === "user");
      const read = first ? told(words(first.content as Said)) : null;
      if (read?.carried) void ai.threads.update(kept, { title: read.text.trim().slice(0, 80) || t("Files") }).catch(() => {});
    }
  }, [kept, open, reopen]); // eslint-disable-line react-hooks/exhaustive-deps

  // The thread's turns, replaced wholesale or through an updater. `set` is the
  // hook's own state setter, so it takes either.
  const apply = useRef(set as React.Dispatch<React.SetStateAction<ChatMessage[]>>);
  apply.current = set as React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // THE ROOM'S SYSTEM TURN: who is in the conversation (`roster`), then how each
  // of them talks. It is the first turn every request carries and it follows the room, so
  // pressing a face adds them to the conversation that is open rather than
  // starting another; the turns already said stay where they are.
  const turn = useMemo(() => [roomTurn(room, brief), carry.text].filter(Boolean).join("\n\n") || null, [room, brief, carry.text]);
  const turnNow = useRef(turn);
  turnNow.current = turn;
  const roomNow = useRef(room);
  roomNow.current = room;
  useEffect(() => {
    apply.current((held) => seated(held, turn));
  }, [turn]);

  // A NEW CONVERSATION holds the room's turn and nothing else: on arrival, on
  // "New chat" (`emptied` counts the presses, so a press on an empty room still
  // lands), and when the open thread is left for none.
  useEffect(() => {
    if (open) return;
    apply.current(seated([], turnNow.current));
  }, [open, emptied]);

  // A RECENT THAT OPENS. `threads.get` answers null for an id this caller may
  // not read — the route replies 200 with no messages rather than 404 — so an
  // empty transcript is read as absent instead of drawn as a real but blank
  // conversation. The last roster turn it holds names its room, which is seated
  // as it arrives; a thread that never recorded one has nobody in it.
  //
  // Its own effect, apart from the room's turn: a character arriving while the
  // read is out must not abort it.
  useEffect(() => {
    if (!open) return;
    // Our own. The turns are on the screen already.
    if (written.current.has(open)) return;
    const stop = new AbortController();
    void ai.threads
      .get(open, { signal: stop.signal })
      .then((found) => {
        const turns = (found?.messages ?? []).map((m, i) => ({
          // A store row always has an id; a turn without one is keyed by its place.
          id: m.id || `${open}#${i}`,
          role: m.role as ChatMessage["role"],
          content: m.content,
        }));
        let names: string[] = [];
        for (const one of turns) {
          const held = one.role === "system" ? rosterOf(one.content) : null;
          if (held) names = held;
        }
        recorded.current.set(open, names.join("\n"));
        // The room already seated keeps its briefs; another is seated by name
        // and its briefs follow as they are read.
        const same = names.join("\n") === roomNow.current.join("\n");
        seat(names);
        apply.current(
          seated(
            turns.filter((one) => !(one.role === "system" && rosterOf(one.content))),
            same ? turnNow.current : roomTurn(names, null),
          ),
        );
      })
      .catch(() => apply.current(seated([], turnNow.current)));
    return () => stop.abort();
  }, [ai, open, seat]);

  // WHO IS IN THE CONVERSATION IS KEPT WITH IT. A thread records its room as a
  // roster turn when it is first written down with somebody in it, and again
  // whenever the room changes; reopening it — after a reload, on another
  // device — seats the same faces. The briefs are not recorded: they are read
  // fresh from the agents each time the room is seated.
  useEffect(() => {
    if (!open || anonymous) return;
    const now = room.join("\n");
    const was = recorded.current.get(open);
    if (was === now) return;
    // A thread read back from the store is seated by the read above; until it
    // lands there is nothing to compare against.
    if (was === undefined && !written.current.has(open)) return;
    recorded.current.set(open, now);
    if (was === undefined && room.length === 0) return;
    void ai.threads.record([{ role: "system", content: rosterLine(room) }], open).catch(() => {
      recorded.current.delete(open);
    });
  }, [ai, open, room, anonymous]);

  // `send` is read through a ref and NEVER through a dependency array. Its
  // identity changes on every `setMessages` — `useChat` closes over `messages` —
  // so an effect depending on it re-runs after each streamed token.
  const latest = useRef(send);
  latest.current = (text: string) => send(text);

  // THE COMPOSER'S DRAFT IS HELD HERE, so an arriving question can be typed into
  // it. `Chat` owns a draft of its own and spreads `composer` after it, so
  // passing value/onChange/onSend takes that ownership over rather than fighting
  // it.
  const [draft, setDraft] = useState("");
  // FILES WITH THE NEXT MESSAGE, held by `pane.ts` for this conversation: the
  // paperclip, a drop anywhere on the room, a paste into the field and the
  // column's `+` all go through its one `hold`, so the chips here and the rows
  // under Sources are one list. Each goes to the org's workspace and is indexed
  // there; the turn carries it by reference (lib/attach), with the passages
  // read from it for the question.
  const { held: files, refused: turnedAway } = usePane(at);
  const via = useMemo<Via>(() => ({ api: ai, org: anonymous ? null : org() }), [ai, anonymous]);
  lent.current = { draft, setDraft, attach: (f) => void hold(at, f, via) };
  // "Use in Chat" from the Library: `?attach=<item>` holds it for the next message.
  useAttach(at, via);
  // "Schedule this": the prompt the dialog opens on, or null while it is shut.
  const [plan, setPlan] = useState<string | null>(null);
  // A file the reader keeps from this conversation goes to their Library under it.
  const keepOne = useCallback(
    (url: string, id: string, name: string, type: string) => keepFile(ai, { id, name, type, url, thread: kept ?? open }),
    [ai, kept, open],
  );
  // What the send is waiting on — uploads landing, the files being read — said
  // over the field, and the reason a second press does nothing meanwhile.
  const [preparing, setPreparing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  useSeed(initial, setDraft);

  // DICTATION through Hanzo's own ear: the mic records and each pause is
  // posted to /v1/audio/transcriptions (`zen-scribe`), and what was said lands
  // AFTER what the draft already held (`useDictation`) — a pause between two
  // sentences never loses the first. `speech()` defaults to the Hanzo gateway
  // and `base()` is the one place a host is read from, so pointing a local
  // cloud at one points both. The token is the reader's own — the package never
  // invents a credential — and a refusal is worn by `<Voice/>`, never passed off
  // as a transcript.
  const { token } = useIamToken();
  const ear = useMemo(() => speech({ ...base(), ...(token ? { token } : {}) }), [token]);
  // The language dictation listens in: the person's own (Settings › General), or the browser's.
  const [spoken, speakIn] = useLanguage(target);
  const voice = useVoice({ speech: ear, ...(spoken ? { language: spoken } : {}), ...useDictation(draft, setDraft) });

  // TALK MODE: a hands-free conversation on Hanzo's realtime socket, /v1/voice.
  // The mic streams up, the answer streams back as speech with its words in
  // `talk.reply`, and talking over it stops it. Its own conversation, so its
  // turns are drawn above the composer rather than posted into the thread.
  const talk = useTalk({ ...base(), ...(token ? { token } : {}), org: org() ?? undefined });

  // WHILE THE MIC IS OPEN, A FINISHED REPLY IS READ ALOUD by the platform's
  // voice, through the conversation's own mouth so speaking over it stops it.
  // A room's reply is read part by part, each in its speaker's cast voice.
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !chat.streaming && voice.open) {
      const msgs = chat.messages;
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.role === "assistant" && typeof lastMsg.content === "string") {
        const parts = room.length > 1 ? speakers(lastMsg.content, room) : [{ who: withWhom, text: lastMsg.content }];
        // A part spoken over ends the reading rather than handing on to the next.
        void (async () => {
          for (const part of parts) {
            const said = cleanForSpeech(part.text);
            if (said && !(await voice.say(said, voiceOf(part.who ?? withWhom ?? undefined)))) break;
          }
        })();
      }
    }
    wasStreaming.current = chat.streaming;
  }, [chat.streaming, voice.open, voice.say, chat.messages, withWhom, room]);

  // A SEND THAT WAITS ONE RENDER. `send` closes over the turns it was rendered
  // with, so a send that first tidies the thread is held here and made from the
  // next render, where the tidied turns are the ones it sends.
  const [queued, setQueued] = useState<string | null>(null);
  useEffect(() => {
    if (queued === null || resolving) return;
    setQueued(null);
    void latest.current(queued);
  }, [queued, resolving]);
  const streaming = useRef(false);
  streaming.current = chat.streaming;
  const turns = useRef(chat.messages);
  turns.current = chat.messages;
  // The conversation's last question as its person wrote it: what the header's
  // Schedule… opens on.
  const lastAsked = () => {
    const q = [...turns.current].reverse().find((m) => m.role === "user");
    if (!q) return "";
    if (typeof q.content === "string") return told(q.content).text;
    return Array.isArray(q.content) ? partsOf(q.content).flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n") : "";
  };

  /**
   * WHAT EACH UNANSWERED QUESTION WAS TOLD, by the question's own turn id: the
   * refusal it met, or that its answer came back empty, or that it streamed
   * nothing until `STALL`. A question with no entry here and no answer after it
   * — a thread read back from the store — is still said to have gone unanswered.
   */
  const [failures, setFailures] = useState<Record<string, Failed>>({});
  const note = useCallback((failed: Failed) => {
    const id = [...turns.current].reverse().find((m) => m.role === "user")?.id;
    if (id) setFailures((all) => ({ ...all, [id]: failed }));
  }, []);
  useEffect(() => {
    if (error && !chat.streaming) note({ error });
  }, [error, chat.streaming, note]);
  // EVERY SEND THAT SETTLES re-reads the plan's limits: a stream that ended, a
  // stop, or a refusal — a 429 for a spent window included, which is read
  // again on the pass that delivers it. An error with no stream before it
  // still counts, so a refusal raised before the first frame is not missed.
  const counting = useRef(false);
  useEffect(() => {
    if (chat.streaming) {
      counting.current = true;
      return;
    }
    if (!counting.current && !error) return;
    counting.current = false;
    reread();
  }, [chat.streaming, error, reread]);
  const wasBusy = useRef(false);
  useEffect(() => {
    const held = turns.current[turns.current.length - 1];
    if (wasBusy.current && !chat.streaming && !error && held && blank(held)) note({ error: null, empty: true });
    wasBusy.current = chat.streaming;
  }, [chat.streaming, error, note]);

  /**
   * Sends a question. A new question takes any empty answer off the thread
   * first, because an upstream may refuse a request carrying an assistant turn
   * with nothing in it. `again` names an unanswered question to ask once more:
   * it leaves its place in the thread and is asked at the end, so it is asked
   * once and not twice.
   */
  const speak = useCallback((text: string, again?: string) => {
    if (!text) return;
    // Activation: the first question this browser asks (a retry is not one).
    if (!again) first("chat_message");
    if (!streaming.current && (again || resolvingNow.current || turns.current.some(blank))) {
      apply.current((held) => held.filter((one) => one.id !== again && !blank(one)));
      if (again)
        setFailures((all) => {
          const { [again]: _gone, ...rest } = all;
          return rest;
        });
      setQueued(text);
      return;
    }
    void latest.current(text);
  }, []);

  // THE WAYS PAST A PAUSE, as the server sends them. A page opens; Continue
  // with credits turns the org's choice on and asks the last question again on
  // the model the reader picked; a switch moves the picker. A refusal of the
  // write (only an org admin may make it) is said under the banner.
  const [actWrong, setActWrong] = useState("");
  const act = useCallback(
    (a: LimitAction) => {
      setActWrong("");
      if (a.kind === "switch") {
        if (a.model) mind.pick(a.model);
        return;
      }
      if (a.kind !== "credits") {
        if (a.url) window.location.assign(a.url);
        return;
      }
      setCreditsAfterAllowance(true)
        .then(() => {
          reread();
          // A refused question is asked again in its place; one a free model
          // answered is asked once more after that answer.
          const q = [...turns.current].reverse().find((m) => m.role === "user");
          if (q) speak(words(q.content as Said), failures[q.id] ? q.id : undefined);
        })
        .catch((e: unknown) => setActWrong(e instanceof Error ? e.message : t("Credits could not be turned on.")));
    },
    // `mind.pick` is rebuilt each render; the handler follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reread, speak, failures, mind.model, listed, t],
  );

  // A TURN THAT NEVER SPEAKS IS STOPPED. A stream that stays open with nothing
  // in it would leave a Stop button and no answer for as long as the upstream
  // holds the connection; after `STALL` it is ended and its question is said to
  // have gone unanswered, with Try again.
  useEffect(() => {
    if (!chat.streaming) return;
    const clock = window.setTimeout(() => {
      const held = turns.current[turns.current.length - 1];
      if (held && blank(held)) {
        note({ error: null, stalled: true });
        chat.stop();
      }
    }, STALL);
    return () => window.clearTimeout(clock);
    // Armed once per turn; `chat.stop` is the hook's stable callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.streaming]);

  // WHICH MODEL ANSWERED each reply, by the reply's turn id, as the gateway named
  // it while the reply streamed (lib/served.ts).
  const [servedBy, setServedBy] = useState<Record<string, Heard>>({});
  useEffect(
    () =>
      onServed((heard) => {
        const answer = [...turns.current].reverse().find((m) => m.role === "assistant");
        if (answer && streaming.current) setServedBy((all) => ({ ...all, [answer.id]: heard }));
      }),
    [],
  );
  const byline = (id: string) => {
    const heard = servedBy[id];
    // A router named back as itself says nothing about who answered.
    if (!heard || (heard.served === heard.asked && ROUTERS.has(heard.asked))) return null;
    const fell = heard.asked && heard.asked !== heard.served && !ROUTERS.has(heard.asked);
    return <Served served={heard.served} asked={fell ? heard.asked : undefined} />;
  };

  // LISTEN reads a part in its speaker's cast voice, through the platform.
  const listen = useCallback(
    (who?: string): Listen =>
      (text, done) =>
        speakAgent(text, { agent: who, token, onEnd: done, onError: done }),
    [token],
  );
  /** The way to open what a part of an answer wrote, where it wrote something. */
  const opener = (text: string) => {
    const a = lead(artifacts(text));
    return a ? () => see(a) : undefined;
  };

  // WHAT AN ANSWER MAKES IS KEPT IN THE LIBRARY as it finishes (keep.ts): the
  // answer that just stopped, once the conversation it belongs to has an id.
  const [finished, setFinished] = useState<{ id: string; text: string } | null>(null);
  useKeep(ai, !anonymous, kept ?? open, finished, artifacts);
  // WHAT AN ANSWER MAKES OPENS BESIDE IT. With the panel open, a page or a
  // picture an answer just finished writing is opened as a tab; with it shut,
  // the answer's own Open does it.
  const writing = useRef(false);
  useEffect(() => {
    const was = writing.current;
    writing.current = chat.streaming;
    if (!was || chat.streaming) return;
    const done = [...turns.current].reverse().find((m) => m.role === "assistant");
    if (done && typeof done.content === "string" && done.content) setFinished({ id: String(done.id), text: done.content });
    if (!panel) return;
    const answer = done;
    const made = typeof answer?.content === "string" ? artifacts(answer.content).filter(renders) : [];
    if (made.length) see(made[made.length - 1]!);
    // On the turn's end only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.streaming]);

  // WHAT WAS SAID, which is not everything the thread holds. The persona rides
  // as a system turn so the wire carries it; drawing it would print a character
  // brief in the transcript as though somebody had typed it, and would make a
  // room nobody has spoken in look like a conversation already under way.
  const said = useMemo(
    () => chat.messages.filter((m) => m.role !== "system"),
    [chat.messages],
  );
  // THE LIKENESS, WHERE ONE WAS DRAWN FOR THIS CHARACTER. `cast.tsx` is the one
  // table of who looks like what, and it says a name it does not hold "is not a
  // problem" — that name wears initials, never another character's face.
  // WHAT THE AGENT CARRIES, THEN WHAT WE CAST. The cast answers for a character
  // it has a part for; an agent named after its job — "Hanzo Researcher" — has
  // no part, so the hero drew nothing while the column beside it drew the
  // record's own picture. Its own answer comes first, which is the order
  // `Face` already states for every other surface.
  const portrait = mate?.avatar ?? persona?.avatar ?? roleOf(withWhom)?.portrait;
  // THE PANEL IS TABS OF PAGES, a browser beside the conversation; what the
  // conversation produced and took in is its Summary (RightPane.tsx), each row
  // opening here. A deck kept from when Artifacts and Sources were tabs lets them go.
  useEffect(() => {
    for (const t of deck.tabs) if (t.kind !== PAGE) deck.shut(t.id);
    // A sweep of what was kept, once the deck is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  /** Whether the field has focus, so the FRAME can wear the ring the field is
   *  no longer allowed to draw. `:focus-within` would say this in CSS; the
   *  stylesheet that would hold it cannot reach past gui's own rule, so the
   *  state is read where the event is. */

  // A free send goes. The data-share choice was made at onboarding, once.
  const guarded = speak;

  /**
   * The draft and the files, sent as one turn.
   *
   * A file goes by REFERENCE: the send waits for each held file's upload to
   * land, then asks the index for the passages that answer the question —
   * across the files put into this turn and every file earlier turns carried —
   * and the turn carries their names and those passages, each citing
   * file › section › ¶n. A file still indexing is waited on for a bounded
   * while; past it the turn says the file is not readable yet rather than
   * answering as though it had been read.
   */
  // WHAT THE PLUGINS THAT ARE ON ADD, asked just before a message goes: words
  // the model reads with it (carried in the turn's own block, as files are), or
  // an answer of the plugin's own, drawn as the reply without asking a model.
  const [prepWrong, setPrepWrong] = useState<string | null>(null);
  const answered = (text: string, reply: string) => {
    apply.current((held) => [
      ...held,
      { id: `u-${Date.now()}`, role: "user", content: text },
      { id: `a-${Date.now()}`, role: "assistant", content: reply },
    ]);
    // A page a plugin's answer carries (a design system's preview) opens beside it at once.
    const made = artifacts(reply).filter(renders);
    if (made.length) see(made[made.length - 1]!);
    if (!anonymous)
      void ai.threads
        .record([{ role: "user", content: text }, { role: "assistant", content: reply }], open ?? undefined)
        .then((id) => (!open && id ? reopen(id) : undefined))
        .catch(() => {});
  };

  const submit = (ask: string = draft) => {
    const text = ask.trim();
    if (preparing || (!text && !files.length)) return;
    if (!carry.preparing) return deliver(text, "");
    setDraft("");
    setPrepWrong(null);
    void (async () => {
      setPreparing(t("Preparing"));
      try {
        // The files held for this message, as bytes, for a plugin that reads them (PDF).
        const bytes = await Promise.all(
          files.filter((h) => h.href).map(async (h) => new File([await (await fetch(h.href)).blob()], h.name, { type: h.type })),
        );
        const got = await carry.prep({ text, files: bytes, thread: open ?? "" }, new AbortController().signal);
        // An answer of a plugin's own (a deck) is the answer, whatever else was prepared.
        if (got.reply) return answered(text, got.reply);
        deliver(text, got.system ?? "");
      } catch (e) {
        setPrepWrong(e instanceof Error ? e.message : String(e));
        setDraft(text);
      } finally {
        setPreparing(null);
      }
    })();
  };

  const deliver = (text: string, extra: string) => {
    const holding = files.slice();
    const earlier = carriedIn(chat.messages);
    if (!holding.length && !earlier.length) {
      setDraft("");
      guarded(extra ? carrying(text, extra) : text);
      return;
    }
    setDraft("");
    void (async () => {
      try {
        if (holding.some((h) => !h.file)) setPreparing(t("Uploading {files}", { files: names(holding, t) }));
        const landedFiles = (await Promise.all(holding.map(landed))).filter((f): f is WorkFile => !!f);
        spend(at);
        const attached = landedFiles.map(refOf);
        const reused = earlier.filter((f) => !attached.some((a) => a.id === f.id));
        const all = [...attached, ...reused];
        if (!all.length) {
          if (text) guarded(extra ? carrying(text, extra) : text);
          else setDraft(text);
          return;
        }
        setPreparing(t("Reading {files}", { files: names(all, t) }));
        const now = await readable(ai, landedFiles, READ_WAIT);
        let grounds = null;
        let why: string | undefined;
        try {
          grounds = await retrieve(ai, text || `What is in ${names(all)}?`, all.map((f) => f.id), 8);
        } catch {
          why = "the workspace could not be read just now";
        }
        if (!grounds?.passages.length) why = why ?? unread(now);
        guarded(compose(text, { attached, reused }, grounds, why, partly(now), extra));
      } finally {
        setPreparing(null);
      }
    })();
  };

  /*
    WHAT AN UNANSWERED QUESTION LOOKS LIKE: a turn of its own directly under it,
    naming who was asked, saying what went wrong in the reader's words, and
    offering Try again. Every question ends in an answer or in one of these,
    never in nothing: the thread drawn is `shown`, which puts one after every
    question with no answer after it.

    The refusals the reader can act on keep the server's sentence and its way
    out — Add credit only for the caller's OWN wallet (`insufficient_balance`),
    Upgrade for a plan limit, Sign in for a visitor. A model provider that did
    not answer (`providers_exhausted`, or any 5xx on the turn) is ours, and says
    so plainly with Try again; the upstream account named inside it is not the
    reader's to fund.
  */
  const shown = useMemo(() => {
    const out: ChatMessage[] = [];
    const held = said.filter((one, i) => !blank(one) || (chat.streaming && i === said.length - 1));
    held.forEach((one, i) => {
      out.push(one);
      if (one.role !== "user") return;
      const next = held[i + 1];
      if (!next || next.role === "user") out.push({ id: `${FAILED}:${one.id}`, role: "assistant", content: "" });
    });
    // A question on its way out has no answer yet and no failure either.
    if (queued !== null && out.length && String(out[out.length - 1].id).startsWith(`${FAILED}:`)) out.pop();
    return out;
  }, [said, chat.streaming, queued]);

  const failure = (question: ChatMessage) => {
    const failed = failures[question.id];
    const text = words(question.content as Said);
    const whom = addressed(text, room);
    const wrong = failed?.error ?? null;
    const how = wrong ? refusalOf(wrong) : null;
    // A BILLING REFUSAL is said in the gateway's words; its way past —
    // Upgrade, Add prepaid credit — is the banner over the composer. The free
    // plan's cap answers the same until it resets, so it offers no Try again.
    const bill = wrong ? billed(wrong) : null;
    const resign = !bill && !!wrong && (refused(wrong) || /audience not allowed|invalid access token/i.test(wrong.message));
    const lift = free ? planRequired(wrong) : null;
    const said = !failed
      ? t("No answer came back for this question.")
      : failed.stalled
        ? t("{model} sent nothing for {minutes} minutes, so the turn was stopped.", { model: nameOf(model, listed), minutes: STALL / 60_000 })
        : failed.empty
          ? t("{model} answered with nothing.", { model: nameOf(model, listed) })
          : bill
            ? banner?.message ?? notice?.message ?? (bill.message || plainly(wrong, t("this conversation"), t))
            : resign
            ? t(anonymous
              ? "Sign in to ask this."
              : "Your session needs to be refreshed. Sign in to reconnect.")
            : how?.provider
              ? t("{model} is unavailable right now.", { model: familyOf(model) || nameOf(model, listed) })
              : plainly(wrong, t("this conversation"), t);
    return (
      <Failure retryLabel={t("Try again")} onRetry={resign || lift || bill?.code === "free_plan_cap" ? undefined : () => speak(text, question.id)}>
        <YStack gap="$2">
          <Text fontSize="$3" color="$ink">
            {whom.length ? `${t("No answer from {names}.", { names: join(whom, t) })} ` : ""}
            {said}
          </Text>
          {how?.provider && wrong ? <Why text={detail(wrong)} /> : null}
          {lift || (!bill && (resign || how?.wallet || how?.visitor)) ? (
            <XStack gap="$2" flexWrap="wrap">
              {resign ? (
                <Button
                  size="sm"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("hanzo_iam_access_token");
                      localStorage.removeItem("hanzo_iam_refresh_token");
                    }
                    enter(LOGIN);
                  }}
                >
                  {t("Sign in")}
                </Button>
              ) : lift ? (
                <Button size="sm" variant="outline" onClick={() => setAsk({ ...lift, model: nameOf(model, listed) })}>
                  {t("Upgrade")}
                </Button>
              ) : how?.visitor ? (
                <Button size="sm" variant="outline" onClick={() => enter()}>
                  {t("Sign in to keep going")}
                </Button>
              ) : (
                <Anchor href={checkoutUrl()}>
                  <Button size="sm" variant="outline">
                    {t("Add credit")}
                  </Button>
                </Anchor>
              )}
            </XStack>
          ) : null}
        </YStack>
      </Failure>
    );
  };

  // Dev, from the Summary's Create file or site: a move inside the app where the
  // host's app reads the path (hanzo.ai), else Dev on hanzo.ai, as the shell's
  // Dev place goes from a host without it (hanzo.team).
  const pathed = useRooms().path !== null;
  const create = () => (pathed ? go(app("")) : window.location.assign(dev()));
  const sections = useSections({ at, said, held: files, deck, onCreate: create });

  /** The tabs' browser, as this conversation offers it: the org's sites to start from, and a page asked about, captured or opened in Dev. */
  const browsing = {
    suggested: sites,
    onAsk: (page: { url: string; title: string; selection?: string }) => {
      const quote = page.selection ? `\n> ${page.selection.trim().split("\n").join("\n> ")}` : "";
      setDraft((was) => `${was ? `${was}\n\n` : ""}${t("About {title} ({url}):", { title: page.title, url: page.url })}${quote}\n`);
    },
    onCapture: (file: File) => void hold(at, [file], via),
    onDev: (page: { url: string }) => {
      const slug = new URL(page.url).hostname.match(/^([a-z0-9-]+)\.hanzo\.app$/)?.[1] ?? null;
      window.location.assign(dev(slug));
    },
  };

  // THE COMPOSER'S OPTIONS, held apart so its keys (the `/` and `@` lists' arrows,
  // Ctrl+U) hook in through `useMention` before the frame is drawn.
  // What pressing a suggestion does, at once: open what it names, send its prompt
  // here (the room is a new chat while one shows), hand its run to Dev, or make
  // its scheduled task and show it in Scheduled tasks.
  const hint = (a: Act) => {
    switch (a.kind) {
      case "open":
        if (a.item) want(a.item);
        if (/^https:\/\//.test(a.to)) window.open(a.to, "_blank", "noopener,noreferrer");
        else go(a.to.startsWith("/") ? a.to : app(a.to));
        return;
      case "send":
        submit(a.prompt);
        return;
      case "task":
        hand("task", a.prompt);
        go(app(""));
        return;
      case "schedule":
        void book(target, a, "chat").then(
          (made) => go(app(devPath({ kind: "automation", id: made.id }))),
          (e: unknown) => setPrepWrong(e instanceof Error && e.message ? e.message : t("The scheduled task could not be made.")),
        );
        return;
    }
  };
  // A chat a suggestion in Dev left for this room is sent once the room is a new
  // chat: the address's own conversation let go of, nothing said yet.
  const [handed] = useState(() => ({ prompt: anonymous ? "" : taken("send") }));
  useEffect(() => {
    if (!handed.prompt || open || said.length) return;
    const p = handed.prompt;
    handed.prompt = "";
    submit(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, said.length]);

  const composing: PromptOptions = {
      value: draft,
      onChange: setDraft,
      onSend: () => submit(),
      onStop: chat.stop,
      busy: chat.streaming,
      // Files alone are a message: what is held goes with an empty draft too.
      ready: Boolean(draft.trim() || files.length),
      // `label` keeps the accessible name constant; the placeholder is the composer's own
      // (the defaults @hanzo/ui and @hanzo/build each call ASK), said here so both are the reader's.
      label: t("Ask anything"),
      placeholder: t("Type / for skills"),
      // A phone's pill is the tall one: the field across the top, the controls under it.
      narrow: !media.sm,
      // In the app's frame the composer floats on the pane as a pane of its own.
      framed,
      // A file or an image pasted into the field is held like a picked one;
      // words paste as words.
      field: {
        onPaste: (e: React.ClipboardEvent) => {
          if (!e.clipboardData?.files?.length) return;
          e.preventDefault();
          void hold(at, Array.from(e.clipboardData.files), via);
        },
      },
      // WHAT GOES WITH THE MESSAGE, above the frame and at its width: the
      // pause and its ways past, one chip a file, and talk mode's words.
      head:
        files.length || turnedAway || prepWrong || preparing || talk.open || talk.refusal || pause ? (
          <>
            {/* TURNED AWAY: what is used and until when, the ways past it, and
                the usage page — the shell's Settings pane, or the builder's
                Usage (dev.tsx answers the request there). */}
            {banner ? (
              <LimitedBanner message={banner.message} actions={banner.actions} onAction={act} onUsage={() => showSettings("usage")} />
            ) : null}
            {actWrong ? (
              <Text role="alert" data-slot="limited-banner-wrong" fontSize="$2" color={BAD}>
                {actWrong}
              </Text>
            ) : null}
            {files.length ? (
              <XStack gap="$1.5" flexWrap="wrap" role="list" aria-label={t("Attached files")} data-slot="composer-attached">
                {files.map((one) => (
                  <HeldChip
                    key={one.id}
                    one={one}
                    onOpen={openFile}
                    onRemove={() => drop(at, one.id)}
                    onSave={anonymous ? undefined : (url, id) => keepOne(url, id, one.name, one.type)}
                  />
                ))}
              </XStack>
            ) : null}
            {preparing ? (
              <Text role="status" aria-live="polite" data-slot="composer-preparing" fontSize="$2" color="$soft">
                {preparing}…
              </Text>
            ) : null}
            {turnedAway || prepWrong ? (
              <Text role="alert" fontSize="$2" color={BAD}>
                {turnedAway || prepWrong}
              </Text>
            ) : null}
            {/* TALK MODE'S OWN TURNS: what Hanzo is saying, or why it cannot. */}
            {talk.open || talk.refusal ? (
              <Text
                role="status"
                aria-live="polite"
                data-slot="composer-talk-reply"
                fontSize="$2"
                color={talk.refusal ? BAD : "$soft"}
              >
                {talk.refusal
                  ? worded(talk.refusal)
                  : talk.reply
                    ? `Hanzo: ${talk.reply}`
                    : t(talk.state === "listening"
                      ? "Listening — speak, and Hanzo answers aloud."
                      : "Connecting…")}
              </Text>
            ) : null}
          </>
        ) : undefined,
      // THE `+`: files (the Sources tab's "Attach files", one press closer),
      // who is in the conversation, the skills, and the two switches.
      plus: anonymous
        ? { upload: () => take(at, via) }
        : {
            upload: () => take(at, via),
            agents: agentShelf,
            skills: carry.skills,
            design: carry.design,
            plugins: carry.plugins,
            research: { on: carry.gear.gear.research, set: (on) => carry.gear.set({ research: on }) },
            memory: { on: carry.gear.gear.memory, set: (on) => carry.gear.set({ memory: on }) },
          },
      // Who is in the room, then what the conversation carries, as chips after `+`.
      on: [
        ...room.map((name) => ({
          id: `agent:${name}`,
          label: name,
          icon: <Face src={faces[name]?.avatar} emoji={faces[name]?.emoji} name={name} size={16} />,
          onRemove: () => seat(room.filter((one) => one !== name)),
        })),
        ...(anonymous ? [] : carry.on),
      ],
      slash: anonymous ? undefined : carry.skills,
      at: anonymous ? undefined : carry.plugins,
      // Auto vs Manual approval lives in Settings rather than floating under the composer.
      mode: null,
      // The model under the frame (@hanzo/build) only where Settings' model
      // selector is on; the effort is ThinkingEffort, beside send.
      model: chatPrefs.showModelSelector ? mind : null,
      limits,
      onUpgrade: (id) => setAsk({ model: nameOf(id, listed) } as Ask),
      voice,
      language: chatPrefs.showLanguage ? spoken : null,
      onLanguage: speakIn,
      talk,
      // While nothing has been said: what is worth doing next.
      below: said.length === 0 && !anonymous ? <Suggestions rows={hints.rows} onAct={hint} onDismiss={hints.dismiss} /> : undefined,
  };
  const mention = useMention(composing);

  return (
    <YStack
      flex={1}
      minH={0}
      width="100%"
      position="relative"
      data-slot="chat-room"
      // A LINK IN AN ANSWER OPENS IN A TAB beside the conversation when the tab
      // can show it — a site or preview we host — and in a browser tab of its
      // own otherwise, as a modified click always does.
      onClickCapture={(press: unknown) => {
        const e = press as React.MouseEvent<HTMLElement>;
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!a || !/^https?:/.test(a.href) || !frames(a.href)) return;
        e.preventDefault();
        deck.open({ kind: PAGE, title: tabName(a.href), url: a.href });
        setPanel(true);
      }}
      // Entered and left once for every child crossed, so the veil follows a
      // count rather than the last event.
      onDragEnter={(e: React.DragEvent) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e: React.DragEvent) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e: React.DragEvent) => {
        depth.current = 0;
        setDragging(false);
        if (!e.dataTransfer.files?.length) return;
        e.preventDefault();
        // A dropped folder arrives as entries; each file under it goes up with its path.
        void dropped(e.dataTransfer).then((list) => hold(at, list, via));
      }}
    >
      <Schedule
        open={plan !== null}
        onOpenChange={(open) => {
          if (!open) setPlan(null);
        }}
        prompt={plan ?? ""}
        model={model}
        models={models.map((m) => ({ id: m.id, name: nameOf(m.id, listed) }))}
      />
      {dragging ? (
        <YStack
          aria-hidden
          position="absolute"
          t={0}
          r={0}
          b={0}
          l={0}
          z={10}
          items="center"
          justify="center"
          bg="var(--surface-scrim)"
          borderWidth={2}
          borderStyle="dashed"
          borderColor="$borderColor"
          rounded="var(--pane-round)"
          pointerEvents="none"
        >
          <XStack items="center" gap="$2" px="$4" py="$2.5" rounded="$10" bg="$background" borderWidth={1} borderColor="$borderColor">
            <Paperclip size={15} aria-hidden />
            <Text fontSize="$4" color="$ink">
              {t("Drop files to attach")}
            </Text>
          </XStack>
        </YStack>
      ) : null}
      {/* The conversation's own row: its title and who is in it, and at its
          right end the conversation's controls — Share, its menu, the
          Summary, and the tabs beside it. */}
      <XStack
        data-slot="conversation-head"
        height={BAND}
        items="center"
        justify="space-between"
        gap="$3"
        paddingInlineStart="$4"
        paddingInlineEnd="$2"
        shrink={0}
        data-tauri-drag-region="deep"
        onMouseDown={dragWindow}
        onDoubleClick={toggleWindowMaximize}
        $max-md={!mine && !room.length ? { display: 'none' } : undefined}
      >
        <XStack items="center" gap="$2" minW={0} flex={1}>
          {mine ? (
            <Text fontSize={15} lineHeight={20} color="$ink" numberOfLines={1} shrink={1} minW={0}>
              {tidy(mine.title)}
            </Text>
          ) : null}
          {/* WHO IS AT THE OTHER END, or nothing at all.
              `withWhom || "Jobs"` put a name and a photograph on a room the
              reader had chosen nobody for — the same defect the empty state
              below already fixed once, still standing up here. The badge beside
              it read "VIP · AI" for everyone, which is not a fact about any
              agent: no row carries a tier, so there is nothing to draw. */}
          {room.length ? (
            // EVERYONE IN THE CONVERSATION, each with the control that lets
            // them out. The strip under the composer adds and removes the same
            // people; either place changes the one room. The row scrolls
            // sideways on a narrow screen rather than pushing the header's
            // controls off it, and a phone shows faces without names.
            <XStack
              role="list"
              aria-label={t("Agents in this chat")}
              items="center"
              gap="$1.5"
              minW={0}
              overflowX="auto"
              // The row scrolls without drawing a bar; gui types no `scrollbarWidth`.
              $platform-web={{ scrollbarWidth: "none" }}
            >
              {room.map((name) => (
                <XStack
                  key={name}
                  role="listitem"
                  items="center"
                  gap="$1.5"
                  paddingInlineStart="$1"
                  paddingInlineEnd="$0.5"
                  py="$0.5"
                  rounded={999}
                  borderWidth={1}
                  borderColor="$borderColor"
                  shrink={0}
                >
                  <Face
                    src={faces[name]?.avatar ?? (name === withWhom ? portrait : undefined)}
                    emoji={faces[name]?.emoji ?? (name === withWhom ? persona?.emoji : undefined)}
                    name={name}
                    size={22}
                  />
                  <Text fontSize="$2" fontWeight="600" color="$color" numberOfLines={1} display="none" $sm={{ display: "flex" }}>
                    {name}
                  </Text>
                  <Box
                    render="button"
                    onClick={() => openAgent(name)}
                    aria-label={t("Remove {name} from this chat", { name })}
                    title={t("Remove {name}", { name })}
                    width={24}
                    height={24}
                    rounded={999}
                    items="center"
                    justify="center"
                    hoverStyle={{ bg: "$hover" }}
                  >
                    <X size={13} aria-hidden color="var(--soft, var(--muted-foreground))" />
                  </Box>
                </XStack>
              ))}
            </XStack>
          ) : null}
        </XStack>

        <XStack data-slot="conversation-controls" data-tauri-drag-region="false" items="center" gap={4} shrink={0}>
          {free ? (
            <Button
              size="xs"
              variant="outline"
              data-slot="header-upgrade"
              gap="$1.5"
              px="$2.5"
              py="$1"
              rounded="$4"
              cursor="pointer"
              hoverStyle={{ bg: 'var(--white-10)' }}
              onPress={() => window.location.assign(payUrl('/cart', { org: org(), returnUrl: window.location.href }))}
              aria-label={t("Upgrade plan")}
            >
              <Sparkles size={13} color="var(--primary)" aria-hidden />
              <Text fontSize="$1" fontWeight="600" color="$ink">
                {t("Upgrade plan")}
              </Text>
            </Button>
          ) : null}
          {open ? <Share thread={open} /> : null}
          {mine ? (
            <ConversationMenu threads={alone} active={open} onSchedule={anonymous ? undefined : () => setPlan(lastAsked())}>
              <XStack>
                <ThreadMore t={mine} />
              </XStack>
            </ConversationMenu>
          ) : null}
          <XStack $max-md={{ display: 'none' }}>
            <Summary sections={sections} onOpen={() => setPanel(true)} label={t("Summary")} />
          </XStack>
          {/* THE TABS' OWN CONTROL, at the header's end while they are shut;
              open, the strip beside the conversation holds it. Its mark is
              never the sidebar's: that toggle is the window's, at its top-left. */}
          <XStack $max-md={{ display: 'none' }}>
            <PanelToggle open={panel} onToggle={() => setPanel(!panel)} />
          </XStack>
        </XStack>
      </XStack>

      {/* The frame owns the column on a laptop; this is what Chat puts in it.
          On a phone the panel is a sheet over the room instead. */}
      {wide && aside !== null ? (
        <Beside>
          <Panel side={deck} kinds={NONE} onHide={() => setPanel(false)} label={t("Tabs")} {...browsing} />
        </Beside>
      ) : null}
      {!wide && panel ? <Panel side={deck} kinds={NONE} sheet onHide={() => setPanel(false)} label={t("Tabs")} {...browsing} /> : null}

      <ChatSurface
        {...chat}
        messages={shown}
        send={guarded}
        // AN EMPTY ROOM CENTRES ITS COMPOSER on a laptop. While nothing has been
        // said the opening (the heading) and the composer sit as one group in the
        // middle of the height; the moment a turn exists the transcript takes the
        // height and the composer docks under it. A phone keeps it at the foot,
        // over the keyboard, from the first moment.
        center={media.sm}
        // AS IT WAS WRITTEN. The package renders a turn's words plainly and
        // says so — it ships no markdown pipeline because the plugin set is the
        // surface's to choose — so an answer arrived here reading "```ts" with
        // the backticks on screen. `Prose` is the site's one renderer, reading
        // with the same `marked` the legal pages parse with and drawing every
        // token in gui elements, and the shared view draws through it too.
        body={(turn) => {
          if (String(turn.id).startsWith(`${FAILED}:`)) {
            const question = shown.find((one) => one.id === String(turn.id).slice(FAILED.length + 1));
            return question ? failure(question) : null;
          }
          // A QUESTION THAT CARRIED PICTURES draws them beside its words.
          if (turn.role === "user" && Array.isArray(turn.content)) {
            const parts = partsOf(turn.content);
            const asked = parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("\n");
            return (
              <YStack gap="$1">
                <Parts parts={parts} prose={(text) => <Prose text={text} />} />
                {!anonymous && asked ? <Plan onPress={() => setPlan(asked)} /> : null}
              </YStack>
            );
          }
          const said = typeof turn.content === "string" ? turn.content : "";
          // A QUESTION THAT CARRIED FILES draws its words and the files' chips;
          // the passages it handed the model are the model's to read, not ours.
          if (turn.role === "user" && said) {
            const read = told(said);
            if (read.carried)
              return (
                <YStack gap="$1">
                  <Carried
                    text={read.text}
                    attached={read.carried.attached}
                    reused={read.carried.reused}
                    onOpen={openFile}
                    onSave={anonymous ? undefined : (url, id, f) => keepOne(url, id, f.name, f.type)}
                  />
                  {!anonymous && read.text ? <Plan onPress={() => setPlan(read.text)} /> : null}
                </YStack>
              );
          }
          // WHILE THE ANSWER HAS NO WORDS YET: who is answering (the agents the
          // question addresses, or the whole room when it names nobody), and the
          // model's reasoning as it streams (`reasoning` on the turn), dimmed and
          // cut to its last lines.
          const thought = turn.role === "assistant" && !said && chat.streaming ? ((turn as { reasoning?: string }).reasoning ?? "").trim() : "";
          if (turn.role === "assistant" && !said && chat.streaming && (room.length || thought)) {
            const q = [...shown].reverse().find((one) => one.role === "user");
            const whom = room.length ? addressed(words(q?.content as Said), room) : [];
            return (
              <YStack gap="$1" data-slot="thinking">
                <Text fontSize="$2" color="$soft">
                  {whom.length
                    ? whom.length > 1
                      ? thought
                        ? t("{names} are thinking…", { names: join(whom, t) })
                        : t("{names} are answering…", { names: join(whom, t) })
                      : thought
                        ? t("{names} is thinking…", { names: join(whom, t) })
                        : t("{names} is answering…", { names: join(whom, t) })
                    : t("Thinking…")}
                </Text>
                {thought ? (
                  <Text fontSize="$2" color="$soft" opacity={0.72} data-slot="thought">
                    {thought.length > THOUGHT ? `…${thought.slice(-THOUGHT).replace(/^\S*\s/, "")}` : thought}
                  </Text>
                ) : null}
              </YStack>
            );
          }
          // A ROOM'S ANSWER IS SEVERAL PEOPLE'S. Each opens a line with their
          // name, as the brief asks, so each is drawn under their own face and
          // read in their own voice. A reply that names nobody is drawn whole.
          const parts = turn.role === "assistant" ? speakers(said, known) : null;
          if (parts && parts.some((part) => part.who)) {
            // Asked and silent: an agent the question addressed who has no part
            // in this reply.
            const at = shown.findIndex((one) => one.id === turn.id);
            const q = shown.slice(0, at).reverse().find((one) => one.role === "user");
            const silent =
              room.length > 1 && !(chat.streaming && at === shown.length - 1)
                ? addressed(words(q?.content as Said), room).filter(
                    (name) => !parts.some((part) => part.who?.toLowerCase() === name.toLowerCase()),
                  )
                : [];
            return (
              <YStack gap="$3">
                {parts.map((part, i) => (
                  <YStack key={i} gap="$1">
                    {part.who ? (
                      <XStack items="center" gap="$2">
                        <Face src={faces[part.who]?.avatar} emoji={faces[part.who]?.emoji} name={part.who} size={20} />
                        <Text fontSize="$2" fontWeight="600" color="$ink">
                          {part.who}
                        </Text>
                      </XStack>
                    ) : null}
                    <Prose text={part.text} />
                    {part.text ? <Reply text={part.text} listen={listen(part.who ?? withWhom ?? undefined)} onOpen={opener(part.text)} /> : null}
                  </YStack>
                ))}
                {silent.length ? (
                  <Text fontSize="$2" color="$soft">
                    {t("No answer from {names} in this reply.", { names: join(silent, t) })}
                  </Text>
                ) : null}
                {byline(turn.id)}
              </YStack>
            );
          }
          return (
            <YStack gap="$1">
              <Prose text={said} />
              {/* UNDER AN ANSWER, the row Dev's answers have too (@hanzo/build
                  `Reply`): copy the markdown as written, listen in the
                  speaker's voice, and open what it wrote in the side panel.
                  Only an answer, and only one with words in it. */}
              {turn.role === "assistant" && said ? <Reply text={said} listen={listen(withWhom ?? undefined)} onOpen={opener(said)} /> : null}
              {turn.role === "assistant" && said ? byline(turn.id) : null}
              {turn.role === "user" && said && !anonymous ? <Plan onPress={() => setPlan(said)} /> : null}
            </YStack>
          );
        }}
        // The page's ONE heading, and it belongs to the empty transcript rather
        // than to a signed-out branch — the branch is gone, and the heading went
        // with it when it did. `Ask` passes its own, because the page embedding
        // it already has an `<h1>` and a second is the defect that took the
        // landings off /chat and /dev.
        empty={
          heading === null ? undefined : (
            // Centred with the composer by `center` above: the free space is
            // split above and below the [heading, composer] group, so it sits
            // in the middle of whatever height the window happens to have, and
            // stays right when the sidebar, the notice line or an error banner
            // changes what is left over.
            // On a phone (no `center`) it takes the height above the composer, which docks at the foot,
            // and stands at the foot of that height: close above what it opens, as on a laptop.
            <YStack data-slot="opening" items="center" width="100%" pt="$6" pb="$2" {...(media.sm ? null : { flex: 1, justify: "flex-end" as const })}>
              {/* THE PORTRAIT IS A DM'S, AND ONLY A DM'S. It used to draw for
                  everyone, because `withWhom || "jobs"` gave a reader who had
                  chosen nobody a 160px photograph of somebody — and the heading
                  under it said their name. A fresh /chat is not a conversation
                  with anyone yet. */}
              {room.length > 1 ? (
                <XStack items="center" justify="center" mb="$4">
                  {room.map((name, i) => (
                    <Box key={name} marginInlineStart={i ? -16 : 0} rounded={40} borderWidth={2} borderColor="$background" z={room.length - i}>
                      <Face src={faces[name]?.avatar} emoji={faces[name]?.emoji} name={name} size={72} />
                    </Box>
                  ))}
                </XStack>
              ) : portrait ? (
                <Box
                  width={160}
                  height={160}
                  rounded={24}
                  overflow="hidden"
                  borderWidth={2}
                  borderColor="var(--white-15)"
                  boxShadow="0 10px 24px color-mix(in srgb, var(--pure-black) 70%, transparent)"
                  mb="$4"
                  bg="var(--neutral-900)"
                >
                  <View render={<img src={portrait} alt={withWhom} />} width="100%" height="100%" objectFit="cover" />
                </Box>
              ) : null}

              {/* A face for an agent with no picture at all — the glyph it
                  picked, or its initial. The block above draws the picture when
                  there is one, so only one of the two ever stands here. */}
              {room.length === 1 && !portrait ? (
                <Box mb="$3">
                  <Face emoji={mate?.emoji ?? persona?.emoji} name={withWhom} size={72} />
                </Box>
              ) : null}

              <Text
                render="h1"
                fontSize="$7"
                lineHeight="$7"
                fontWeight="700"
                color="$ink"
                text="center"
                mb="$1"
              >
                {join(room, t) || heading || (firstName ? t("What’s up, {name}?", { name: firstName }) : t("What’s up?"))}
              </Text>

              {/* WHAT THE AGENT ROW SAYS ABOUT ITSELF, and only that. The
                  fallback under this read gave two colleagues a job title each —
                  "Engineering Lead @ Hanzo", "Admin & Founder @ Hanzo" — and
                  anyone else a blurb about product vision. Those were typed
                  here, not read from anywhere: a claim about an identifiable
                  person, shipped in the bundle, that nobody they name has seen.
                  A persona with no description gets a name and no sentence. */}
              {room.length === 1 && (mate?.description ?? persona?.description) ? (
                <Text
                  fontSize="$3"
                  color="$soft"
                  text="center"
                  maxW={500}
                  mb="$4"
                  lineHeight="$4"
                >
                  {mate?.description ?? persona?.description}
                </Text>
              ) : null}

            </YStack>
          )
        }
        // The transcript reads at the same measure. `Thread` defaults to 768
        // itself; handing it the column here is what lets Width reach it.
        column={{ maxW: MEASURE }}
        composer={(() => {
          const basePrompt = prompt(
            {
              ...composing,
              field: mention.field,
            },
            mention.state
          );
          return {
            ...basePrompt,
            send: (
              <XStack items="center" gap="$1.5" shrink={0}>
                {chatPrefs.showTurboApproval ? (
                  <XStack
                    items="center"
                    gap="$1"
                    px="$2"
                    py="$1"
                    rounded={999}
                    borderWidth={1}
                    borderColor="$borderColor"
                    bg="$background"
                    aria-label={t("Turbo Approval: {mode}", { mode: chatPrefs.approvalMode })}
                  >
                    <Zap size={12} color="var(--primary)" aria-hidden />
                    <Text fontSize="$1" fontWeight="600" color="$ink">
                      {chatPrefs.approvalMode === "manual" ? t("Manual") : t("Turbo")}
                    </Text>
                  </XStack>
                ) : null}
                <ThinkingEffort
                  effort={chatPrefs.effort || 'high'}
                  onChange={(eff) => {
                    setChatPrefs({ effort: eff })
                    const next = shared(eff)
                    if (next) mind.pace(next)
                  }}
                  disabled={chat.streaming || talk.open}
                />
                {basePrompt.send}
              </XStack>
            ),
          };
        })()}
      />
      <AgentMaker />
      {carry.dialog}
      <Upgrade ask={ask} onClose={() => setAsk(null)} />
    </YStack>
  );
}
