import { phrase } from '@hanzo/i18n'

/**
 * A working day in Hanzo Team, as data: what `TeamPreview` plays. It opens on
 * the morning hopping across the organizations a person belongs to — Acme (a
 * sample company), Orbit (an open-source project Acme's people and others
 * maintain together), Friday Club (friends) — before it settles at Acme, where
 * people and their agents fix a bug, answer a customer, clear the inbox, raise
 * a round, review a design, hire and launch; in the evening the switcher flips
 * to Friday Club, where friends build a recipe app and book game night.
 *
 * The script is events, each a room's (`org/channel`): a message, someone
 * typing, a reaction, a thread reply, a card changing state (a pull request
 * merged, a draft sent), a huddle, and the view moving to another room. A
 * message to a room out of view leaves it unread, which is what the next room
 * is opened by. `pace` sets how long each event waits from what came before
 * it: the reading time of the message before, the typing, the pause after a
 * room opens. `frame` folds the events up to a point into what the screen
 * shows, so any beat is a whole frame and the script holds no state.
 *
 * Every authored word is `phrase`d; a person's or agent's name, a channel, a
 * file and a repository stay as written. Nothing here is a measurement: the
 * company, the people and the numbers in a card are sample copy.
 */

export type Mark = 'thumbs' | 'heart' | 'flame' | 'rocket' | 'eyes' | 'laugh' | 'party' | 'check'

export type Card =
  /** A pull request: under review, its checks passed, merged. */
  | { kind: 'pr'; repo: string; number: number; title: string; add: number; del: number; state: 'review' | 'passed' | 'merged'; reviewer?: string }
  /** A reply drafted for a person to approve: an email or a support answer. */
  | { kind: 'draft'; to: string; body: string; sent?: boolean; approver?: string }
  | { kind: 'file'; name: string; type: 'doc' | 'deck' | 'sheet' | 'image'; detail?: string }
  | { kind: 'meeting'; title: string; when: string }
  | { kind: 'list'; title: string; items: string[]; done?: number[] }
  /** A question an agent stops to ask, with its answers; `picked` once a person answers. */
  | { kind: 'ask'; options: string[]; picked?: number; asks?: string }
  /** Design directions side by side, one picked. */
  | { kind: 'options'; file: string; options: string[]; picked?: number }

type Base = { wait?: number }
export type Event = Base &
  (
    | { kind: 'open'; room: string; time: number }
    | { kind: 'say'; room: string; who: string; text: string; id?: string; card?: Card }
    | { kind: 'typing'; room: string; who: string }
    | { kind: 'react'; to: string; mark: Mark; n: number }
    | { kind: 'reply'; to: string; who: string; text: string }
    /** A card changes: a pull request merges, a draft is sent, an answer is picked. */
    | { kind: 'card'; to: string; patch: Partial<Card> }
    /** The thread beside the channel opens on a message, or closes (`to: null`). */
    | { kind: 'thread'; to: string | null }
    /** A huddle starts in a room with these people, or ends (`who: []`). */
    | { kind: 'huddle'; room: string; who: string[] }
    /** A step of an org's mission is done. */
    | { kind: 'step'; org: string; n: number }
  )
export type Beat = Event & { wait: number }

export type Who = { name: string; role?: string }

/** People wear their initials; agents wear the crew's memoji (`/memoji/<id>.svg`). */
export const PEOPLE: Record<string, Who> = {
  zoe: { name: 'Zoe Iyer' },
  ada: { name: 'Ada Park' },
  sam: { name: 'Sam Ortiz' },
  theo: { name: 'Theo Brandt' },
  mina: { name: 'Mina Chen' },
  nia: { name: 'Nia Okafor' },
  leo: { name: 'Leo Varga' },
  omar: { name: 'Omar Haddad' },
  jun: { name: 'Jun Mori' },
  priya: { name: 'Priya Nair' },
}

export const AGENTS: Record<string, Who> = {
  vi: { name: 'Vi', role: phrase('Visionary') },
  fin: { name: 'Fin', role: phrase('Finance') },
  dev: { name: 'Dev', role: phrase('Software') },
  mark: { name: 'Mark', role: phrase('Marketing') },
  opera: { name: 'Opera', role: phrase('Operations') },
  des: { name: 'Des', role: phrase('Designer') },
  sal: { name: 'Sal', role: phrase('Sales') },
  su: { name: 'Su', role: phrase('Support') },
  cyber: { name: 'Cyber', role: phrase('Security') },
  sci: { name: 'Sci', role: phrase('Research') },
  huma: { name: 'Huma', role: phrase('People') },
  mana: { name: 'Mana', role: phrase('Product') },
  data: { name: 'Data', role: phrase('Analytics') },
  lang: { name: 'Lang', role: phrase('Translation') },
  art: { name: 'Art', role: phrase('Art & video') },
  law: { name: 'Law', role: phrase('Legal') },
  mu: { name: 'Mu', role: phrase('Music') },
  doc: { name: 'Doc', role: phrase('Docs') },
}

export const agent = (id: string) => id in AGENTS
export const who = (id: string): Who => AGENTS[id] ?? PEOPLE[id] ?? { name: id }

export type Channel = { id: string; topic: string }
export type Org = {
  id: string
  name: string
  /** The org's tile on the rail: its initial. */
  mark: string
  channels: Channel[]
  /** Direct messages: people, and an agent or two someone talks to one to one. */
  people: string[]
  agents: string[]
}

export const ORGS: Org[] = [
  {
    id: 'acme',
    name: 'Acme',
    mark: 'A',
    channels: [
      { id: 'general', topic: phrase('Everything Acme') },
      { id: 'launch', topic: phrase('Shipping Thursday') },
      { id: 'eng', topic: phrase('Code, reviews and deploys') },
      { id: 'support', topic: phrase('Customers first') },
      { id: 'inbox', topic: phrase('Email, sorted and drafted') },
      { id: 'fundraise', topic: phrase('The seed round') },
      { id: 'design', topic: phrase('Screens, mocks and taste') },
      { id: 'hiring', topic: phrase('Who joins next') },
      { id: 'random', topic: phrase('Everything else') },
    ],
    people: ['zoe', 'theo', 'mina', 'sam', 'nia'],
    agents: ['dev', 'su', 'opera', 'fin', 'sal', 'des', 'huma', 'mark', 'lang', 'law', 'doc', 'mana', 'vi'],
  },
  {
    id: 'friday',
    name: 'Friday Club',
    mark: 'F',
    channels: [
      { id: 'side-project', topic: phrase('A recipe app, for fun') },
      { id: 'game-night', topic: phrase('Who is in this week') },
      { id: 'ideas', topic: phrase('Half-baked, on purpose') },
    ],
    people: ['mina', 'leo', 'omar', 'jun'],
    agents: ['mana', 'dev', 'art', 'vi', 'mu'],
  },
  {
    id: 'orbit',
    name: 'Orbit',
    mark: 'O',
    channels: [
      { id: 'general', topic: phrase('An open-source project, maintained together') },
      { id: 'contributors', topic: phrase('Pull requests and reviews') },
      { id: 'releases', topic: phrase('What ships, and when') },
    ],
    people: ['priya', 'theo', 'jun'],
    agents: ['dev', 'doc', 'cyber'],
  },
  {
    id: 'lab',
    name: 'Night Lab',
    mark: 'N',
    channels: [
      { id: 'general', topic: phrase('Late ideas, early prototypes') },
      { id: 'ideas', topic: phrase('Filed under someday') },
    ],
    people: ['theo', 'priya'],
    agents: ['sci', 'data', 'dev'],
  },
]

/** What each organization is working toward this week: a title and its steps, done as the day goes. */
export const MISSIONS: Record<string, { title: string; steps: string[] }> = {
  acme: {
    title: phrase('Launch on Thursday'),
    steps: [
      phrase('Fix the double charge'),
      phrase('Answer the Safari ticket'),
      phrase('Clear the inbox'),
      phrase('Deck, model and intros'),
      phrase('Sign off the plan cards'),
      phrase('Book the designer interviews'),
      phrase('Publish the launch post'),
    ],
  },
  orbit: { title: phrase('Ship 2.4'), steps: [phrase('Land the retry fix'), phrase('Document how retries back off'), phrase('Audit dependencies'), phrase('Tag the release')] },
  friday: { title: phrase('A recipe app by Sunday'), steps: [phrase('Set up the board'), phrase('Search by ingredient'), phrase('Pick a logo'), phrase('Book game night')] },
  lab: { title: phrase('A first prototype'), steps: [phrase('Boot it'), phrase('Plan a week with it'), phrase('Write up what broke')] },
}

export const orgOf = (room: string) => ORGS.find((o) => o.id === room.split('/')[0]) ?? ORGS[0]
export const channelOf = (room: string) => room.split('/')[1] ?? 'general'

/** Minutes after midnight. */
const hm = (h: number, m: number) => h * 60 + m

/** A message as the screen draws it. */
export interface Message {
  id: string
  who: string
  text: string
  time: number
  card?: Card
  reactions: { mark: Mark; n: number }[]
  replies: { who: string; text: string; time: number }[]
}

type Seed = { who: string; text: string; time: number }

/** What each room already holds when the day begins, so none opens empty. */
const SEED: Record<string, Seed[]> = {
  'acme/general': [
    { who: 'zoe', text: phrase('Welcome to Acme. Agents are teammates here: mention one to hand it work.'), time: hm(8, 30) },
    { who: 'vi', text: phrase("Yesterday's notes are pinned: what shipped, what is waiting on whom."), time: hm(8, 40) },
    { who: 'sam', text: phrase('The coffee machine is fixed. Dev did not fix it, to be clear.'), time: hm(8, 52) },
  ],
  'acme/eng': [
    { who: 'theo', text: phrase('Morning. Main is green.'), time: hm(8, 58) },
    { who: 'dev', text: phrase('Overnight tests passed. The two flaky ones are steady now; they were racing the clock.'), time: hm(9, 1) },
  ],
  'acme/support': [{ who: 'su', text: phrase('Overnight questions are answered, each with a link to the page in the docs.'), time: hm(8, 40) }],
  'acme/inbox': [{ who: 'opera', text: phrase('Every reply that needed you went out after your ok.'), time: hm(8, 45) }],
  'acme/fundraise': [{ who: 'zoe', text: phrase('The investor list lives in the pinned doc.'), time: hm(8, 50) }],
  'acme/design': [{ who: 'des', text: phrase('New icons are in the library.'), time: hm(9, 5) }],
  'acme/hiring': [{ who: 'huma', text: phrase('The interview loop is in the handbook.'), time: hm(9, 10) }],
  'acme/launch': [{ who: 'mana', text: phrase('Launch is Thursday. The checklist is pinned.'), time: hm(9, 15) }],
  'acme/random': [
    { who: 'sam', text: phrase('Who left a croissant on the printer?'), time: hm(9, 20) },
    { who: 'vi', text: phrase('It was there before me.'), time: hm(9, 21) },
  ],
  'friday/side-project': [
    { who: 'leo', text: phrase("Last week's build is still running. Somehow."), time: hm(8, 30) },
    { who: 'jun', text: phrase('I named the database after my cat. It is too late to change it.'), time: hm(8, 41) },
  ],
  'friday/game-night': [{ who: 'jun', text: phrase('Rematch pending.'), time: hm(8, 40) }],
  'friday/ideas': [{ who: 'omar', text: phrase('A playlist that matches the recipe.'), time: hm(8, 45) }],
  'orbit/general': [{ who: 'priya', text: phrase('Welcome, new contributors. Start with the issues marked good first.'), time: hm(8, 10) }],
  'orbit/contributors': [
    { who: 'jun', text: phrase('Reviews this week: two from Acme, one from us.'), time: hm(8, 20) },
    { who: 'cyber', text: phrase('Every open pull request passed the dependency check overnight.'), time: hm(8, 35) },
  ],
  'orbit/releases': [{ who: 'doc', text: phrase('The changelog for 2.4 is drafted.'), time: hm(8, 25) }],
  'lab/general': [{ who: 'priya', text: phrase('The prototype boots. That is all it does.'), time: hm(21, 0) }],
  'lab/ideas': [{ who: 'theo', text: phrase('A bot that waters the plants.'), time: hm(21, 5) }],
}

/** Rooms with news before the day starts: their channel is bold, their org's tile marked. */
export const UNREAD: Record<string, number> = { 'acme/random': 2, 'orbit/releases': 3, 'friday/ideas': 1, 'lab/ideas': 1 }

/** The events of one room's scene, in the room's own words. */
function room(id: string, time: number, build: (r: Room) => Event[]): Event[] {
  return [{ kind: 'open', room: id, time }, ...build(new Room(id))]
}

/** Writes a room's events without naming the room each time. */
class Room {
  constructor(readonly id: string) {}
  say(who: string, text: string, more: { id?: string; card?: Card } = {}): Event {
    return { kind: 'say', room: this.id, who, text, ...more }
  }
  typing(who: string): Event {
    return { kind: 'typing', room: this.id, who }
  }
  huddle(...who: string[]): Event {
    return { kind: 'huddle', room: this.id, who }
  }
}
const react = (to: string, mark: Mark, n: number): Event => ({ kind: 'react', to, mark, n })
const reply = (to: string, who: string, text: string): Event => ({ kind: 'reply', to, who, text })
const card = (to: string, patch: Partial<Card>): Event => ({ kind: 'card', to, patch })
const thread = (to: string | null): Event => ({ kind: 'thread', to })
/** A step of an org's mission is done. */
const step = (org: string, n: number): Event => ({ kind: 'step', org, n })
/** A message that arrives in another room while this one is open: it goes unread, and it is the next room's first line. */
const elsewhere = (room: string, who: string, text: string, more: { id?: string; card?: Card } = {}): Event => ({ kind: 'say', room, who, text, ...more })

/**
 * The morning, across organizations: Acme's #general, a thank-you from the
 * open-source project that took Acme's fix, friends planning tonight's build,
 * and back to Acme, where #eng has news. Three switches in under thirty seconds.
 */
const MORNING = room('acme/general', hm(9, 2), (r) => [
  r.say('zoe', phrase("Morning. Launch is Thursday, and Orbit's maintainers are helping us test it.")),
  elsewhere('orbit/contributors', 'priya', phrase('@dev your retry fix from Acme landed upstream. Thank you.'), { id: 'upstream' }),
])

/** Orbit: people from different teams, and an agent that works for more than one. */
const ORBIT = room('orbit/contributors', hm(9, 4), (r) => [
  r.typing('dev'),
  r.say('dev', phrase('Glad it helped. I opened a follow-up so the docs say how retries back off.'), {
    id: 'followup',
    card: { kind: 'pr', repo: 'orbit/orbit', number: 1187, title: phrase('Docs: how retries back off'), add: 42, del: 6, state: 'review', reviewer: 'priya' },
  }),
  react('upstream', 'heart', 4),
  step('orbit', 0),
  elsewhere('friday/side-project', 'omar', phrase("Tonight's build still on?")),
])

/** Friends, in the morning: tonight is on. */
const PLANS = room('friday/side-project', hm(9, 6), (r) => [
  r.say('leo', phrase('On. @mu a playlist for it?')),
  elsewhere('acme/eng', 'theo', phrase('Heads up: checkout looks odd on main.')),
])

/** Coding together: a bug report, a pull request, a review, the checks, the merge. */
const ENG = room('acme/eng', hm(9, 12), (r) => [
  r.say('mina', phrase('Checkout charges twice if you press Pay twice. Steps are in the thread.'), { id: 'bug' }),
  reply('bug', 'mina', phrase('Card form, press Pay, press Pay again before it answers. Two charges.')),
  react('bug', 'eyes', 2),
  r.say('sam', phrase('@dev can you take this one?')),
  r.typing('dev'),
  r.say('dev', phrase('On it. The Pay button stays live until the charge answers, so a second press is a second charge.')),
  r.typing('dev'),
  r.say('dev', phrase('Pull request is up. A new test presses Pay twice and expects one charge.'), {
    id: 'pr',
    card: { kind: 'pr', repo: 'acme/web', number: 482, title: phrase('Disable Pay while a charge is pending'), add: 18, del: 3, state: 'review', reviewer: 'theo' },
  }),
  thread('pr'),
  reply('pr', 'theo', phrase('Reviewing. Could the button show a spinner too? A grey button looks broken.')),
  r.typing('dev'),
  reply('pr', 'dev', phrase('Added a spinner, and the button now says Paying.')),
  card('pr', { state: 'passed' }),
  reply('pr', 'theo', phrase('Approved.')),
  thread(null),
  elsewhere('friday/side-project', 'mu', phrase('Playlist is ready: forty minutes, no lyrics, nothing that sounds like a deadline.')),
  react('pr', 'rocket', 3),
  r.typing('dev'),
  card('pr', { state: 'merged' }),
  r.say('dev', phrase('Merged and deployed. Checkout is live with the fix.')),
  step('acme', 0),
  r.say('mina', phrase('Pressed Pay four times on purpose. Charged once.'), { id: 'tried' }),
  react('tried', 'party', 3),
  r.say('sam', phrase('Pressing Pay twice is no longer a personality trait we support.'), { id: 'trait' }),
  react('trait', 'laugh', 4),
  elsewhere('acme/support', 'su', phrase('New ticket: invoices download as blank PDFs in Safari.')),
])

/** Support together: an agent drafts, a person makes it warmer, it is sent, the cause is fixed. */
const SUPPORT = room('acme/support', hm(10, 4), (r) => [
  r.typing('su'),
  r.say('su', phrase('Drafted a reply.'), {
    id: 'answer',
    card: { kind: 'draft', to: phrase('Ticket #1042'), body: phrase('Sorry about the blank invoices. Safari blocks the download; this link opens them now, and a fix ships today.'), approver: 'nia' },
  }),
  r.say('nia', phrase("Warmer first line, please. And let's not blame Safari in writing.")),
  r.typing('su'),
  card('answer', { body: phrase('Thanks for telling us, and sorry for the blank invoices. This link opens them now, and a fix ships today.') }),
  r.say('su', phrase('Updated.')),
  r.say('nia', phrase('Perfect. Send it.')),
  card('answer', { sent: true }),
  react('answer', 'check', 1),
  r.say('su', phrase('Sent. @dev the download link expires before Safari opens it.')),
  r.typing('dev'),
  r.say('dev', phrase('Found it. Links last five minutes now instead of five seconds. The fix is in #483.'), { id: 'links' }),
  react('links', 'laugh', 3),
  r.say('su', phrase('The customer wrote back: “That was fast. Thank you.”'), { id: 'thanks' }),
  react('thanks', 'heart', 5),
  step('acme', 1),
  elsewhere('acme/inbox', 'opera', phrase('Morning sort is done.'), {
    id: 'sort',
    card: {
      kind: 'list',
      title: phrase('Morning sort'),
      items: [phrase('Needs you: a partnership intro'), phrase('Needs you: a press question'), phrase('Needs you: a contract renewal'), phrase('Drafted: six replies in your voice'), phrase('Archived: newsletters and receipts')],
    },
  }),
])

/** Email: the agent triages and drafts, a person approves a batch, a lawyer catches a clause. */
const INBOX = room('acme/inbox', hm(10, 41), (r) => [
  r.say('opera', phrase('Six replies are drafted in your voice. Approve them as a batch?'), { id: 'batch', card: { kind: 'ask', options: [phrase('Approve all'), phrase('One by one')], asks: 'ada' } }),
  r.typing('ada'),
  card('batch', { picked: 0 }),
  r.say('ada', phrase('Approve all. You know how I write by now.')),
  r.typing('opera'),
  r.say('opera', phrase("Sent all six. The renewal needs a lawyer's eye, so I asked @law.")),
  r.typing('law'),
  r.say('law', phrase('Read it. It renews itself for three years. I would ask for one.'), { id: 'clause' }),
  react('clause', 'eyes', 2),
  r.say('ada', phrase('Good catch. Ask for one, nicely.')),
  r.typing('opera'),
  r.say('opera', phrase('Drafted.'), { id: 'renewal', card: { kind: 'draft', to: phrase('The vendor, about our renewal'), body: phrase('Happy to renew. Could we make the term one year, with the option to extend?'), approver: 'ada' } }),
  r.say('ada', phrase('Nicely done. Send.')),
  card('renewal', { sent: true }),
  step('acme', 2),
  r.say('opera', phrase('Sent. The inbox is at zero, except for the newsletter you keep meaning to read.'), { id: 'zero' }),
  react('zero', 'laugh', 2),
  elsewhere('acme/fundraise', 'zoe', phrase('@fin we need a seed deck by Friday.')),
])

/** Fundraising: the deck and the model, the intros, a meeting booked. */
const FUNDRAISE = room('acme/fundraise', hm(11, 20), (r) => [
  r.typing('fin'),
  r.say('fin', phrase('On it: a deck, and a model with three scenarios where every number links to its source.')),
  r.say('zoe', phrase("No hockey sticks we can't explain.")),
  r.typing('fin'),
  r.say('fin', phrase('Deck v1 is in Drive.'), { id: 'deck', card: { kind: 'file', name: 'Acme seed deck.pdf', type: 'deck', detail: phrase('12 slides') } }),
  r.say('fin', phrase('And the model.'), { id: 'model', card: { kind: 'file', name: 'Acme model.xlsx', type: 'sheet', detail: phrase('Three scenarios, sources linked') } }),
  r.say('fin', phrase('@sal the deck is ready for the intros.')),
  r.say('zoe', phrase('Slide 4 says “synergy”. Remove it with prejudice.')),
  r.typing('fin'),
  r.say('fin', phrase('Removed. Slide 4 now says what the product does.'), { id: 'synergy' }),
  react('synergy', 'laugh', 4),
  r.typing('sal'),
  r.say('sal', phrase('I found four investors who back developer tools. The intros are drafted in your voice.'), {
    id: 'intros',
    card: {
      kind: 'list',
      title: phrase('Intros'),
      items: [phrase('A seed fund that backs developer tools'), phrase('An angel who built a developer tools company'), phrase('A partner who wrote about agents last week'), phrase('A fund Theo knows from his last company')],
    },
  }),
  r.say('zoe', phrase('Send all four.')),
  card('intros', { done: [0, 1, 2, 3] }),
  r.say('sal', phrase('Sent.')),
  r.typing('sal'),
  r.say('sal', phrase('One replied already. Thursday at 2 works for them.'), { id: 'meeting', card: { kind: 'meeting', title: phrase('Acme and a seed fund'), when: phrase('Thursday, 2:00 PM') } }),
  react('meeting', 'flame', 5),
  r.say('theo', phrase('Prep doc?')),
  r.typing('fin'),
  r.say('fin', phrase('In the deck folder: the questions they are likely to ask, with our answers.')),
  step('acme', 3),
  elsewhere('acme/design', 'sam', phrase('@des the plan cards feel crowded.')),
])

/** A design review: two directions, a pick, a handoff. */
const DESIGN = room('acme/design', hm(13, 15), (r) => [
  r.typing('des'),
  r.say('des', phrase('Two directions. A keeps every feature; B keeps the five people compare.'), { id: 'options', card: { kind: 'options', file: 'plan-cards.fig', options: ['A', 'B'] } }),
  r.say('ada', phrase('B. Fewer words, same truth.')),
  r.say('sam', phrase('B, and the prices on one baseline.')),
  card('options', { picked: 1 }),
  r.typing('des'),
  r.say('des', phrase('B it is, prices aligned. @dev the handoff is in the file.')),
  r.typing('dev'),
  r.say('dev', phrase('Picked it up. It will be on the preview link in ten minutes.'), { id: 'handoff' }),
  react('handoff', 'heart', 3),
  step('acme', 4),
  elsewhere('acme/hiring', 'huma', phrase('Designer role: the shortlist is ready, with a note on each.'), {
    id: 'shortlist',
    card: { kind: 'list', title: phrase('Shortlist'), items: [phrase('Product designer, strong systems work'), phrase('Brand designer, moving to product'), phrase('Design engineer, ships in code')] },
  }),
])

/** Hiring: a shortlist, interviews booked, an exercise that respects weekends. */
const HIRING = room('acme/hiring', hm(14, 2), (r) => [
  r.say('mina', phrase("Let's talk to all three.")),
  r.typing('huma'),
  r.say('huma', phrase('Booked for Tuesday and Wednesday. Des wrote the exercise: two hours, not a weekend.')),
  r.say('mina', phrase('Thank you for respecting weekends.'), { id: 'weekends' }),
  react('weekends', 'heart', 4),
  r.say('des', phrase('One screen, two hours, no trick questions.')),
  step('acme', 5),
  elsewhere('acme/launch', 'mark', phrase('The launch post is drafted.'), { id: 'post', card: { kind: 'file', name: 'launch-post.md', type: 'doc', detail: phrase('Draft') } }),
])

/** The launch: the post cut, translated, the checklist closed, a huddle, live. */
const LAUNCH = room('acme/launch', hm(15, 30), (r) => [
  r.say('zoe', phrase('Shorter, please. Nobody reads paragraph four.')),
  r.typing('mark'),
  r.say('mark', phrase('Cut to three paragraphs. Paragraph four is now a footnote nobody will read either.'), { id: 'cut' }),
  react('cut', 'laugh', 5),
  r.say('mark', phrase('@lang can you take it into Japanese and Spanish?')),
  r.typing('lang'),
  r.say('lang', phrase('Translated into Japanese and Spanish. The terms match the glossary.')),
  r.say('mana', phrase('Everything is done but the docs pass. @doc it is yours.'), {
    id: 'checklist',
    card: { kind: 'list', title: phrase('Launch checklist'), items: [phrase('Launch post'), phrase('Translations'), phrase('Pricing page'), phrase('Docs pass'), phrase('Status page')], done: [0, 1, 2, 4] },
  }),
  r.typing('doc'),
  r.say('doc', phrase('Docs pass is done. The quickstart links the new pages.')),
  card('checklist', { done: [0, 1, 2, 3, 4] }),
  r.huddle('zoe', 'ada', 'sam'),
  r.say('ada', phrase('Ship it.')),
  r.typing('mark'),
  r.say('mark', phrase('Posted. It is live.'), { id: 'live' }),
  react('live', 'rocket', 8),
  react('live', 'party', 6),
  step('acme', 6),
  r.huddle(),
  elsewhere('acme/general', 'vi', phrase("Today's notes are ready."), {
    id: 'notes',
    card: {
      kind: 'list',
      title: phrase('Today'),
      items: [phrase('Double charge fixed and shipped'), phrase('A customer answered, then thanked us'), phrase('Inbox at zero'), phrase('A deck, a model and four intros'), phrase('Designer interviews booked'), phrase('Launched')],
      done: [0, 1, 2, 3, 4, 5],
    },
  }),
])

/** The day closes in #general. */
const GENERAL = room('acme/general', hm(17, 50), (r) => [
  r.say('zoe', phrase('And nobody worked the weekend.')),
  r.say('vi', phrase("Tomorrow's plan is on the board. Good evening, everyone."), { id: 'evening' }),
  react('notes', 'heart', 9),
  react('evening', 'thumbs', 5),
])

/** Friends after work: a recipe app, a board, pairing, a logo before a product. */
const SIDE = room('friday/side-project', hm(19, 10), (r) => [
  r.say('mina', phrase('Recipe app tonight?')),
  r.say('omar', phrase('In. @mana set up a board?')),
  r.typing('mana'),
  r.say('mana', phrase('Board is ready: a card each.'), {
    id: 'board',
    card: { kind: 'list', title: phrase('Board'), items: [phrase('Sign-in'), phrase('Save a recipe'), phrase("Search by what's in the fridge")] },
  }),
  step('friday', 0),
  r.say('jun', phrase("I'll take search. @dev pair with me?")),
  r.typing('dev'),
  r.say('dev', phrase('Pairing. Search works on ingredients now: “leftover pizza” returns pizza.'), { id: 'pizza' }),
  card('board', { done: [2] }),
  step('friday', 1),
  react('pizza', 'laugh', 4),
  r.say('leo', phrase('Bringing snacks and opinions.')),
  r.typing('art'),
  r.say('art', phrase('Logo sketches, in case anyone wants a logo before a product.'), { id: 'logos', card: { kind: 'file', name: 'logo-sketches.png', type: 'image', detail: phrase('Three options') } }),
  react('logos', 'heart', 5),
  step('friday', 2),
  elsewhere('friday/game-night', 'omar', phrase('Game night Thursday?')),
])

/** Game night, booked by an agent that is now in charge of scheduling forever. */
const GAME = room('friday/game-night', hm(19, 42), (r) => [
  r.say('mina', phrase('Yes. @vi can you find a time that works for everyone?')),
  r.typing('vi'),
  r.say('vi', phrase('Thursday at 8 works for all four of you. It is on your calendars.'), { id: 'slot', card: { kind: 'meeting', title: phrase('Game night'), when: phrase('Thursday, 8:00 PM') } }),
  r.say('jun', phrase('Vi is now in charge of all scheduling, forever.'), { id: 'forever' }),
  r.typing('vi'),
  r.say('vi', phrase('Accepted. I will be fair.')),
  react('forever', 'laugh', 3),
  step('friday', 3),
])

/** Rooms the day does not pass through, played when a reader opens them. */
const EXTRA: Record<string, Event[]> = {
  'acme/random': room('acme/random', hm(12, 30), (r) => [
    r.say('theo', phrase('Lunch?')),
    r.say('vi', phrase('The noodle place is quiet until 12:45. I booked a table for five.')),
    r.say('theo', phrase('I said lunch, not a plan.'), { id: 'lunch' }),
    react('lunch', 'laugh', 3),
  ]),
  'friday/ideas': room('friday/ideas', hm(20, 5), (r) => [
    r.say('leo', phrase('@mu a song for when the timer rings?')),
    r.typing('mu'),
    r.say('mu', phrase('Eight seconds, upbeat, and it stops when you open the oven.'), { id: 'song', card: { kind: 'file', name: 'timer.mp3', type: 'doc', detail: phrase('0:08') } }),
    react('song', 'heart', 3),
  ]),
  'orbit/general': room('orbit/general', hm(9, 40), (r) => [
    r.say('jun', phrase('First-time contributor here. Where do I start?')),
    r.typing('doc'),
    r.say('doc', phrase('The contributing guide, then any issue marked good first. I linked three that fit a first afternoon.')),
    r.say('priya', phrase('Welcome aboard.'), { id: 'aboard' }),
    react('aboard', 'party', 3),
  ]),
  'orbit/releases': room('orbit/releases', hm(10, 15), (r) => [
    r.say('theo', phrase('Is 2.4 ready to tag?')),
    r.typing('cyber'),
    r.say('cyber', phrase('The dependency audit is clean. Nothing new needs a patch.')),
    r.say('doc', phrase('Changelog is final.'), { id: 'tag', card: { kind: 'file', name: 'CHANGELOG.md', type: 'doc', detail: phrase('2.4') } }),
    react('tag', 'rocket', 5),
  ]),
  'lab/general': room('lab/general', hm(21, 10), (r) => [
    r.say('theo', phrase('What if the app planned the week for you?')),
    r.typing('sci'),
    r.say('sci', phrase('I will try it on our own calendars first and write up what happens.')),
    r.say('priya', phrase('@data how often does a plan survive Tuesday?')),
    r.typing('data'),
    r.say('data', phrase('I can count that once we have a few weeks of plans to look at.'), { id: 'tuesday' }),
    react('tuesday', 'eyes', 2),
  ]),
  'lab/ideas': room('lab/ideas', hm(21, 20), (r) => [r.say('priya', phrase('A plant that texts when it is thirsty.')), r.say('theo', phrase('Filed under someday, next to the bot that waters it.'))]),
}

/** The day, in order. */
const SCENES = [MORNING, ORBIT, PLANS, ENG, SUPPORT, INBOX, FUNDRAISE, DESIGN, HIRING, LAUNCH, GENERAL, SIDE, GAME]
/** What a reader opening a room plays: each room's own scene (the morning's two passes are the day's, not a room's). */
const OWN = [ORBIT, ENG, SUPPORT, INBOX, FUNDRAISE, DESIGN, HIRING, LAUNCH, GENERAL, SIDE, GAME]

/** Words a line holds: how long it takes to read. */
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * How long each event waits from the one before it: long enough to read what
 * came before (a message, and a card under it), to watch someone type, to
 * take in a room just opened.
 */
export function pace(events: Event[]): Beat[] {
  return events.map((e, i) => {
    if (e.wait !== undefined) return { ...e, wait: e.wait }
    const before = events[i - 1]
    if (!before) return { ...e, wait: 1200 }
    let wait = 900
    if (before.kind === 'say') wait = Math.min(5200, 1300 + words(before.text) * 210 + (before.card ? 1600 : 0))
    else if (before.kind === 'reply') wait = Math.min(4400, 1200 + words(before.text) * 200)
    else if (before.kind === 'typing') wait = 1500
    else if (before.kind === 'open') wait = 1700
    else if (before.kind === 'card') wait = 1500
    else if (before.kind === 'huddle') wait = 1600
    else if (before.kind === 'thread') wait = 1100
    else if (before.kind === 'react') wait = 1000
    else if (before.kind === 'step') wait = 1200
    return { ...e, wait }
  })
}

/** The whole day, paced. */
export const DAY: Beat[] = pace(SCENES.flat())

/** Every room's own scene, paced, for a reader who opens it. */
export const SCENE: Record<string, Beat[]> = Object.fromEntries(
  [...OWN, ...Object.values(EXTRA)].map((s) => [(s[0] as Extract<Event, { kind: 'open' }>).room, pace(s)]),
)

/** The room an org opens on when its tile is pressed. */
export const HOME: Record<string, string> = { acme: 'acme/eng', orbit: 'orbit/contributors', friday: 'friday/side-project', lab: 'lab/general' }

/**
 * The frame a reader who asked for less motion sees, and the first paint: the
 * end of #eng — the pull request merged, its thread and its reactions — with
 * the next ticket waiting in #support.
 */
export const STILL = MORNING.length + ORBIT.length + PLANS.length + ENG.length

/** How long the day plays before it starts again, in milliseconds (`REST` held at the end not counted). */
export const LENGTH = DAY.reduce((n, b) => n + b.wait, 0)

/** What the screen shows: the room in view and everything each room holds by then. */
export interface Frame {
  room: string
  rooms: Record<string, Message[]>
  unread: Record<string, number>
  /** Who is typing, and where. */
  typing: { room: string; who: string } | null
  /** The message whose thread stands beside the channel. */
  thread: string | null
  huddle: Record<string, string[]>
  /** The steps of each org's mission done so far. */
  steps: Record<string, number[]>
  /** Work handed from one teammate to another by a mention, newest last. */
  handoffs: Handoff[]
}

/** One teammate handing work to another by mentioning them. */
export interface Handoff {
  from: string
  to: string
  room: string
  time: number
  text: string
}

/** The handoffs a frame keeps: the newest. */
const HANDOFFS = 8

/** How many messages a room keeps on screen: the oldest leave the top. */
const KEEP = 14

/** Folds the first `at` events into a frame. */
export function frame(events: Event[], at: number): Frame {
  const rooms: Record<string, Message[]> = {}
  const where = new Map<string, Message>()
  const seat = (id: string) => {
    if (!rooms[id]) {
      rooms[id] = (SEED[id] ?? []).map((s, i) => ({ id: `${id}#${i}`, who: s.who, text: s.text, time: s.time, reactions: [], replies: [] }))
    }
    return rooms[id]
  }
  const unread: Record<string, number> = { ...UNREAD }
  const huddle: Record<string, string[]> = {}
  const steps: Record<string, number[]> = {}
  const handoffs: Handoff[] = []
  let view = (events.find((e) => e.kind === 'open') as Extract<Event, { kind: 'open' }> | undefined)?.room ?? 'acme/eng'
  let clock = hm(9, 0)
  let thread: string | null = null
  let typing: Frame['typing'] = null
  events.slice(0, at).forEach((e, i) => {
    if (e.kind !== 'typing') typing = null
    switch (e.kind) {
      case 'open':
        view = e.room
        clock = Math.max(clock, e.time)
        unread[e.room] = 0
        thread = null
        seat(e.room)
        break
      case 'say': {
        clock += Math.max(1, Math.round(words(e.text) / 10))
        const m: Message = { id: e.id ?? `${e.room}@${i}`, who: e.who, text: e.text, time: clock, card: e.card, reactions: [], replies: [] }
        seat(e.room).push(m)
        where.set(m.id, m)
        for (const [, to] of e.text.matchAll(/@([a-z]+)/g)) if (to !== e.who && (to in AGENTS || to in PEOPLE)) handoffs.push({ from: e.who, to, room: e.room, time: clock, text: e.text })
        if (e.room !== view) unread[e.room] = (unread[e.room] ?? 0) + 1
        break
      }
      case 'typing':
        typing = { room: e.room, who: e.who }
        break
      case 'react': {
        const m = where.get(e.to)
        if (!m) break
        const r = m.reactions.find((x) => x.mark === e.mark)
        if (r) r.n += e.n
        else m.reactions.push({ mark: e.mark, n: e.n })
        break
      }
      case 'reply': {
        const m = where.get(e.to)
        if (!m) break
        clock += 1
        m.replies.push({ who: e.who, text: e.text, time: clock })
        break
      }
      case 'card': {
        const m = where.get(e.to)
        if (m?.card) m.card = { ...m.card, ...e.patch } as Card
        break
      }
      case 'thread':
        thread = e.to
        break
      case 'huddle':
        huddle[e.room] = e.who
        break
      case 'step':
        steps[e.org] = [...new Set([...(steps[e.org] ?? []), e.n])]
        break
    }
  })
  seat(view)
  for (const id of Object.keys(rooms)) rooms[id] = rooms[id].slice(-KEEP)
  return { room: view, rooms, unread, typing, thread, huddle, steps, handoffs: handoffs.slice(-HANDOFFS) }
}

/** Something an agent left for a person: a reply to send, a question to answer, a pull request to review, or (supervised) a step to approve. */
export interface Ask {
  id: string
  room: string
  /** The person it waits on. */
  who: string
  /** What the agent asked for, as a phrase with `{what}` filled from the card. */
  say: string
  what: string
}

/**
 * What waits on a person in a frame. Always: a draft not yet sent, a question
 * not yet answered, a pull request still under review. Supervised, also every
 * agent's work a person has not answered yet in its room: an agent asks before
 * each tool, connector or site (the app's Manual approval).
 */
export function waiting(f: Frame, supervised: boolean): Ask[] {
  const out: Ask[] = []
  for (const [room, list] of Object.entries(f.rooms)) {
    list.forEach((m, i) => {
      const c = m.card
      if (c?.kind === 'draft' && !c.sent) out.push({ id: m.id, room, who: c.approver ?? 'ada', say: phrase('Send the reply to {what}'), what: c.to })
      else if (c?.kind === 'ask' && c.picked === undefined) out.push({ id: m.id, room, who: c.asks ?? 'ada', say: phrase('Answer: {what}'), what: m.text })
      else if (c?.kind === 'pr' && c.state === 'review') out.push({ id: m.id, room, who: c.reviewer ?? 'theo', say: phrase('Review {what}'), what: `#${c.number}` })
      else if (supervised && c && agent(m.who) && !list.slice(i + 1).some((n) => !agent(n.who))) {
        const owner = orgOf(room).people[0]
        out.push({ id: m.id, room, who: owner, say: phrase('Approve {what}'), what: c.kind === 'file' ? c.name : c.kind === 'meeting' || c.kind === 'list' ? c.title : m.text })
      }
    })
  }
  return out
}

/** Each agent's spending limits, as the agent's settings hold them: a weekly cap and the most one task may spend (sample values). */
export const LIMITS: Record<string, { week: number; task: number }> = {
  dev: { week: 60, task: 8 },
  su: { week: 20, task: 2 },
  opera: { week: 20, task: 2 },
  fin: { week: 30, task: 5 },
  sal: { week: 25, task: 3 },
  des: { week: 40, task: 6 },
  mark: { week: 20, task: 3 },
}
