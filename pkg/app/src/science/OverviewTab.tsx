'use client'

import { useI18n } from '@hanzo/i18n/react'
import { XStack, YStack } from '@hanzo/gui'
import { Button, Text } from '@hanzo/ui'
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  Cpu,
  FlaskConical,
  Lightbulb,
  Server,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import {
  classifyVerdict,
  verdictLabel,
  type ExperimentRecord,
  type LinkedMachine,
  type OpportunityItem,
  type ResearchSummaryData,
  type ScienceTab,
} from './types'

export function OverviewTab({
  summary,
  experiments,
  opportunities,
  machines,
  onNavigateTab,
  onInspectExperiment,
  onLaunchOpportunity,
}: {
  summary: ResearchSummaryData
  experiments: readonly ExperimentRecord[]
  opportunities: readonly OpportunityItem[]
  machines: readonly LinkedMachine[]
  onNavigateTab: (tab: ScienceTab) => void
  onInspectExperiment: (exp: ExperimentRecord) => void
  onLaunchOpportunity: (op: OpportunityItem) => void
}) {
  const { t } = useI18n()

  const qualifiedDiscoveries = experiments.filter((e) => classifyVerdict(e) === 'proven').slice(0, 5)
  const promisingLeads = experiments.filter((e) => classifyVerdict(e) === 'promising_inconclusive').slice(0, 5)
  const refutedFindings = experiments.filter((e) => classifyVerdict(e) === 'refuted').slice(0, 5)
  const topOpportunities = opportunities.filter((o) => o.status === 'open').slice(0, 5)

  const metricCard = (
    slot: string,
    label: string,
    value: string | number,
    sub: string,
    icon: React.ReactNode,
    onClick?: () => void,
  ) => (
    <YStack
      key={slot}
      data-slot={slot}
      render={onClick ? 'button' : undefined}
      onClick={onClick}
      p="$3.5"
      rounded="$4"
      borderWidth={1}
      borderColor="$edge"
      bg="transparent"
      gap="$1.5"
      minW={170}
      flex={1}
      items="flex-start"
      cursor={onClick ? 'pointer' : undefined}
      hoverStyle={onClick ? { bg: '$hover' } : undefined}
    >
      <XStack width="100%" items="center" justify="space-between" gap="$2">
        <Text fontSize="$1" fontWeight="500" color="$quiet">
          {label}
        </Text>
        <XStack opacity={0.75}>{icon}</XStack>
      </XStack>
      <Text fontSize="$6" fontWeight="600" color="$ink" fontFamily="$mono">
        {value}
      </Text>
      <Text fontSize="$1" color="$quiet" numberOfLines={2}>
        {sub}
      </Text>
    </YStack>
  )

  return (
    <YStack data-slot="science-overview" gap="$5">
      {/* Live Metrics Band */}
      <XStack gap="$3" flexWrap="wrap">
        {metricCard(
          'metric-active-runs',
          t('Active runs'),
          summary.activeRuns,
          `${summary.totalRuns} recorded runs · ${summary.totalStudies} studies`,
          <Activity size={14} aria-hidden />,
          () => onNavigateTab('autonomy'),
        )}
        {metricCard(
          'metric-total-experiments',
          t('Total experiments'),
          summary.totalExperiments,
          `${summary.retainedExperiments} retained versions · ${summary.totalBenchmarks} benchmarks`,
          <FlaskConical size={14} aria-hidden />,
          () => onNavigateTab('studies'),
        )}
        {metricCard(
          'metric-qualified-wins',
          t('Qualified wins'),
          summary.qualifiedWins,
          t('verdict = proven (benchmark-qualified)'),
          <Award size={14} aria-hidden />,
          () => onNavigateTab('studies'),
        )}
        {metricCard(
          'metric-promising-leads',
          t('Promising leads'),
          summary.promisingLeads,
          t('Screening / dev lifts · Unqualified (never counted as wins)'),
          <Lightbulb size={14} aria-hidden />,
          () => onNavigateTab('studies'),
        )}
        {metricCard(
          'metric-refutations',
          t('Refutations'),
          summary.refutedCount,
          t("Preserved knowledge · Don't re-chase"),
          <ShieldAlert size={14} aria-hidden />,
          () => onNavigateTab('studies'),
        )}
        {metricCard(
          'metric-compute-fleet',
          t('Compute & GPUs'),
          `$${summary.totalCostUsd.toFixed(2)}`,
          `${summary.onlineMachines}/${machines.length} machines online · ${summary.totalGpus} GPUs · ${summary.totalGpuHours}h`,
          <Cpu size={14} aria-hidden />,
          () => onNavigateTab('machines'),
        )}
      </XStack>

      {/* Quick-Jump Actions */}
      <XStack
        data-slot="science-quick-actions"
        p="$3"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        items="center"
        justify="space-between"
        flexWrap="wrap"
        gap="$2.5"
      >
        <Text fontSize="$2" fontWeight="500" color="$soft">
          {t('Jump into workspace surfaces')}
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          <Button size="sm" variant="outline" data-slot="jump-studies" onPress={() => onNavigateTab('studies')}>
            <BookOpen size={14} aria-hidden />
            {t('Browse Studies & Compare')}
          </Button>
          <Button size="sm" data-slot="jump-autonomy" onPress={() => onNavigateTab('autonomy')}>
            <Sparkles size={14} aria-hidden />
            {t('Pre-register & Launch')}
          </Button>
          <Button size="sm" variant="outline" data-slot="jump-machines" onPress={() => onNavigateTab('machines')}>
            <Server size={14} aria-hidden />
            {t('Dispatch on Machines')}
          </Button>
          <Button size="sm" variant="outline" data-slot="jump-schedules" onPress={() => onNavigateTab('schedules')}>
            <CalendarClock size={14} aria-hidden />
            {t('Autonomous Schedules')}
          </Button>
        </XStack>
      </XStack>

      {/* Discoveries & Promising Leads vs Preserved Refutations */}
      <XStack gap="$4" flexWrap="wrap" items="stretch">
        <YStack
          data-slot="overview-discoveries"
          flex={1}
          minW={300}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          gap="$3"
        >
          <XStack items="center" justify="space-between">
            <YStack gap={2}>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t('Latest Qualified Discoveries & Screening Leads')}
              </Text>
              <Text fontSize="$1" color="$quiet">
                {t('Strictly separates benchmark-qualified wins from unqualified development lifts')}
              </Text>
            </YStack>
            <Button size="sm" variant="ghost" onPress={() => onNavigateTab('studies')}>
              {t('All')}
              <ArrowRight size={13} aria-hidden />
            </Button>
          </XStack>

          {qualifiedDiscoveries.length === 0 && promisingLeads.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {t('No qualified discoveries or screening leads recorded in this org yet.')}
            </Text>
          ) : (
            <YStack gap="$2">
              {[...qualifiedDiscoveries, ...promisingLeads].slice(0, 6).map((exp) => {
                const v = classifyVerdict(exp)
                return (
                  <YStack
                    key={exp.id}
                    render="button"
                    data-slot={`discovery-row-${exp.id}`}
                    data-verdict={v}
                    onClick={() => onInspectExperiment(exp)}
                    p="$3"
                    rounded="$3"
                    borderWidth={1}
                    borderColor="$edge"
                    bg="transparent"
                    gap="$1"
                    items="flex-start"
                    cursor="pointer"
                    hoverStyle={{ bg: '$hover' }}
                  >
                    <XStack width="100%" items="center" justify="space-between" gap="$2">
                      <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                        {exp.id}
                      </Text>
                      <XStack px="$2" py={2} rounded="$2" bg={v === 'proven' ? '$raised' : '$hover'}>
                        <Text fontSize="$1" fontWeight="600" color={v === 'proven' ? '$ink' : '$soft'}>
                          {verdictLabel(v)}
                        </Text>
                      </XStack>
                    </XStack>
                    <Text fontSize="$2" color="$soft" numberOfLines={2}>
                      {String(exp.meta?.conclusion || exp.meta?.hypothesis || `${exp.subject} on ${exp.task}`)}
                    </Text>
                    <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                      {exp.metric}={exp.value} (n={exp.n})
                      {exp.git_sha ? ` · ${exp.git_sha.slice(0, 10)}` : ''}
                    </Text>
                  </YStack>
                )
              })}
            </YStack>
          )}
        </YStack>

        {/* First-class Refutations ("Don't Re-Chase") */}
        <YStack
          data-slot="overview-refutations"
          flex={1}
          minW={300}
          p="$4"
          rounded="$4"
          borderWidth={1}
          borderColor="$edge"
          gap="$3"
        >
          <XStack items="center" justify="space-between">
            <YStack gap={2}>
              <Text fontSize="$3" fontWeight="600" color="$ink">
                {t("Preserved Refutations · Don't Re-Chase")}
              </Text>
              <Text fontSize="$1" color="$quiet">
                {t('Negative findings retained as institutional scientific memory')}
              </Text>
            </YStack>
            <XStack px="$2" py={2} rounded="$2" bg="$hover">
              <Text fontSize="$1" fontWeight="600" color="$quiet" fontFamily="$mono">
                {summary.refutedCount}
              </Text>
            </XStack>
          </XStack>

          {refutedFindings.length === 0 ? (
            <Text fontSize="$2" color="$quiet">
              {t('No refuted hypotheses recorded yet. Failed replications and regressions are preserved here so autonomous loops never re-run dead ends.')}
            </Text>
          ) : (
            <YStack gap="$2">
              {refutedFindings.map((exp) => (
                <YStack
                  key={exp.id}
                  render="button"
                  data-slot={`refuted-row-${exp.id}`}
                  onClick={() => onInspectExperiment(exp)}
                  p="$3"
                  rounded="$3"
                  borderWidth={1}
                  borderColor="$edge"
                  bg="transparent"
                  gap="$1"
                  items="flex-start"
                  cursor="pointer"
                  hoverStyle={{ bg: '$hover' }}
                >
                  <XStack width="100%" items="center" justify="space-between" gap="$2">
                    <Text fontSize="$2" fontWeight="600" color="$ink" numberOfLines={1}>
                      {exp.id}
                    </Text>
                    <XStack px="$2" py={2} rounded="$2" bg="$hover">
                      <Text fontSize="$1" fontWeight="600" color="$quiet">
                        {t("Refuted · Don't re-chase")}
                      </Text>
                    </XStack>
                  </XStack>
                  <Text fontSize="$2" color="$soft" numberOfLines={2}>
                    {String(exp.meta?.failure_diagnosis || exp.meta?.because || exp.meta?.conclusion || 'Negative finding')}
                  </Text>
                  <Text fontSize="$1" color="$quiet" fontFamily="$mono">
                    {exp.subject} · {exp.metric}={exp.value}
                    {exp.git_sha ? ` · ${exp.git_sha.slice(0, 10)}` : ''}
                  </Text>
                </YStack>
              ))}
            </YStack>
          )}
        </YStack>
      </XStack>

      {/* Top Ranked Next Opportunities */}
      <YStack
        data-slot="overview-opportunities"
        p="$4"
        rounded="$4"
        borderWidth={1}
        borderColor="$edge"
        gap="$3"
      >
        <XStack items="center" justify="space-between" flexWrap="wrap" gap="$2">
          <YStack gap={2}>
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Top Ranked Next Opportunities')}
            </Text>
            <Text fontSize="$1" color="$quiet">
              {t('Prioritized by expected improvement per unit compute cost across scaling axes')}
            </Text>
          </YStack>
          <Button size="sm" variant="ghost" onPress={() => onNavigateTab('autonomy')}>
            {t('Open Autonomy Queue')}
            <ArrowRight size={13} aria-hidden />
          </Button>
        </XStack>

        {topOpportunities.length === 0 ? (
          <Text fontSize="$2" color="$quiet">
            {t('No open opportunities queued yet. Pre-register a hypothesis or record an experiment with next_hypothesis to populate the autonomous queue.')}
          </Text>
        ) : (
          <YStack gap="$2">
            {topOpportunities.map((op) => (
              <XStack
                key={op.opportunity_id}
                data-slot={`opportunity-card-${op.opportunity_id}`}
                p="$3"
                rounded="$3"
                borderWidth={1}
                borderColor="$edge"
                items="center"
                justify="space-between"
                flexWrap="wrap"
                gap="$3"
              >
                <YStack flex={1} minW={220} gap="$1">
                  <XStack items="center" gap="$2" flexWrap="wrap">
                    <Text fontSize="$2" fontWeight="600" color="$ink">
                      {op.domain}
                    </Text>
                    <XStack px="$2" py={2} rounded="$2" bg="$hover">
                      <Text fontSize="$1" fontFamily="$mono" color="$soft">
                        {op.axis}
                      </Text>
                    </XStack>
                    <Text fontSize="$1" fontFamily="$mono" color="$quiet">
                      +{Math.round(op.expected_improvement * 100)}% expected · score {op.priority_score.toFixed(2)}
                    </Text>
                  </XStack>
                  <Text fontSize="$2" color="$soft">
                    {op.proposed_approach}
                  </Text>
                </YStack>
                <Button size="sm" variant="outline" onPress={() => onLaunchOpportunity(op)}>
                  {t('Pre-register & Run')}
                </Button>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>
    </YStack>
  )
}
