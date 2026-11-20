'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@hanzo/i18n/react'
import { Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from '@hanzo/ui'
import { Search, X } from 'lucide-react'
import { FIRST, SettingsList, type Row } from './Settings'
import { SettingsPane } from './SettingsPane'

export function PreferencesDialog({
  open,
  onOpenChange,
  initialSection = FIRST,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: string
}) {
  const { t } = useI18n()
  const [active, setActive] = useState(initialSection)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (open) setActive(initialSection)
  }, [open, initialSection])

  const pick = (row: Row) => {
    if (row.href) {
      window.open(row.href, '_blank', 'noopener,noreferrer')
      return
    }
    setActive(row.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="preferences-dialog"
        width="94vw"
        maxW={980}
        height="84vh"
        maxH={760}
        p={0}
        gap={0}
        rounded={14}
        overflow="hidden"
        bg="var(--pane-fill, var(--card))"
        borderWidth={1}
        borderColor="var(--pane-edge, var(--white-08))"
      >
        <DialogTitle display="none">{t('Settings')}</DialogTitle>
        <XStack flex={1} minH={0} minW={0} width="100%" overflow="hidden" $max-md={{ flexDirection: 'column' }}>
          <YStack
            width={256}
            shrink={0}
            height="100%"
            minW={0}
            bg="var(--side-fill, var(--background))"
            borderRightWidth={1}
            borderColor="var(--pane-edge, var(--white-08))"
            $max-md={{ width: '100%', height: 'auto', maxH: '42%', borderRightWidth: 0, borderBottomWidth: 1 }}
          >
            <XStack px={12} pt={12} pb={8} shrink={0}>
              <XStack
                data-slot="settings-search"
                flex={1}
                height={32}
                px={10}
                gap={8}
                items="center"
                rounded={8}
                bg="var(--surface-card-quiet, var(--card))"
                borderWidth={1}
                borderColor="var(--pane-edge, var(--white-08))"
              >
                <XStack
                  data-slot="settings-search-icon"
                  width={14}
                  height={14}
                  shrink={0}
                  items="center"
                  justify="center"
                  pointerEvents="none"
                  aria-hidden
                >
                  <Search size={13} color="var(--muted-foreground)" aria-hidden />
                </XStack>
                <Text
                  data-slot="settings-search-input"
                  render={
                    <input
                      type="search"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setFilter('')
                      }}
                      placeholder={t('Search settings')}
                      aria-label={t('Search settings')}
                    />
                  }
                  flex={1}
                  minW={0}
                  width="100%"
                  height="100%"
                  p={0}
                  bg="transparent"
                  borderWidth={0}
                  outlineStyle="none"
                  fontSize={13}
                  color="var(--foreground)"
                />
                {filter ? (
                  <XStack
                    render="button"
                    {...{ type: 'button' }}
                    aria-label={t('Clear search')}
                    onClick={() => setFilter('')}
                    width={18}
                    height={18}
                    shrink={0}
                    rounded={999}
                    items="center"
                    justify="center"
                    bg="transparent"
                    borderWidth={0}
                    cursor="pointer"
                    hoverStyle={{ bg: 'var(--secondary)' }}
                  >
                    <X size={11} color="var(--muted-foreground)" aria-hidden />
                  </XStack>
                ) : null}
              </XStack>
            </XStack>
            <YStack flex={1} minH={0} px={8} pb={12} overflowY="auto" overflowX="hidden">
              <SettingsList active={active} filter={filter} onPick={pick} onBack={() => onOpenChange(false)} />
            </YStack>
          </YStack>

          <YStack flex={1} minW={0} minH={0} height="100%" bg="var(--pane-fill, var(--card))" position="relative">
            <XStack position="absolute" t={12} r={14} z={5}>
              <XStack
                render="button"
                {...{ type: 'button' }}
                aria-label={t('Close')}
                onClick={() => onOpenChange(false)}
                width={32}
                height={32}
                rounded={999}
                items="center"
                justify="center"
                bg="var(--surface-card-quiet, var(--card))"
                borderWidth={1}
                borderColor="var(--pane-edge, var(--white-08))"
                cursor="pointer"
                hoverStyle={{ bg: 'var(--secondary)' }}
              >
                <X size={15} color="var(--foreground)" aria-hidden />
              </XStack>
            </XStack>
            <SettingsPane id={active} />
          </YStack>
        </XStack>
      </DialogContent>
    </Dialog>
  )
}
