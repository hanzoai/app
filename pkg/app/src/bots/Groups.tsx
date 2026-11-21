'use client'

// Multi-layer Bot Groups:
// - MakeGroupDialog: create or edit a Bot Group at Layer 1..3, attach a parent group
//   for multi-layer hierarchies, choose member bots, and configure any coordination
//   policy: Lux Quasar (Polaris/Aurora/Pulsar dual-certificate finality), Leader,
//   Majority, Weighted, Unanimous, Kai neurosymbolic, or Custom rubric.
// - GroupThread + GroupPanel: run coordinated tasks across all bots in a group,
//   inspect individual member verdicts/proposals, verify Lux Quasar SHA3-384
//   threshold & checkpoint commitments, and route Slack channels to the group.

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Input, Text, XStack, YStack } from '@hanzo/gui'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Switch,
} from '@hanzo/ui'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  PanelRight,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useAi } from '../lib/ai'
import { plainly, say } from '../failure'
import { called } from '../team'
import { Face } from './face'
import {
  NAME,
  PRIMARY_BOT,
  answering,
  createGroup,
  runGroup,
  setAnswering,
  slackChannels,
  slackStatus,
  toGroupRef,
  updateGroup,
  type BotAgent,
  type BotGroup,
  type GroupDraft,
  type GroupPolicy,
  type GroupRunResult,
  type PolicyKind,
  type QuasarProfile,
  type SlackChannel,
} from './api'
import { policyBadge } from './grid'
import { CARD, CLIP, LABEL, PILL, ROUND, WORD } from './kit'
import { DIM, FLOOR, GROUND, INK, LINE, PICKED, RAISED } from './ink'
import { Confirm } from '../Confirm'

const FIELD = {
  unstyled: true,
  width: '100%',
  px: 14,
  py: 10,
  rounded: 12,
  bg: RAISED,
  borderWidth: 1,
  borderColor: LINE,
  color: INK,
  fontSize: 14,
  placeholderTextColor: '$placeholderColor',
} as const

const POLICY_OPTIONS: ReadonlyArray<{ id: PolicyKind; label: string; summary: string }> = [
  {
    id: 'quasar',
    label: 'Lux Quasar Consensus',
    summary: 'Metastable k-sample α-quorum + β-round finality with SHA3-384 threshold & checkpoint certificates.',
  },
  {
    id: 'leader',
    label: 'Leader Directed',
    summary: 'Designated group leader directs members and synthesizes all subordinate proposals.',
  },
  {
    id: 'majority',
    label: 'Majority Vote',
    summary: 'One-bot-one-vote (>50%) over structured member verdicts; escalates ties to Primary Bot.',
  },
  {
    id: 'weighted',
    label: 'Weighted Stake / Trust',
    summary: 'Each member carries an explicit weight; highest weighted verdict wins.',
  },
  {
    id: 'unanimous',
    label: 'Unanimous Quorum',
    summary: 'Requires 100% agreement across all active bots in the group.',
  },
  {
    id: 'kai',
    label: 'Kai Confidence Synthesis',
    summary: 'Filters proposals by calibrated confidence floor and synthesizes high-certainty reasoning.',
  },
  {
    id: 'custom',
    label: 'Custom Policy Rubric',
    summary: 'Evaluates member proposals against a custom governance or constitutional prompt.',
  },
]

const QUASAR_PROFILES: ReadonlyArray<{ id: QuasarProfile; label: string; detail: string; k: number; alpha: number; beta: number }> = [
  { id: 'polaris', label: 'Polaris', detail: 'k=3 · α=0.67 · β=1 (Low latency)', k: 3, alpha: 0.67, beta: 1 },
  { id: 'aurora', label: 'Aurora', detail: 'k=5 · α=0.67 · β=2 (Balanced BFT)', k: 5, alpha: 0.67, beta: 2 },
  { id: 'pulsar', label: 'Pulsar', detail: 'k=7 · α=0.75 · β=3 (High assurance)', k: 7, alpha: 0.75, beta: 3 },
]

export function MakeGroupDialog({
  bots,
  groups,
  initial,
  onDone,
  onCancel,
}: {
  bots: readonly BotAgent[]
  groups: readonly BotGroup[]
  initial?: BotGroup | null
  onDone: (g: BotGroup) => void | Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const { client } = useAi()

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [layer, setLayer] = useState<number>(initial?.layer ?? 1)
  const [parentGroupId, setParentGroupId] = useState<string>(initial?.parentGroupId ?? '')
  const [members, setMembers] = useState<string[]>(() => {
    if (initial?.members?.length) return [...initial.members]
    const workers = bots.filter((b) => !b.isPrimary && b.name.toLowerCase() !== PRIMARY_BOT).slice(0, 3)
    return workers.map((b) => b.name)
  })
  const [kind, setKind] = useState<PolicyKind>(initial?.policy?.kind ?? 'quasar')
  const [leader, setLeader] = useState<string>(initial?.policy?.leader ?? '')
  const [quasarProfile, setQuasarProfile] = useState<QuasarProfile>(initial?.policy?.quasarProfile ?? 'aurora')
  const [escalateToPrimary, setEscalateToPrimary] = useState<boolean>(initial?.policy?.escalateToPrimary ?? true)
  const [minConfidence, setMinConfidence] = useState<string>(String(initial?.policy?.minConfidence ?? 0.65))
  const [customPrompt, setCustomPrompt] = useState<string>(initial?.policy?.customPrompt ?? '')
  const [weights, setWeights] = useState<Record<string, number>>(initial?.policy?.weights ?? {})
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<string | null>(null)

  const named = NAME.test(name.trim())
  const ok = named && members.length > 0 && !busy

  const toggleMember = (botName: string) => {
    setMembers((prev) => (prev.includes(botName) ? prev.filter((m) => m !== botName) : [...prev, botName]))
  }

  const parentChoices = useMemo(
    () => groups.filter((g) => g.id !== initial?.id && g.name !== initial?.name && (g.layer || 1) < layer),
    [groups, initial, layer],
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!client || !ok) return
    setBusy(true)
    setWrong(null)
    try {
      const prof = QUASAR_PROFILES.find((p) => p.id === quasarProfile) ?? QUASAR_PROFILES[1]
      const policy: GroupPolicy = {
        kind,
        escalateToPrimary,
      }
      if (kind === 'leader') {
        policy.leader = leader || members[0]
      } else if (kind === 'quasar') {
        policy.quasarProfile = quasarProfile
        policy.sampleK = prof.k
        policy.alpha = prof.alpha
        policy.beta = prof.beta
      } else if (kind === 'weighted') {
        const w: Record<string, number> = {}
        for (const m of members) w[m] = Math.max(1, Number(weights[m] ?? 1))
        policy.weights = w
      } else if (kind === 'kai') {
        const conf = Number(minConfidence)
        policy.minConfidence = Number.isFinite(conf) && conf > 0 && conf <= 1 ? conf : 0.65
      } else if (kind === 'custom') {
        policy.customPrompt = customPrompt.trim() || 'Synthesize the strongest verified proposal and highlight risks.'
      }

      const payload: GroupDraft = {
        name: name.trim(),
        description: description.trim(),
        layer,
        parentGroupId: parentGroupId || undefined,
        members,
        policy,
      }

      const saved = initial ? await updateGroup(client, initial.name, payload) : await createGroup(client, payload)
      await onDone(saved)
    } catch (err) {
      setWrong(plainly(err, t('this bot group'), t))
    } finally {
      setBusy(false)
    }
  }

  const activePolicy = POLICY_OPTIONS.find((p) => p.id === kind) ?? POLICY_OPTIONS[0]

  return (
    <Dialog open onOpenChange={(v) => (v ? undefined : onCancel())}>
      <DialogContent
        data-parity-key="bots.group.make"
        width="calc(100vw - 32px)"
        maxW={540}
        bg="var(--popover)"
        rounded={20}
        p={20}
        gap={14}
        borderWidth={1}
        borderColor={LINE}
      >
        <DialogTitle fontSize={18} lineHeight={24} fontWeight="600" color="$ink">
          {initial ? t('Edit Bot Group') : t('New Bot Group')}
        </DialogTitle>

        <YStack render="form" {...{ onSubmit: submit }} gap={12} maxH="76vh" overflowY="auto" pr={2}>
          <Input
            {...FIELD}
            autoFocus
            disabled={Boolean(initial)}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Group name (e.g. core-eng, security-quorum)')}
            aria-label={t('Group name')}
          />
          {name.trim() && !named ? (
            <Text fontSize={12} lineHeight={17} color={DIM} px={4}>
              {t('Letters, digits, dot, dash and underscore; starts with a letter or digit.')}
            </Text>
          ) : null}

          <Input
            {...FIELD}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('Mission — what this layer of bots coordinates on')}
            aria-label={t('Group description')}
          />

          <XStack gap={8} items="center" flexWrap="wrap">
            <Text fontSize={13} lineHeight={18} color={DIM} px={2}>
              {t('Coordination Layer:')}
            </Text>
            {[1, 2, 3].map((lv) => {
              const active = layer === lv
              return (
                <XStack
                  key={lv}
                  render="button"
                  {...{ type: 'button' }}
                  onClick={() => {
                    setLayer(lv)
                    if (lv === 1) setParentGroupId('')
                  }}
                  height={30}
                  px={12}
                  rounded={999}
                  items="center"
                  bg={active ? INK : RAISED}
                  borderWidth={1}
                  borderColor={active ? INK : LINE}
                  cursor="pointer"
                >
                  <Text fontSize={12} lineHeight={16} fontWeight="500" color={active ? 'var(--background)' : INK}>
                    {lv === 1 ? t('Layer 1 · Under Primary') : lv === 2 ? t('Layer 2 · Sub-group') : t('Layer 3 · Execution')}
                  </Text>
                </XStack>
              )
            })}
          </XStack>

          {layer > 1 && parentChoices.length > 0 ? (
            <XStack items="center" justify="space-between" px={12} py={9} rounded={12} bg={RAISED} borderWidth={1} borderColor={LINE}>
              <Text fontSize={13} lineHeight={18} color={DIM}>
                {t('Reports to upper-layer group')}
              </Text>
              <DropdownMenu placement="bottom-end" offset={6}>
                <DropdownMenuTrigger asChild>
                  <XStack render="button" {...{ type: 'button' }} items="center" gap={5} bg="transparent" borderWidth={0} cursor="pointer">
                    <Text fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                      {parentChoices.find((g) => g.id === parentGroupId || g.name === parentGroupId)?.name || t('Primary Bot (hanzo)')}
                    </Text>
                    <ChevronDown size={14} color={DIM} aria-hidden />
                  </XStack>
                </DropdownMenuTrigger>
                <DropdownMenuContent minW={200}>
                  <DropdownMenuItem onSelect={() => setParentGroupId('')}>
                    <Text fontSize="$3" color="$ink">
                      {t('Primary Bot (hanzo · Layer 0)')}
                    </Text>
                  </DropdownMenuItem>
                  {parentChoices.map((pg) => (
                    <DropdownMenuItem key={pg.id} onSelect={() => setParentGroupId(pg.id)}>
                      <Text fontSize="$3" color="$ink">
                        {`${pg.name} (Layer ${pg.layer})`}
                      </Text>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </XStack>
          ) : null}

          <YStack gap={8} p={12} rounded={14} bg={RAISED} borderWidth={1} borderColor={LINE}>
            <XStack items="center" justify="space-between">
              <Text fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                {t('Consensus / Leadership Policy')}
              </Text>
              <DropdownMenu placement="bottom-end" offset={6}>
                <DropdownMenuTrigger asChild>
                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    height={30}
                    px={11}
                    rounded={999}
                    items="center"
                    gap={6}
                    bg={PICKED}
                    borderWidth={1}
                    borderColor={LINE}
                    cursor="pointer"
                  >
                    <Text fontSize={12} lineHeight={16} fontWeight="600" color={INK}>
                      {activePolicy.label}
                    </Text>
                    <ChevronDown size={13} color={DIM} aria-hidden />
                  </XStack>
                </DropdownMenuTrigger>
                <DropdownMenuContent minW={250}>
                  {POLICY_OPTIONS.map((opt) => (
                    <DropdownMenuItem key={opt.id} onSelect={() => setKind(opt.id)}>
                      <YStack gap={2}>
                        <Text fontSize="$3" fontWeight={opt.id === kind ? '600' : '400'} color="$ink">
                          {opt.label}
                        </Text>
                      </YStack>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </XStack>

            <Text fontSize={12} lineHeight={17} color={DIM}>
              {activePolicy.summary}
            </Text>

            {kind === 'quasar' ? (
              <YStack gap={8} pt={4}>
                <XStack gap={6} flexWrap="wrap">
                  {QUASAR_PROFILES.map((p) => {
                    const active = quasarProfile === p.id
                    return (
                      <XStack
                        key={p.id}
                        render="button"
                        {...{ type: 'button' }}
                        onClick={() => setQuasarProfile(p.id)}
                        height={28}
                        px={11}
                        rounded={999}
                        items="center"
                        gap={5}
                        bg={active ? INK : GROUND}
                        borderWidth={1}
                        borderColor={active ? INK : LINE}
                        cursor="pointer"
                      >
                        <Text fontSize={12} lineHeight={16} fontWeight="500" color={active ? 'var(--background)' : INK}>
                          {p.label}
                        </Text>
                      </XStack>
                    )
                  })}
                </XStack>
                <Text fontSize={11} lineHeight={16} color={DIM}>
                  {QUASAR_PROFILES.find((p) => p.id === quasarProfile)?.detail}
                </Text>
              </YStack>
            ) : null}

            {kind === 'leader' && members.length > 0 ? (
              <XStack items="center" justify="space-between" pt={4}>
                <Text fontSize={12} lineHeight={17} color={DIM}>
                  {t('Group Leader Bot')}
                </Text>
                <DropdownMenu placement="bottom-end" offset={6}>
                  <DropdownMenuTrigger asChild>
                    <XStack
                      render="button"
                      {...{ type: 'button' }}
                      height={28}
                      px={10}
                      rounded={999}
                      items="center"
                      gap={5}
                      bg={GROUND}
                      borderWidth={1}
                      borderColor={LINE}
                      cursor="pointer"
                    >
                      <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
                        {called(leader || members[0])}
                      </Text>
                      <ChevronDown size={13} color={DIM} aria-hidden />
                    </XStack>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent minW={180}>
                    {members.map((m) => (
                      <DropdownMenuItem key={m} onSelect={() => setLeader(m)}>
                        <Text fontSize="$3" color="$ink">
                          {called(m)}
                        </Text>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </XStack>
            ) : null}

            {kind === 'weighted' && members.length > 0 ? (
              <YStack gap={6} pt={4}>
                {members.map((m) => (
                  <XStack key={m} items="center" justify="space-between">
                    <Text fontSize={12} lineHeight={16} color={INK}>
                      {called(m)}
                    </Text>
                    <Input
                      unstyled
                      width={64}
                      height={28}
                      px={8}
                      rounded={8}
                      bg={GROUND}
                      borderWidth={1}
                      borderColor={LINE}
                      color={INK}
                      fontSize={12}
                      inputMode="numeric"
                      value={String(weights[m] ?? 1)}
                      onChange={(e) =>
                        setWeights((prev) => ({ ...prev, [m]: Math.max(1, Number(e.target.value.replace(/[^\d]/g, '')) || 1) }))
                      }
                    />
                  </XStack>
                ))}
              </YStack>
            ) : null}

            {kind === 'kai' ? (
              <XStack items="center" justify="space-between" pt={4}>
                <Text fontSize={12} lineHeight={17} color={DIM}>
                  {t('Minimum confidence floor (0.1 – 1.0)')}
                </Text>
                <Input
                  unstyled
                  width={72}
                  height={28}
                  px={8}
                  rounded={8}
                  bg={GROUND}
                  borderWidth={1}
                  borderColor={LINE}
                  color={INK}
                  fontSize={12}
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(e.target.value)}
                />
              </XStack>
            ) : null}

            {kind === 'custom' ? (
              <Input
                {...FIELD}
                render="textarea"
                rows={3}
                bg={GROUND}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={t('Describe how competing bot proposals should be judged and combined…')}
              />
            ) : null}

            <XStack items="center" justify="space-between" pt={4}>
              <Text fontSize={12} lineHeight={17} color={DIM}>
                {t('Escalate split quorum to Primary Bot (hanzo)')}
              </Text>
              <Switch checked={escalateToPrimary} onCheckedChange={setEscalateToPrimary} />
            </XStack>
          </YStack>

          <YStack gap={8}>
            <XStack items="center" justify="space-between" px={4}>
              <Text fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                {t('Member Bots ({n})', { n: members.length })}
              </Text>
              {bots.length > 0 ? (
                <XStack
                  render="button"
                  {...{ type: 'button' }}
                  onClick={() => setMembers(bots.map((b) => b.name))}
                  bg="transparent"
                  borderWidth={0}
                  cursor="pointer"
                >
                  <Text fontSize={12} lineHeight={16} color={DIM}>
                    {t('Select all')}
                  </Text>
                </XStack>
              ) : null}
            </XStack>
            <XStack flexWrap="wrap" gap={6}>
              {bots.map((b) => {
                const picked = members.includes(b.name)
                return (
                  <XStack
                    key={b.name}
                    render="button"
                    {...{ type: 'button', 'aria-pressed': picked }}
                    onClick={() => toggleMember(b.name)}
                    height={32}
                    pl={6}
                    pr={11}
                    rounded={999}
                    items="center"
                    gap={6}
                    bg={picked ? PICKED : RAISED}
                    borderWidth={1}
                    borderColor={picked ? INK : LINE}
                    cursor="pointer"
                  >
                    <Face bot={b} size={20} />
                    <Text fontSize={12} lineHeight={16} fontWeight={picked ? '500' : '400'} color={INK}>
                      {called(b.name)}
                    </Text>
                    {picked ? <Check size={12} color={INK} aria-hidden /> : null}
                  </XStack>
                )
              })}
            </XStack>
          </YStack>

          {wrong ? (
            <Text role="alert" fontSize={13} lineHeight={18} color={DIM} px={4}>
              {wrong}
            </Text>
          ) : null}

          <XStack justify="flex-end" gap={8} pt={4}>
            <XStack {...PILL} onClick={onCancel}>
              <Text {...WORD}>{t('Cancel')}</Text>
            </XStack>
            <XStack
              {...PILL}
              {...{ type: 'submit' }}
              disabled={!ok}
              opacity={ok ? 1 : 0.5}
              bg={INK}
              borderColor={INK}
              hoverStyle={{ bg: INK, opacity: 0.9 }}
            >
              <Text {...WORD} color="var(--background)">
                {busy ? t('Saving…') : initial ? t('Save group') : t('Create group')}
              </Text>
            </XStack>
          </XStack>
        </YStack>
      </DialogContent>
    </Dialog>
  )
}

interface GroupTurn {
  id: string
  input: string
  at: number
  result?: GroupRunResult
  error?: string
}

export function GroupThread({
  group,
  bots,
  side,
  onSide,
  onBack,
  onEdit,
  onPickBot,
}: {
  group: BotGroup
  bots: readonly BotAgent[]
  side: boolean
  onSide: () => void
  onBack: () => void
  onEdit: () => void
  onPickBot: (name: string) => void
}) {
  const { t } = useI18n()
  const { client } = useAi()
  const [turns, setTurns] = useState<GroupTurn[]>([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const prompt = input.trim()
    if (!client || !prompt || running) return
    const id = `gt_${Date.now()}`
    setInput('')
    setRunning(true)
    setTurns((prev) => [...prev, { id, input: prompt, at: Date.now() }])
    try {
      const res = await runGroup(client, group.name, prompt)
      setTurns((prev) => prev.map((row) => (row.id === id ? { ...row, result: res } : row)))
    } catch (err) {
      setTurns((prev) => prev.map((row) => (row.id === id ? { ...row, error: say(err, group.name, 'save', t) } : row)))
    } finally {
      setRunning(false)
    }
  }

  return (
    <YStack flex={1} minH={0} height="100%" bg={GROUND}>
      <XStack
        data-parity-key="bots.bar"
        height={54}
        px={14}
        items="center"
        justify="space-between"
        gap={10}
        borderBottomWidth={1}
        borderColor={LINE}
      >
        <XStack items="center" gap={8} minW={0}>
          <XStack
            {...ROUND}
            display="none"
            $max-md={{ display: 'flex' }}
            aria-label={t('Back to roster')}
            onClick={onBack}
          >
            <ArrowLeft size={16} color={INK} aria-hidden />
          </XStack>

          <XStack {...PILL} data-parity-key="bots.pill" onClick={onEdit}>
            <Users size={15} color={INK} aria-hidden />
            <Text {...WORD}>{group.name}</Text>
            <Text fontSize={12} lineHeight={16} color={DIM}>
              {`Layer ${group.layer || 1} · ${policyBadge(group.policy)}`}
            </Text>
          </XStack>
        </XStack>

        <XStack items="center" gap={8}>
          <XStack
            {...ROUND}
            aria-label={t('Toggle group inspector')}
            aria-pressed={side}
            onClick={onSide}
          >
            <PanelRight size={16} color={INK} aria-hidden />
          </XStack>
        </XStack>
      </XStack>

      <YStack data-parity-key="bots.thread" flex={1} minH={0} overflowY="auto" px={20} py={20} gap={18}>
        {turns.length === 0 ? (
          <YStack flex={1} items="center" justify="center" gap={14} py={48} maxW={520} self="center">
            <YStack
              width={56}
              height={56}
              rounded={16}
              bg={RAISED}
              borderWidth={1}
              borderColor={LINE}
              items="center"
              justify="center"
            >
              <Layers size={24} color={INK} aria-hidden />
            </YStack>
            <Text fontSize={18} lineHeight={24} fontWeight="600" color={INK} text="center">
              {`${group.name} · ${policyBadge(group.policy)}`}
            </Text>
            <Text fontSize={13} lineHeight={19} color={DIM} text="center">
              {group.description ||
                t(
                  'Layer {layer} Bot Group with {n} bots. Send a directive below — every sampled bot proposes in parallel and resolves under {policy} (or Primary Bot hanzo can invoke group_{slug} automatically).',
                  {
                    layer: group.layer || 1,
                    n: group.members.length,
                    policy: policyBadge(group.policy),
                    slug: group.name,
                  },
                )}
            </Text>
            <XStack flexWrap="wrap" justify="center" gap={6}>
              {group.members.map((m) => {
                const b = bots.find((x) => x.name === m) ?? { name: m }
                return (
                  <XStack
                    key={m}
                    render="button"
                    {...{ type: 'button' }}
                    onClick={() => onPickBot(m)}
                    height={30}
                    pl={6}
                    pr={10}
                    rounded={999}
                    items="center"
                    gap={6}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor={LINE}
                    cursor="pointer"
                    hoverStyle={{ bg: PICKED }}
                  >
                    <Face bot={b} size={20} />
                    <Text fontSize={12} lineHeight={16} color={INK}>
                      {called(m)}
                    </Text>
                  </XStack>
                )
              })}
            </XStack>
          </YStack>
        ) : null}

        {turns.map((turn) => {
          const res = turn.result
          const quasar = res?.quasar
          const showProps = Boolean(expanded[turn.id])
          return (
            <YStack key={turn.id} gap={12} maxW={760} width="100%" self="center">
              <XStack justify="flex-end">
                <YStack
                  data-parity-key="bots.mine"
                  maxW="82%"
                  px={15}
                  py={10}
                  rounded={18}
                  bg={PICKED}
                  borderWidth={1}
                  borderColor={LINE}
                >
                  <Text fontSize={14} lineHeight={20} color={INK}>
                    {turn.input}
                  </Text>
                </YStack>
              </XStack>

              {!res && !turn.error ? (
                <XStack items="center" gap={8} px={4}>
                  <Sparkles size={14} color={DIM} aria-hidden />
                  <Text fontSize={13} lineHeight={18} color={DIM}>
                    {t('Running {n} bots across Layer {layer} ({policy})…', {
                      n: group.members.length,
                      layer: group.layer || 1,
                      policy: policyBadge(group.policy),
                    })}
                  </Text>
                </XStack>
              ) : null}

              {turn.error ? (
                <YStack px={14} py={11} rounded={14} bg={RAISED} borderWidth={1} borderColor={LINE}>
                  <Text fontSize={13} lineHeight={19} color={DIM}>
                    {turn.error}
                  </Text>
                </YStack>
              ) : null}

              {res ? (
                <YStack gap={10}>
                  {quasar ? (
                    <YStack px={13} py={10} rounded={12} bg={RAISED} borderWidth={1} borderColor={LINE} gap={5}>
                      <XStack items="center" justify="space-between" flexWrap="wrap" gap={8}>
                        <XStack items="center" gap={6}>
                          <ShieldCheck size={14} color={INK} aria-hidden />
                          <Text fontSize={12} lineHeight={16} fontWeight="600" color={INK}>
                            {quasar.finalized
                              ? t('Lux Quasar Finalized · {profile}', { profile: quasar.profile.toUpperCase() })
                              : t('Lux Quasar Escalated to Primary ({to})', { to: res.escalatedTo || PRIMARY_BOT })}
                          </Text>
                        </XStack>
                        <Text fontSize={11} lineHeight={15} color={DIM}>
                          {`Support ${Math.round((quasar.support || 0) * 100)}% · Rounds ${quasar.rounds}/${quasar.beta} · k=${quasar.sampleK}`}
                        </Text>
                      </XStack>
                      <Text {...CLIP} fontSize={11} lineHeight={15} color={DIM}>
                        {`SHA3-384 Cert: ${quasar.checkpointDigest.slice(0, 24)}… · Threshold: ${quasar.thresholdCommitment.slice(0, 20)}…`}
                      </Text>
                    </YStack>
                  ) : null}

                  <YStack
                    data-parity-key="bots.theirs"
                    px={16}
                    py={13}
                    rounded={16}
                    bg={RAISED}
                    borderWidth={1}
                    borderColor={LINE}
                    gap={8}
                  >
                    <Text fontSize={14} lineHeight={21} color={INK} whiteSpace="pre-wrap">
                      {res.output}
                    </Text>

                    {res.proposals?.length ? (
                      <YStack pt={6} borderTopWidth={1} borderColor={LINE} gap={8}>
                        <XStack
                          render="button"
                          {...{ type: 'button' }}
                          onClick={() => setExpanded((prev) => ({ ...prev, [turn.id]: !showProps }))}
                          items="center"
                          gap={5}
                          bg="transparent"
                          borderWidth={0}
                          p={0}
                          cursor="pointer"
                        >
                          <ChevronRight size={13} color={DIM} aria-hidden />
                          <Text fontSize={12} lineHeight={16} color={DIM}>
                            {showProps
                              ? t('Hide {n} bot proposals', { n: res.proposals.length })
                              : res.durationMs
                                ? t('Inspect {n} bot proposals & verdicts ({ms}ms)', {
                                    n: res.proposals.length,
                                    ms: res.durationMs,
                                  })
                                : t('Inspect {n} bot proposals & verdicts', { n: res.proposals.length })}
                          </Text>
                        </XStack>

                        {showProps ? (
                          <YStack gap={6}>
                            {res.proposals.map((p) => (
                              <YStack key={p.agent} p={10} rounded={10} bg={GROUND} borderWidth={1} borderColor={LINE} gap={4}>
                                <XStack items="center" justify="space-between">
                                  <Text fontSize={12} lineHeight={16} fontWeight="600" color={INK}>
                                    {`${called(p.agent)} (Layer ${p.layer})`}
                                  </Text>
                                  <Text fontSize={11} lineHeight={15} color={DIM}>
                                    {`Verdict: ${p.verdict || 'propose'} · Conf ${Math.round((p.confidence || 0) * 100)}%`}
                                  </Text>
                                </XStack>
                                <Text fontSize={12} lineHeight={17} color={DIM} whiteSpace="pre-wrap">
                                  {p.output || p.error || ''}
                                </Text>
                              </YStack>
                            ))}
                          </YStack>
                        ) : null}
                      </YStack>
                    ) : null}
                  </YStack>
                </YStack>
              ) : null}
            </YStack>
          )
        })}
      </YStack>

      <YStack data-parity-key="bots.composer" px={16} pb={16} pt={8} borderTopWidth={1} borderColor={LINE}>
        <XStack
          render="form"
          {...{ onSubmit: (e: FormEvent) => void send(e) }}
          maxW={760}
          width="100%"
          self="center"
          gap={8}
          items="center"
        >
          <Input
            unstyled
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('Direct {group} ({policy})…', { group: group.name, policy: policyBadge(group.policy) })}
            aria-label={t('Message {group}', { group: group.name })}
            flex={1}
            height={42}
            px={16}
            rounded={999}
            bg={RAISED}
            borderWidth={1}
            borderColor={LINE}
            color={INK}
            fontSize={14}
            placeholderTextColor="$placeholderColor"
          />
          <XStack
            {...PILL}
            {...{ type: 'submit' }}
            height={42}
            px={16}
            bg={INK}
            borderColor={INK}
            disabled={!input.trim() || running}
            opacity={!input.trim() || running ? 0.45 : 1}
          >
            <Send size={14} color="var(--background)" aria-hidden />
            <Text {...WORD} color="var(--background)">
              {running ? t('Coordinating…') : t('Run Group')}
            </Text>
          </XStack>
        </XStack>
      </YStack>
    </YStack>
  )
}

export function GroupPanel({
  group,
  groups,
  bots,
  onClose,
  onEdit,
  onDelete,
  onPickBot,
}: {
  group: BotGroup
  groups: readonly BotGroup[]
  bots: readonly BotAgent[]
  onClose: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onPickBot: (name: string) => void
}) {
  const { t } = useI18n()
  const { client } = useAi()
  const [deleting, setDeleting] = useState(false)
  const [slackOk, setSlackOk] = useState(false)
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [boundChannels, setBoundChannels] = useState<string[]>([])

  const groupRef = toGroupRef(group.name)
  const parentGroup = groups.find((g) => g.id === group.parentGroupId || g.name === group.parentGroupId)
  const childGroups = groups.filter((g) => g.parentGroupId === group.id || g.parentGroupId === group.name)

  useEffect(() => {
    const stop = new AbortController()
    void (async () => {
      const st = await slackStatus(stop.signal)
      if (stop.signal.aborted) return
      setSlackOk(st.connected)
      if (st.connected && client) {
        const [chs, ans] = await Promise.all([slackChannels(stop.signal), answering(client, 'slack', stop.signal).catch(() => null)])
        if (stop.signal.aborted) return
        setChannels(chs)
        if (ans?.channels) {
          setBoundChannels(
            Object.entries(ans.channels)
              .filter(([, ag]) => ag === groupRef || ag === `group_${group.name}`)
              .map(([cid]) => cid),
          )
        }
      }
    })()
    return () => stop.abort()
  }, [client, group.name, groupRef])

  const bindChannel = async (channelId: string) => {
    if (!client) return
    const already = boundChannels.includes(channelId)
    const updated = await setAnswering(
      client,
      already ? { transport: 'slack', unbind: [channelId] } : { transport: 'slack', channels: { [channelId]: groupRef } },
    ).catch(() => null)
    if (updated?.channels) {
      setBoundChannels(
        Object.entries(updated.channels)
          .filter(([, ag]) => ag === groupRef || ag === `group_${group.name}`)
          .map(([cid]) => cid),
      )
    }
  }

  return (
    <YStack flex={1} minH={0} overflowY="auto" overflowX="hidden" render="aside" aria-label={group.name}>
      <XStack height={46} shrink={0} px={12} items="center" justify="flex-end">
        <XStack {...ROUND} aria-label={t('Close')} onClick={onClose}>
          <X size={16} color={INK} aria-hidden />
        </XStack>
      </XStack>

      <YStack items="center" gap={8} pt={2} pb={18} px={14}>
        <YStack
          width={64}
          height={64}
          rounded={20}
          bg={RAISED}
          borderWidth={1}
          borderColor={LINE}
          items="center"
          justify="center"
        >
          <Users size={26} color={INK} aria-hidden />
        </YStack>
        <Text {...CLIP} maxW="100%" fontSize={18} lineHeight={23} fontWeight="600" color={INK}>
          {group.name}
        </Text>
        <Text fontSize={12} lineHeight={16} color={DIM}>
          {`Layer ${group.layer || 1} · ${policyBadge(group.policy)}`}
        </Text>
        <XStack {...PILL} height={32} px={13} onClick={onEdit}>
          <Text fontSize={12} lineHeight={16} fontWeight="500" color={INK}>
            {t('Configure Policy & Members')}
          </Text>
        </XStack>
      </YStack>

      <YStack px={15} pb={24} gap={18}>
        <YStack gap={8}>
          <Text {...LABEL} px={4}>
            {t('Layer Hierarchy')}
          </Text>
          <YStack {...CARD} p={12} gap={6}>
            <Text fontSize={13} lineHeight={18} color={INK}>
              {parentGroup
                ? t('Directed by Group: {parent} (Layer {lv})', { parent: parentGroup.name, lv: parentGroup.layer })
                : t('Directed by Primary Bot: hanzo (Layer 0)')}
            </Text>
            <Text fontSize={12} lineHeight={17} color={DIM}>
              {t('Callable as tool group_{name} by upper-layer bots.', { name: group.name })}
            </Text>
            {childGroups.length > 0 ? (
              <Text fontSize={12} lineHeight={17} color={DIM}>
                {t('Directs sub-groups: {list}', { list: childGroups.map((c) => c.name).join(', ') })}
              </Text>
            ) : null}
          </YStack>
        </YStack>

        <YStack gap={8}>
          <Text {...LABEL} px={4}>
            {t('Members ({n})', { n: group.members.length })}
          </Text>
          <YStack {...CARD}>
            {group.members.map((m, idx) => {
              const b = bots.find((x) => x.name === m) ?? { name: m }
              const isLeader = group.policy?.kind === 'leader' && (group.policy.leader || group.members[0]) === m
              return (
                <XStack
                  key={m}
                  render="button"
                  {...{ type: 'button' }}
                  onClick={() => onPickBot(m)}
                  minH={48}
                  px={12}
                  gap={10}
                  items="center"
                  bg="transparent"
                  borderWidth={0}
                  borderBottomWidth={idx === group.members.length - 1 ? 0 : 1}
                  borderColor={LINE}
                  cursor="pointer"
                  hoverStyle={{ bg: PICKED }}
                >
                  <Face bot={b} size={28} />
                  <YStack flex={1} minW={0} items="flex-start">
                    <Text {...CLIP} fontSize={13} lineHeight={18} fontWeight="500" color={INK}>
                      {called(m)}
                    </Text>
                    {isLeader ? (
                      <Text fontSize={11} lineHeight={15} color={DIM}>
                        {t('Group Leader')}
                      </Text>
                    ) : null}
                  </YStack>
                  <ChevronRight size={14} color={DIM} aria-hidden />
                </XStack>
              )
            })}
          </YStack>
        </YStack>

        {slackOk && channels.length > 0 ? (
          <YStack gap={8}>
            <Text {...LABEL} px={4}>
              {t('Slack Channel Routing')}
            </Text>
            <YStack {...CARD} p={12} gap={8}>
              <Text fontSize={12} lineHeight={17} color={DIM}>
                {t('Route specific Slack channels directly to this Bot Group:')}
              </Text>
              <XStack flexWrap="wrap" gap={6}>
                {channels.slice(0, 12).map((ch) => {
                  const active = boundChannels.includes(ch.id)
                  return (
                    <XStack
                      key={ch.id}
                      render="button"
                      {...{ type: 'button' }}
                      onClick={() => void bindChannel(ch.id)}
                      height={26}
                      px={9}
                      rounded={999}
                      items="center"
                      gap={4}
                      bg={active ? INK : GROUND}
                      borderWidth={1}
                      borderColor={active ? INK : LINE}
                      cursor="pointer"
                    >
                      <Text fontSize={11} lineHeight={15} color={active ? 'var(--background)' : INK}>
                        {`#${ch.name}`}
                      </Text>
                    </XStack>
                  )
                })}
              </XStack>
            </YStack>
          </YStack>
        ) : null}

        <XStack px={8} pt={4}>
          <Text
            render="button"
            {...{ type: 'button' }}
            onClick={() => setDeleting(true)}
            bg="transparent"
            borderWidth={0}
            p={0}
            cursor="pointer"
            fontSize={13}
            lineHeight={18}
            color={DIM}
            hoverStyle={{ color: INK }}
          >
            {t('Delete group {name}', { name: group.name })}
          </Text>
        </XStack>
      </YStack>

      <Confirm
        open={deleting}
        danger
        title={t('Delete group {name}?', { name: group.name })}
        body={t('Member bots are kept intact; only the {name} coordination group is removed.', { name: group.name })}
        yes={t('Delete')}
        onYes={() => void onDelete()}
        onOpenChange={setDeleting}
      />
    </YStack>
  )
}
