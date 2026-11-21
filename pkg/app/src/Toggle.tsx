'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@hanzo/ui'
import { Text, XStack } from '@hanzo/gui'
import { useI18n } from '@hanzo/i18n/react'
import { PanelLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useHost } from './host'

/**
 * The sidebar's toggle, one component in every state (the expanded header, the
 * folded rail, the window's bar): Hanzo Dev's SidebarTrigger — a ghost icon
 * button, PanelLeft at 16px in a 28px control.
 */
export const TOGGLE = 28

export function Toggle({
  open,
  onPress,
  label,
  tooltip = false,
}: {
  open: boolean
  onPress: () => void
  label?: string
  tooltip?: boolean
}) {
  const { t } = useI18n()
  const { path } = useHost()
  // The tooltip is dismissed by the press and by any move: left open it stayed over the title.
  const [shown, setShown] = useState(false)
  useEffect(() => setShown(false), [path, open])
  const name = label ?? t(open ? 'Close sidebar' : 'Open sidebar')
  const button = (
    <XStack
      render="button"
      data-slot="sidebar-toggle"
      aria-label={name}
      aria-expanded={open}
      {...(tooltip ? {} : ({ title: name } as object))}
      data-tauri-drag-region="false"
      onClick={() => {
        setShown(false)
        onPress()
      }}
      width={TOGGLE}
      height={TOGGLE}
      rounded="$3"
      items="center"
      justify="center"
      shrink={0}
      cursor="pointer"
      bg="transparent"
      opacity={0.76}
      hoverStyle={{ bg: '$hover', opacity: 1 }}
      pressStyle={{ bg: '$raised' }}
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
    >
      <PanelLeft size={16} aria-hidden data-i18n-mirror />
    </XStack>
  )
  if (!tooltip) return button
  return (
    <Tooltip placement="right" offset={8} open={shown} onOpenChange={setShown}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent maxW={240} px="$2.5" py="$1.5" rounded="$3" bg="var(--popover)" borderWidth={1} borderColor="$edge" z="var(--z-tooltip)">
        <Text fontFamily="$body" fontSize="$1" fontWeight="500" color="$ink">
          {name}
        </Text>
      </TooltipContent>
    </Tooltip>
  )
}
