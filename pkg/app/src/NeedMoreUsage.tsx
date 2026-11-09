"use client";

import { useState } from "react";
import { useI18n } from "@hanzo/i18n/react";
import { Box, Dialog, DialogContent, DialogTitle, Text, XStack, YStack } from "@hanzo/ui";
import { X } from "lucide-react";

const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

export interface ResetParts {
  monthDay: string;
  time: string;
  tz: string;
}

export function formatResetParts(iso: string | null | undefined, now: number = Date.now(), zone?: string): ResetParts | null {
  const at = iso && INSTANT.test(iso) ? Date.parse(iso) : NaN;
  if (!(at > now)) return null;
  try {
    const monthDay = new Intl.DateTimeFormat("en-US", {
      ...(zone ? { timeZone: zone } : {}),
      month: "short",
      day: "numeric",
    }).format(at);
    const time = new Intl.DateTimeFormat("en-US", {
      ...(zone ? { timeZone: zone } : {}),
      hour: "numeric",
      minute: "2-digit",
    }).format(at);
    const tzPart = new Intl.DateTimeFormat("en-US", {
      ...(zone ? { timeZone: zone } : {}),
      timeZoneName: "short",
    })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
    return { monthDay, time, tz: tzPart };
  } catch {
    return null;
  }
}

function HandCoinMeterIcon() {
  return (
    <svg width="44" height="40" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Open hand with fingers on the left */}
      <path
        d="M8.5 23.5V13.5C8.5 12.3954 9.39543 11.5 10.5 11.5C11.6046 11.5 12.5 12.3954 12.5 13.5V19.5"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 18.5V10.5C12.5 9.39543 13.3954 8.5 14.5 8.5C15.6046 8.5 16.5 9.39543 16.5 10.5V18.5"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 17.5V11.5C16.5 10.3954 17.3954 9.5 18.5 9.5C19.6046 9.5 20.5 10.3954 20.5 11.5V16.5"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 21.5L6.2 19.2C5.4 18.4 4.1 18.4 3.3 19.2C2.6 19.9 2.5 21.1 3.2 21.9L8.8 28.8C10.5 30.8 13.0 32 15.6 32H21.5C24.5 32 27 29.8 27.4 26.8"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Circular usage dial / coin overlapping on the right */}
      <path
        d="M23.5 11.5C25.4 9.6 28.1 8.5 31 8.5C36.8 8.5 41.5 13.2 41.5 19H21.5C21.5 16.1 22.3 13.4 23.5 11.5Z"
        stroke="var(--foreground)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.5" cy="22.5" r="7" stroke="var(--foreground)" strokeWidth="1.5" fill="var(--card)" />
      <circle cx="26.5" cy="22.5" r="1.5" fill="var(--foreground)" />
      {/* Dial radial ticks */}
      <line x1="31" y1="8.8" x2="31" y2="12.2" stroke="var(--foreground)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="36.2" y1="10.3" x2="34.4" y2="13.2" stroke="var(--foreground)" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="39.8" y1="14.2" x2="36.8" y2="15.8" stroke="var(--foreground)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TeamTrendIcon() {
  return (
    <svg width="44" height="40" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Connecting lines between nodes */}
      <line x1="8.2" y1="30.2" x2="15.3" y2="19.8" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19.2" y1="18.8" x2="25.8" y2="22.2" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="29.3" y1="21.0" x2="36.5" y2="10.5" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Arrow head at top right */}
      <path d="M31.5 10H37V15.5" stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Nodes */}
      <circle cx="6.5" cy="32.5" r="2.5" stroke="var(--foreground)" strokeWidth="1.5" fill="var(--card)" />
      <circle cx="17" cy="17.5" r="2.5" stroke="var(--foreground)" strokeWidth="1.5" fill="var(--card)" />
      <circle cx="28" cy="23.5" r="2.5" stroke="var(--foreground)" strokeWidth="1.5" fill="var(--card)" />
    </svg>
  );
}

export interface NeedMoreUsageBannerProps {
  resetsAt?: string | null;
  fallbackModel?: string | null;
  isUncapped?: boolean;
  customMessage?: string | null;
  onGetMoreUsage: () => void;
  onSeeUsage: () => void;
}

export function NeedMoreUsageBanner({
  resetsAt,
  fallbackModel,
  isUncapped,
  customMessage,
  onGetMoreUsage,
  onSeeUsage,
}: NeedMoreUsageBannerProps) {
  const { t } = useI18n();
  const reset = formatResetParts(resetsAt);

  const headlinePrefix = isUncapped
    ? t("Your balance is empty")
    : customMessage && !resetsAt
      ? customMessage.replace(/\.$/, "")
      : reset
        ? t("Usage limit reached · Resets {date} at {time}", { date: reset.monthDay, time: reset.time })
        : t("Usage limit reached");

  const subline = fallbackModel
    ? t("Wait for the reset, or keep working now with usage credits, billed on top of your plan. You’re chatting on {model}.", {
        model: fallbackModel,
      })
    : t("Wait for the reset, or keep working now with usage credits, billed on top of your plan.");

  return (
    <XStack
      data-slot="limited-banner"
      width="100%"
      items="center"
      justify="space-between"
      gap="$3"
      px={16}
      py={12}
      rounded={12}
      bg="var(--card)"
      borderWidth={1}
      borderColor="var(--border)"
      flexWrap="wrap"
    >
      <YStack flex={1} minW={220} gap={3} data-slot="limited-banner-message">
        <Text fontSize={13} lineHeight={18} fontWeight="500" color="$ink">
          {headlinePrefix}
          {" · "}
          <Text
            render="button"
            data-kind="usage"
            onPress={onSeeUsage}
            fontSize={13}
            lineHeight={18}
            fontWeight="400"
            color="$soft"
            cursor="pointer"
            hoverStyle={{ color: "$ink" }}
            textDecorationLine="underline"
            bg="transparent"
            borderWidth={0}
            p={0}
            display="inline"
          >
            {t("limits shared with Hanzo Dev")}
          </Text>
        </Text>
        <Text fontSize={12.5} lineHeight={17} color="$soft">
          {subline}
        </Text>
      </YStack>

      <XStack items="center" gap="$2" shrink={0}>
        <Box
          render="button"
          data-slot="get-more-usage"
          data-kind="topup"
          onPress={onGetMoreUsage}
          px={14}
          py={7}
          rounded={8}
          bg="var(--secondary)"
          hoverStyle={{ bg: "var(--secondary-hover)" }}
          borderWidth={1}
          borderColor="var(--border)"
          cursor="pointer"
          items="center"
          justify="center"
        >
          <Text fontSize={13} lineHeight={18} fontWeight="500" color="$ink">
            {t("Get more usage")}
          </Text>
        </Box>
      </XStack>
    </XStack>
  );
}

export interface NeedMoreUsageModalProps {
  open: boolean;
  onClose: () => void;
  resetsAt?: string | null;
  onBuyCredits: () => Promise<void> | void;
  onSetupTeam: () => void;
}

export function NeedMoreUsageModal({
  open,
  onClose,
  resetsAt,
  onBuyCredits,
  onSetupTeam,
}: NeedMoreUsageModalProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const reset = formatResetParts(resetsAt);

  const subtitle = reset
    ? t("You've reached your weekly limit. It resets at {time}{tz} on {date}.", {
        time: reset.time,
        tz: reset.tz ? ` ${reset.tz}` : "",
        date: reset.monthDay,
      })
    : t("You've reached your usage limit. Use usage credits or upgrade your plan to keep working.");

  const keepWorkingBody = reset
    ? t("Use usage credits until your limit resets {date}. Billed on top of your plan.", {
        date: reset.monthDay,
      })
    : t("Use usage credits until your limit resets. Billed on top of your plan.");

  const handleBuy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onBuyCredits();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? undefined : onClose())}>
      <DialogContent
        data-slot="need-more-usage-modal"
        showCloseButton={false}
        width="calc(100vw - 32px)"
        maxW={536}
        bg="var(--popover)"
        rounded={16}
        p={24}
        gap={16}
        borderWidth={1}
        borderColor="var(--border)"
        boxShadow="var(--shadow-floating)"
      >
        {/* Header */}
        <XStack items="center" justify="space-between" width="100%">
          <DialogTitle fontSize={18} lineHeight={24} fontWeight="600" color="$ink">
            {t("Need more usage?")}
          </DialogTitle>
          <Box
            render="button"
            aria-label={t("Close")}
            data-slot="need-more-usage-close"
            onPress={onClose}
            width={28}
            height={28}
            rounded={8}
            bg="transparent"
            borderWidth={0}
            cursor="pointer"
            items="center"
            justify="center"
            hoverStyle={{ bg: "$hover" }}
          >
            <X size={18} aria-hidden color="var(--muted-foreground)" />
          </Box>
        </XStack>

        {/* Subtitle */}
        <Text fontSize={13.5} lineHeight={19} color="$soft" mt={-4}>
          {subtitle}
        </Text>

        {/* Two option cards */}
        <XStack
          width="100%"
          gap={12}
          items="stretch"
          $max-sm={{ flexDirection: "column" }}
        >
          {/* Left card: Keep working now */}
          <YStack
            flex={1}
            minW={0}
            p={18}
            rounded={12}
            bg="var(--card)"
            borderWidth={1}
            borderColor="var(--border)"
            justify="space-between"
            gap={16}
          >
            <YStack gap={12}>
              <Box width={44} height={40} items="flex-start" justify="center">
                <HandCoinMeterIcon />
              </Box>
              <YStack gap={6}>
                <Text fontSize={15} lineHeight={20} fontWeight="600" color="$ink">
                  {t("Keep working now")}
                </Text>
                <Text fontSize={13} lineHeight={18.5} color="$soft">
                  {keepWorkingBody}
                </Text>
              </YStack>
            </YStack>

            <YStack gap={8} items="center" width="100%" pt={4}>
              <Box
                render="button"
                data-slot="buy-usage-credits"
                onPress={() => void handleBuy()}
                width="100%"
                py={9}
                px={14}
                rounded={8}
                bg="var(--secondary)"
                hoverStyle={{ bg: "var(--secondary-hover)" }}
                borderWidth={1}
                borderColor="var(--border)"
                cursor="pointer"
                items="center"
                justify="center"
                opacity={busy ? 0.7 : 1}
              >
                <Text fontSize={13} lineHeight={18} fontWeight="600" color="$ink">
                  {busy ? t("Turning on credits…") : t("Buy usage credits")}
                </Text>
              </Box>
              <Text fontSize={11.5} lineHeight={15} color="$soft" text="center">
                {t("Buying turns on usage credits")}
              </Text>
            </YStack>
          </YStack>

          {/* Right card: Bring your team along */}
          <YStack
            flex={1}
            minW={0}
            p={18}
            rounded={12}
            bg="var(--surface-card-emphasis)"
            borderWidth={1}
            borderColor="var(--border-selected)"
            justify="space-between"
            gap={16}
          >
            <YStack gap={12}>
              <XStack width="100%" items="flex-start" justify="space-between" gap={8}>
                <Box width={44} height={40} items="flex-start" justify="center">
                  <TeamTrendIcon />
                </Box>
                <Box
                  px={10}
                  py={3}
                  rounded={999}
                  bg="var(--primary)"
                  items="center"
                  justify="center"
                >
                  <Text fontSize={11.5} lineHeight={15} fontWeight="600" color="var(--primary-foreground)">
                    {t("Recommended")}
                  </Text>
                </Box>
              </XStack>
              <YStack gap={6}>
                <Text fontSize={15} lineHeight={20} fontWeight="600" color="$ink">
                  {t("Bring your team along")}
                </Text>
                <Text fontSize={13} lineHeight={18.5} color="$soft">
                  {t(
                    "If Hanzo's this useful to you, share it with your colleagues — work together in shared projects, all on one plan.",
                  )}
                </Text>
              </YStack>
            </YStack>

            <YStack gap={8} items="center" width="100%" pt={4} pb={23}>
              <Box
                render="button"
                data-slot="setup-team-plan"
                onPress={onSetupTeam}
                width="100%"
                py={9}
                px={14}
                rounded={8}
                bg="var(--primary)"
                hoverStyle={{ bg: "var(--primary-hover)" }}
                borderWidth={0}
                cursor="pointer"
                items="center"
                justify="center"
              >
                <Text fontSize={13} lineHeight={18} fontWeight="600" color="var(--primary-foreground)">
                  {t("Set up a Team plan")}
                </Text>
              </Box>
            </YStack>
          </YStack>
        </XStack>
      </DialogContent>
    </Dialog>
  );
}
