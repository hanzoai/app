'use client'

import type { RailLink } from '@hanzo/ui/chat'
import {
  Activity,
  AlertTriangle,
  Crosshair,
  GitFork,
  LayoutDashboard,
  ListChecks,
  Lock,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { cyberPath, type CyberTab } from './types'

const NEW_ID = 'new'

export function cyberNav(
  activeTab: CyberTab,
  move: (to: string) => void,
  t: (k: string) => string = (k) => k,
): { id: string; label: string; links: RailLink[] }[] {
  return [
    {
      id: 'cyber',
      label: '',
      links: [
        {
          id: NEW_ID,
          label: t('New engagement'),
          active: false,
          icon: <Plus size={16} aria-hidden />,
          onPress: () => {
            move(cyberPath('overview'))
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('hanzo:cyber-new-engagement'))
            }
          },
        },
        {
          id: 'overview',
          label: t('Overview'),
          active: activeTab === 'overview',
          icon: <LayoutDashboard size={16} aria-hidden />,
          onPress: () => move(cyberPath('overview')),
        },
        {
          id: 'graph',
          label: t('Mission Graph'),
          active: activeTab === 'graph',
          icon: <GitFork size={16} aria-hidden />,
          onPress: () => move(cyberPath('graph')),
        },
        {
          id: 'findings',
          label: t('Findings'),
          active: activeTab === 'findings',
          icon: <AlertTriangle size={16} aria-hidden />,
          onPress: () => move(cyberPath('findings')),
        },
        {
          id: 'approvals',
          label: t('Kai Approvals'),
          active: activeTab === 'approvals',
          icon: <ShieldCheck size={16} aria-hidden />,
          onPress: () => move(cyberPath('approvals')),
        },
        {
          id: 'traffic',
          label: t('Traffic'),
          active: activeTab === 'traffic',
          icon: <Activity size={16} aria-hidden />,
          onPress: () => move(cyberPath('traffic')),
        },
        {
          id: 'attack',
          label: t('ATT&CK'),
          active: activeTab === 'attack',
          icon: <Crosshair size={16} aria-hidden />,
          onPress: () => move(cyberPath('attack')),
        },
        {
          id: 'coa',
          label: t('Course of Action'),
          active: activeTab === 'coa',
          icon: <ListChecks size={16} aria-hidden />,
          onPress: () => move(cyberPath('coa')),
        },
        {
          id: 'hardening',
          label: t('Hardening'),
          active: activeTab === 'hardening',
          icon: <Lock size={16} aria-hidden />,
          onPress: () => move(cyberPath('hardening')),
        },
      ],
    },
  ]
}
