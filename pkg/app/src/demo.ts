/**
 * The build note Chat appends to a turn before it goes to the model.
 *
 * `about.ts` already tells the model to ask before a big build nobody has
 * described (hanzo-inc/app issue 442). That rule alone did not fix the bug:
 * `Chat.tsx` `submit()` appended a stronger, more specific instruction —
 * "build a complete ... Hanzo AI platform showcase" — to every turn that
 * looked like a demo request, so the model built immediately and invented
 * the showcase. The note below is the only place that instruction lives,
 * and it is now conditional: a specific request still gets the build note;
 * an underspecified one gets an "ask first" note instead, and the build
 * note — including its Hanzo-showcase default — is not sent at all.
 */

/** The demo-build instruction, verbatim as `Chat.tsx` used to send it. */
export const DEMO_NOTE =
  "Build a complete, self-contained, interactive single-file HTML application inside a ```html demo.html code fence (with embedded modern dark-mode CSS and interactive JavaScript controls) so it renders live in the side-by-side Outputs preview panel. If the request is for a Hanzo demo, build an interactive Hanzo AI platform showcase featuring Enso & Zen frontier models, Hanzo Dev autonomous coding agents, Hanzo Bot, Hanzo Cloud, and Model Context Protocol (MCP) tools with working interactive tabs and live simulations rather than a plain text or Python snippet."

/** Sent instead of `DEMO_NOTE` when the build has not been described. */
export const CLARIFY_NOTE =
  "Do not build anything yet. Ask one or two short questions first — what it is for, who it is for, and what it should contain — or say in one sentence what you would build and ask whether to go ahead. Do not invent the subject, audience or content, and do not default to a Hanzo AI showcase."

/**
 * Whether a turn asks for an interactive demo or page build.
 *
 * `showcase` is a demo noun here even though the old `Chat.tsx` regex did
 * not list it: "Build a Hanzo AI showcase …" is a build request, and the
 * old regex silently sent no note for it. `CONTENT_WORDS` already treats
 * "showcase" as content, so a described showcase still gets `DEMO_NOTE`.
 */
export function isInteractiveDemo(text: string): boolean {
  return /\b(make|build|create|design|generate|show)\b[\s\S]*\b(demo|website|web\s*app|landing\s*page|dashboard|interactive|prototype|ui|preview|showcase)\b/i.test(text)
}

/** Words that show the person said what the build should contain. */
const CONTENT_WORDS = [
  "menu", "pricing", "price", "signup", "sign-up", "contact", "hours",
  "location", "features", "feature", "hero", "about", "portfolio",
  "product", "service", "services", "blog", "gallery", "form",
  "checkout", "cart", "dashboard", "sales", "region", "chart", "data",
  "table", "list", "map", "calendar", "booking", "login", "account",
  "search", "filter", "tabs", "showcase", "mcp", "api", "models",
]

/**
 * Whether a demo-build request says too little to build from.
 *
 * Specific is: a "for …" that names something other than Hanzo / Dev /
 * Enso / Zen themselves, a content word from `CONTENT_WORDS`, a long
 * descriptive request (15+ words), or details given in quotes.
 * "Build a landing page with Dev" and "Build a landing page for Hanzo AI"
 * are both underspecified: the first says nothing at all, the second names
 * only the brand itself, which is exactly the showcase `DEMO_NOTE` used
 * to invent.
 */
export function isUnderspecifiedBuild(text: string): boolean {
  if (!isInteractiveDemo(text)) return false
  const cleaned = text
    .toLowerCase()
    .replace(/\b(with|using|via)\s+(dev|enso|zen|hanzo)\b/g, " ")
    .replace(/\bplease\b/g, " ")
  if (/\bfor\s+(?!hanzo\b|dev\b|enso\b|zen\b|me\b|us\b)[a-z][a-z' -]{2,}/.test(cleaned)) return false
  if (CONTENT_WORDS.some((word) => new RegExp(`\\b${word}\\b`).test(cleaned))) return false
  if (cleaned.split(/\s+/).filter(Boolean).length >= 15) return false
  if (/["“]/.test(cleaned)) return false
  return true
}

/**
 * The note to append to a turn: the build note for a described build,
 * the ask-first note for one that has not been described, and nothing
 * for a turn that is not a build at all.
 */
export function buildNote(text: string): string {
  if (!isInteractiveDemo(text)) return ""
  return isUnderspecifiedBuild(text) ? CLARIFY_NOTE : DEMO_NOTE
}
