import type { RailLink } from '@hanzo/ui/chat'
import { CalendarClock, History, LayoutTemplate, Plus, Workflow } from 'lucide-react'
import { flowPath, type FlowView } from './types'

const NEW_ID = 'new'

export function flowNav(
  activeView: FlowView,
  move: (to: string) => void,
  t: (k: string) => string = (k) => k,
): { id: string; label: string; links: RailLink[] }[] {
  return [
    {
      id: 'flow',
      label: '',
      links: [
        {
          id: NEW_ID,
          label: t('New flow'),
          active: false,
          icon: <Plus size={16} aria-hidden />,
          onPress: () => move(flowPath('new')),
        },
        {
          id: 'flows',
          label: t('Active flows'),
          active: activeView === 'canvas',
          icon: <Workflow size={16} aria-hidden />,
          onPress: () => move(flowPath('')),
        },
        {
          id: 'scheduled',
          label: t('Scheduled'),
          active: activeView === 'scheduled',
          icon: <CalendarClock size={16} aria-hidden />,
          onPress: () => move(flowPath('scheduled')),
        },
        {
          id: 'runs',
          label: t('Run history'),
          active: activeView === 'runs',
          icon: <History size={16} aria-hidden />,
          onPress: () => move(flowPath('runs')),
        },
        {
          id: 'templates',
          label: t('Templates'),
          active: activeView === 'templates',
          icon: <LayoutTemplate size={16} aria-hidden />,
          onPress: () => move(flowPath('templates')),
        },
      ],
    },
  ]
}
