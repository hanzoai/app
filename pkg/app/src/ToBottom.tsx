'use client'

// A round button that floats above the composer while the thread is not at its
// end, and takes the reader there. The thread's scroller is @hanzo/ui/chat's
// (`data-slot="thread"`), so this watches that element rather than owning one:
// it listens to its scroll and to its content growing, and measures the composer
// to stand just above it.

import { useEffect, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { XStack } from '@hanzo/gui'
import { useI18n } from '@hanzo/i18n/react'

/** How far from the end still counts as the end, px. */
const NEAR = 120

export function ToBottom({ within }: { within: HTMLElement | null }) {
  const { t } = useI18n()
  const [lift, setLift] = useState<number | null>(null)

  useEffect(() => {
    const box = within
    if (!box) return
    let thread: HTMLElement | null = null
    const measure = () => {
      thread = box.querySelector<HTMLElement>('[data-slot="thread"]')
      if (!thread) return setLift(null)
      const far = thread.scrollHeight - thread.clientHeight - thread.scrollTop > NEAR
      const composer = box.querySelector<HTMLElement>('[data-slot="composer"]')
      const room = box.getBoundingClientRect()
      const foot = composer ? room.bottom - composer.getBoundingClientRect().top + 12 : 16
      setLift(far ? foot : null)
    }
    const seen = new MutationObserver(measure)
    seen.observe(box, { childList: true, subtree: true })
    box.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    measure()
    return () => {
      seen.disconnect()
      box.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [within])

  if (lift === null) return null
  return (
    <XStack
      render="button"
      aria-label={t('Scroll to bottom')}
      data-slot="to-bottom"
      onPress={() => {
        const thread = within?.querySelector<HTMLElement>('[data-slot="thread"]')
        thread?.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
      }}
      position="absolute"
      b={lift}
      l="50%"
      ml={-18}
      width={36}
      height={36}
      rounded={999}
      items="center"
      justify="center"
      cursor="pointer"
      bg="$raised"
      borderWidth={1}
      borderColor="$borderColor"
      z={5}
    >
      <ArrowDown size={16} aria-hidden />
    </XStack>
  )
}
