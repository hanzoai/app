'use client'

/**
 * HOW THE APP LOOKS.
 *
 * Theme, type, spacing, corners, native platform profiles, custom fonts,
 * and organization theme mods — stored and resolved for the organization in scope.
 */

import { useState, useEffect } from 'react'
import { LanguagePicker, useI18n } from '@hanzo/i18n/react'
import { Box, Button, Input, Separator, Text, XStack, YStack } from '@hanzo/ui'
import { Appearance } from '@hanzo/appearance'
import { useIam } from '@hanzo/iam/react'
import { Check, Download, Laptop, Palette, Smartphone, Sparkles, Type, Upload } from 'lucide-react'
import {
  getActivePlatform,
  setActivePlatform,
  PLATFORM_PROFILES,
  BUILTIN_MODS,
  applyMod,
  exportMod,
  importMod,
  injectCustomFont,
  applyFontFamily,
  type PlatformId,
  type ModTheme,
} from '@hanzo/mod'
import { api } from './lib/api'
import { useChatPreferences } from './lib/chatPreferences'
import { useOrg } from './host'
import { EFFORT_STEPS } from './ThinkingEffort'
import { brand } from './where'
import { tap } from './lib/tap'

const CHOICE = { rounded: 8, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer' } as const

const PLATFORM_OPTIONS: { id: PlatformId | 'auto'; label: string; note: string }[] = [
  { id: 'auto', label: 'Auto (System OS)', note: 'Automatically detects your device operating system' },
  { id: 'ios', label: 'Apple iOS (Liquid Glass)', note: 'Continuous squircles, specular liquid glass, SF Pro typography' },
  { id: 'android', label: 'Android (Material 3)', note: 'Material 3 tonal elevations and Google Sans geometry' },
  { id: 'macos', label: 'Apple macOS (Vibrant)', note: 'Translucent glass sidebars and compact desktop density' },
  { id: 'windows', label: 'Windows (Mica Fluent)', note: 'Fluent Design acrylic Mica and Segoe UI Variable' },
  { id: 'linux', label: 'Linux (Clean System)', note: 'Crisp system geometry and flat modern edges' },
]

export function Look() {
  const { t } = useI18n()
  const { accessToken } = useIam()
  const org = useOrg()
  const [chatPrefs, setChatPrefs] = useChatPreferences()

  const [activePlatform, setPlatform] = useState<PlatformId | 'auto'>(() => {
    if (typeof window === 'undefined') return 'auto'
    const stored = window.localStorage.getItem('hanzo.mod.platform') as PlatformId | null
    return stored ?? 'auto'
  })

  const [customFont, setCustomFont] = useState('')
  const [fontApplied, setFontApplied] = useState(false)
  const [modJson, setModJson] = useState('')
  const [copiedMod, setCopiedMod] = useState(false)

  const handlePlatformChange = (p: PlatformId | 'auto') => {
    setPlatform(p)
    setActivePlatform(p)
  }

  const handleApplyFont = () => {
    if (!customFont.trim()) return
    const font = customFont.trim()
    if (font.startsWith('http://') || font.startsWith('https://')) {
      injectCustomFont({ family: 'CustomBrandFont', url: font, isStylesheet: true })
      applyFontFamily('heading', 'CustomBrandFont, sans-serif')
      applyFontFamily('sans', 'CustomBrandFont, sans-serif')
    } else {
      applyFontFamily('heading', `${font}, sans-serif`)
      applyFontFamily('sans', `${font}, sans-serif`)
    }
    setFontApplied(true)
    setTimeout(() => setFontApplied(false), 2500)
  }

  const handleExportMod = (mod: ModTheme) => {
    const json = exportMod(mod)
    navigator.clipboard?.writeText(json)
    setCopiedMod(true)
    setTimeout(() => setCopiedMod(false), 2000)
  }

  const handleImportMod = () => {
    if (!modJson.trim()) return
    try {
      const mod = importMod(modJson.trim())
      applyMod(mod)
      alert(t('Mod "{name}" successfully applied!', { name: mod.name }))
      setModJson('')
    } catch (e: any) {
      alert(t('Failed to import mod: {message}', { message: e.message }))
    }
  }

  return (
    <YStack gap="$5" maxW={540}>
      <Text fontSize="$3" color="$soft">
        {t('Customized per organization and kept with your account across all Hanzo surfaces.')}
      </Text>

      {/* Core Design Appearance */}
      <Appearance org={org.id} orgName={org.name || brand()} account={{ base: api(), token: accessToken ?? undefined }} />

      <Separator />

      {/* Native Platform Profile */}
      <YStack gap="$2.5">
        <XStack items="center" gap="$2">
          <Smartphone size={16} color="var(--primary)" aria-hidden />
          <Text fontSize="$4" fontWeight="600" color="$ink">
            {t('Native Platform Look & Feel')}
          </Text>
        </XStack>
        <Text fontSize="$2" color="$soft">
          {t('Adaptive styling tailored to your OS: iOS Liquid Glass, Material 3, macOS Vibrant, or Windows Mica.')}
        </Text>

        <YStack gap="$1.5" pt="$1">
          {PLATFORM_OPTIONS.map((opt) => {
            const active = activePlatform === opt.id
            return (
              <Box
                render={<button type="button" />}
                key={opt.id}
                {...tap}
                onClick={() => handlePlatformChange(opt.id)}
                {...CHOICE}
                p="$2.5"
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
              >
                <XStack items="center" justify="space-between">
                  <YStack gap="$0.5">
                    <Text fontSize="$3" fontWeight={active ? '600' : '500'} color={active ? '$ink' : '$ink'}>
                      {opt.label}
                    </Text>
                    <Text fontSize="$1" color="$soft">
                      {opt.note}
                    </Text>
                  </YStack>
                  {active ? <Check size={16} color="var(--primary)" aria-hidden /> : null}
                </XStack>
              </Box>
            )
          })}
        </YStack>
      </YStack>

      <Separator />

      {/* Organization Themes & Designer Mods */}
      <YStack gap="$3">
        <XStack items="center" gap="$2">
          <Palette size={16} color="var(--primary)" aria-hidden />
          <Text fontSize="$4" fontWeight="600" color="$ink">
            {t('Organization Theme Mods (@hanzo/mod)')}
          </Text>
        </XStack>
        <Text fontSize="$2" color="$soft">
          {t('Select or fork designer themes for custom organization branding.')}
        </Text>

        <XStack gap="$2" flexWrap="wrap">
          {BUILTIN_MODS.map((mod) => (
            <Box
              render={<button type="button" />}
              key={mod.id}
              {...tap}
              onClick={() => applyMod(mod)}
              {...CHOICE}
              py={6}
              px={12}
              bg="transparent"
              borderColor="var(--white-10)"
              hoverStyle={{ bg: '$hover' }}
            >
              <Text fontSize="$2" color="$ink">
                {mod.name}
              </Text>
            </Box>
          ))}
        </XStack>

        {/* Custom Font Uploader / Input */}
        <YStack gap="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
          <XStack items="center" gap="$2">
            <Type size={15} color="var(--primary)" aria-hidden />
            <Text fontSize="$3" fontWeight="600" color="$ink">
              {t('Custom Typography')}
            </Text>
          </XStack>
          <Text fontSize="$2" color="$soft">
            {t('Enter a font family name (e.g. "Geist", "Inter", "Cabinet Grotesk") or a webfont stylesheet URL.')}
          </Text>
          <XStack gap="$2" items="center">
            <Input
              flex={1}
              size="sm"
              value={customFont}
              onChange={(e) => setCustomFont(e.target.value)}
              placeholder="e.g. Cabinet Grotesk or https://fonts.googleapis.com/..."
            />
            <Button size="sm" onClick={handleApplyFont}>
              {fontApplied ? t('Applied!') : t('Apply Font')}
            </Button>
          </XStack>
        </YStack>

        {/* Export / Import Mod JSON */}
        <YStack gap="$2" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
          <Text fontSize="$3" fontWeight="600" color="$ink">
            {t('Fork & Share Theme Mods')}
          </Text>
          <Text fontSize="$2" color="$soft">
            {t('Export current mod configuration or paste a mod JSON to import.')}
          </Text>
          <XStack gap="$2" items="center">
            <Input
              flex={1}
              size="sm"
              value={modJson}
              onChange={(e) => setModJson(e.target.value)}
              placeholder={t('Paste mod JSON here to import')}
            />
            <Button size="sm" variant="outline" onClick={handleImportMod}>
              <Upload size={13} aria-hidden />
              {t('Import')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleExportMod(BUILTIN_MODS[0])}>
              <Download size={13} aria-hidden />
              {copiedMod ? t('Copied!') : t('Export JSON')}
            </Button>
          </XStack>
        </YStack>
      </YStack>

      <Separator />

      {/* Language */}
      <YStack gap="$2">
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Language')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('The language Hanzo is shown in, on every Hanzo surface you sign in to.')}
        </Text>
        <XStack pt="$1">
          <LanguagePicker />
        </XStack>
      </YStack>

      <Separator />

      {/* Tool & Action Approval (Auto vs Manual) */}
      <YStack gap="$2" data-slot="settings-approval-mode">
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Tool & Action Approval')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Control whether tools, connectors, and actions execute automatically or require manual approval first.')}
        </Text>
        <XStack gap="$2" pt="$1">
          {[
            { id: 'auto' as const, label: t('Auto'), note: t('Runs tools on its own; pauses only for anything risky.') },
            { id: 'manual' as const, label: t('Manual'), note: t('Asks before each tool, connector or site it opens.') },
          ].map((opt) => {
            const active = (chatPrefs.approvalMode || 'auto') === opt.id
            return (
              <Box
                render={<button type="button" />}
                key={opt.id}
                {...tap}
                onClick={() => setChatPrefs({ approvalMode: opt.id })}
                {...CHOICE}
                flex={1}
                p="$2.5"
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
              >
                <XStack items="center" justify="space-between">
                  <Text fontSize="$3" fontWeight={active ? '600' : '500'} color="$ink">
                    {opt.label}
                  </Text>
                  {active ? <Check size={16} color="var(--primary)" aria-hidden /> : null}
                </XStack>
                <Text fontSize="$1" color="$soft">
                  {opt.note}
                </Text>
              </Box>
            )
          })}
        </XStack>
      </YStack>

      <Separator />

      {/* Default Reasoning Effort */}
      <YStack gap="$2" data-slot="settings-reasoning-effort">
        <Text fontSize="$4" fontWeight="600" color="$ink">
          {t('Default Reasoning Effort')}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t('Sets how deeply models think before answering. Defaults to High.')}
        </Text>
        <XStack gap="$2" pt="$1" flexWrap="wrap">
          {EFFORT_STEPS.map((step) => {
            const active = (chatPrefs.effort || 'high') === step.id
            return (
              <Box
                render={<button type="button" />}
                key={step.id}
                {...tap}
                onClick={() => setChatPrefs({ effort: step.id })}
                {...CHOICE}
                py={6}
                px={12}
                bg={active ? 'var(--edge, var(--white-14))' : 'transparent'}
                borderColor={active ? 'var(--borderColor, var(--white-22))' : 'var(--white-08)'}
              >
                <XStack items="center" gap="$1.5">
                  <Text fontSize="$2" fontWeight={active ? '600' : '400'} color={active ? '$ink' : '$soft'}>
                    {step.label}
                  </Text>
                  {active ? <Check size={12} color="var(--primary)" aria-hidden /> : null}
                </XStack>
              </Box>
            )
          })}
        </XStack>
      </YStack>
    </YStack>
  )
}
