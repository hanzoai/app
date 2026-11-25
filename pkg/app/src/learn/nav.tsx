'use client'

import type { RailLink } from '@hanzo/ui/chat'
import {
  Atom,
  BookOpen,
  Compass,
  Cpu,
  GraduationCap,
  Rocket,
  Sparkles,
} from 'lucide-react'
import { learnPath, type LearnRouteState } from './types'

const NEW_ID = 'new'

export function learnNav(
  route: LearnRouteState,
  move: (to: string) => void,
  t: (k: string) => string = (k) => k,
): { id: string; label: string; links: RailLink[] }[] {
  return [
    {
      id: 'learn',
      label: '',
      links: [
        {
          id: NEW_ID,
          label: t('Choose your adventure'),
          active: false,
          icon: <Compass size={16} aria-hidden />,
          onPress: () => move(learnPath(null, { view: 'adventure' })),
        },
        {
          id: 'launchpad',
          label: t('Launchpad'),
          active: !route.slug && route.section === 'launchpad',
          icon: <GraduationCap size={16} aria-hidden />,
          onPress: () => move(learnPath()),
        },
        {
          id: 'adventure',
          label: t('Adventure Wizard'),
          active: !route.slug && route.section === 'adventure',
          icon: <Compass size={16} aria-hidden />,
          onPress: () => move(learnPath(null, { view: 'adventure' })),
        },
        {
          id: 'startup',
          label: t('Startup Builder'),
          active: !route.slug && route.section === 'startup',
          icon: <Rocket size={16} aria-hidden />,
          onPress: () => move(learnPath(null, { view: 'startup' })),
        },
        {
          id: 'catalog',
          label: t('All 25 Courses'),
          active: !route.slug && route.section === 'catalog',
          icon: <BookOpen size={16} aria-hidden />,
          onPress: () => move(learnPath(null, { view: 'catalog' })),
        },
      ],
    },
    {
      id: 'learn-featured',
      label: t('Featured labs'),
      links: [
        {
          id: 'course-auto-101',
          label: 'AUTO 101 · Free Start',
          active: route.slug === 'continuous-improvement',
          icon: <Sparkles size={15} aria-hidden />,
          onPress: () => move(learnPath('continuous-improvement')),
        },
        {
          id: 'course-kai-301',
          label: 'KAI 301 · Teach Kai',
          active: route.slug === 'kai-training-decision-models',
          icon: <Cpu size={15} aria-hidden />,
          onPress: () => move(learnPath('kai-training-decision-models', { tab: 'experiments' })),
        },
        {
          id: 'course-sci-101',
          label: 'SCI 101 · Discovery',
          active: route.slug === 'science-discovery',
          icon: <Atom size={15} aria-hidden />,
          onPress: () => move(learnPath('science-discovery', { tab: 'experiments' })),
        },
        {
          id: 'course-ent-401',
          label: 'ENT 401 · AI Company',
          active: route.slug === 'build-your-ai-company',
          icon: <Rocket size={15} aria-hidden />,
          onPress: () => move(learnPath('build-your-ai-company', { tab: 'experiments' })),
        },
      ],
    },
  ]
}
