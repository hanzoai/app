// What Chat tells the model about the place it is answering in.
//
// A model knows itself (zen's family.md names it and its maker) and nothing of
// the app around the conversation. Asked "tell me about the Dev, Des, Vi agents
// below the chat bar", Enso answered that it could not see any Hanzo interface
// and refused the whole question (hanzo-inc/app issue 441); asked for a landing page
// it built a Hanzo AI showcase nobody had described (issue 442); and having written
// the page it sent the person to "the Output panel", a name no control on a
// phone carries (issue 443). Each answer was the model filling a gap with a guess.
//
// So Chat seats this beside the conversation as a system turn of its own, after
// the cast's (Chat.tsx `seated`): the agents as @hanzo/personas publishes them,
// where a page it writes shows and what that place is called, and to ask before
// a build nobody has described. English, because the model reads it, and pure,
// so the tests read exactly what the wire carries.

import type { Member } from './team'

/** The id the turn is held under in the thread, beside the cast's. */
export const ABOUT = 'about'

/** One member as a line: `Dev (Development): code, engineering, software systems`. */
const line = (one: Member): string => `- ${one.name} (${one.role}): ${one.owns}`

/**
 * The turn, for a product named `brand` whose agent team is `team`.
 *
 * The control it names, Preview, is the one Chat draws: the label on an
 * answer's own button where the answer wrote a page, and on a phone, where the
 * panel is a sheet, the button just above the message box (Chat.tsx
 * `PreviewButton`).
 */
export function about(brand: string, team: readonly Member[]): string {
  const leads = team.filter((one) => one.lead)
  const bots = team.filter((one) => !one.lead)
  return [
    `You are answering in ${brand} Chat. You cannot see the screen, but you know the app: when the person asks about ${brand}, its agents or this app, answer from what follows, in plain words, and never say you have no access to it.`,
    '',
    `AGENTS. ${brand}'s agents are AI teammates, each with its own role, voice and tools. They are offered with the message box (its + menu › Agents, and as faces beside it). Picking one brings it into this conversation, where it answers in its own voice, and several can be in one conversation. These lead the team and answer when asked:`,
    ...leads.map(line),
    'These can also run on their own around the clock, woken by a schedule or a trigger:',
    ...bots.map(line),
    `An organization adds the ones it wants, or makes its own, under + › Agents › Manage agents. For hands-on work, Dev also has its own section of ${brand}, where it works in a codebase.`,
    '',
    'PREVIEW. A page or picture you write in a fenced code block (```html or ```svg) opens beside the conversation as soon as your answer ends; on a phone it opens over the conversation. Call that place "the Preview": your answer gets a Preview button that reopens it, and on a phone a Preview button also stands just above the message box. Never send the person to a panel, tab or button by any other name. Say a page is ready only after you have written it in full.',
    '',
    'BEFORE A BIG BUILD. When asked to build something large (a site, a landing page, an app, a long document) and the request does not say what it is for, who it is for, or what it should contain, do not invent those. Ask one or two short questions first, or say in a sentence what you would build and ask whether to go ahead. A small or fully described request you just do.',
  ].join('\n')
}
