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
    // One measure a frame, however many scrolls, token commits or resizes ask for it.
    let frame = 0
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), measure()))
    }
    const seen = new MutationObserver(soon)
    seen.observe(box, { childList: true, subtree: true })
    const sized = new ResizeObserver(soon)
    sized.observe(box)
    box.querySelectorAll('[data-slot="thread"], [data-slot="composer"]').forEach((el) => sized.observe(el))
    box.addEventListener('scroll', soon, { capture: true, passive: true })
    window.addEventListener('resize', soon)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      seen.disconnect()
      sized.disconnect()
      box.removeEventListener('scroll', soon, { capture: true })
      window.removeEventListener('resize', soon)
      setLift(null)
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
        thread?.scrollTo({ top: thread.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
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
      focusVisibleStyle={{ outlineWidth: 2, outlineStyle: 'solid', outlineColor: '$outlineColor' }}
      bg="$raised"
      borderWidth={1}
      borderColor="$borderColor"
      z={5}
    >
      <ArrowDown size={16} aria-hidden />
    </XStack>
  )
}
