import type { RailLink } from '@hanzo/ui/chat'
import {
  BookOpen,
  CalendarClock,
  FlaskConical,
  LayoutDashboard,
  Server,
  Sparkles,
} from 'lucide-react'
import { sciencePath, type ScienceTab } from './types'

const NEW_ID = 'new'

export function scienceNav(
  activeTab: ScienceTab,
  move: (to: string) => void,
  t: (k: string) => string = (k) => k,
): { id: string; label: string; links: RailLink[] }[] {
  return [
    {
      id: 'science',
      label: '',
      links: [
        {
          id: NEW_ID,
          label: t('New hypothesis'),
          active: false,
          icon: <FlaskConical size={16} aria-hidden />,
          onPress: () => move(sciencePath('autonomy')),
        },
        {
          id: 'overview',
          label: t('Overview'),
          active: activeTab === 'overview',
          icon: <LayoutDashboard size={16} aria-hidden />,
          onPress: () => move(sciencePath('overview')),
        },
        {
          id: 'studies',
          label: t('Studies'),
          active: activeTab === 'studies',
          icon: <BookOpen size={16} aria-hidden />,
          onPress: () => move(sciencePath('studies')),
        },
        {
          id: 'autonomy',
          label: t('Autonomy'),
          active: activeTab === 'autonomy',
          icon: <Sparkles size={16} aria-hidden />,
          onPress: () => move(sciencePath('autonomy')),
        },
        {
          id: 'machines',
          label: t('Machines'),
          active: activeTab === 'machines',
          icon: <Server size={16} aria-hidden />,
          onPress: () => move(sciencePath('machines')),
        },
        {
          id: 'schedules',
          label: t('Schedules'),
          active: activeTab === 'schedules',
          icon: <CalendarClock size={16} aria-hidden />,
          onPress: () => move(sciencePath('schedules')),
        },
      ],
    },
  ]
}
