"use client";

/**
 * HOW THE APP LOOKS.
 *
 * One panel, `@hanzo/appearance`'s: theme, type, spacing, corners and accent,
 * resolved for the organization in scope and kept with the person's IAM
 * account, so it follows them to every Hanzo surface. The theme used to be a
 * row of its own here, written to next-themes and to IAM's per-subject key —
 * two more places a theme lived, neither of which crossed an origin.
 */

import { LanguagePicker, useI18n } from "@hanzo/i18n/react";
import { Text, XStack, YStack } from "@hanzo/ui";
import { Appearance } from "@hanzo/appearance";
import { useIam } from "@hanzo/iam/react";
import { api } from "./lib/api";
import { useOrg } from "./host";
import { brand } from "./where";

export function Look() {
  const { t } = useI18n();
  const { accessToken } = useIam();
  const org = useOrg();

  return (
    <YStack gap="$4" maxW={420}>
      <Text fontSize="$3" color="$soft">
        {t("Kept with your account, so it follows you to every Hanzo surface.")}
      </Text>
      {/* The account copy lives on /v1/iam/preferences of the IAM this app
          signs into, read and written with the reader's own bearer. */}
      <Appearance
        org={org.id}
        orgName={org.name || brand()}
        account={{ base: api(), token: accessToken ?? undefined }}
      />
      <YStack gap="$2" pt="$3" borderTopWidth={1} borderColor="$borderColor">
        <Text fontSize="$3" fontWeight="600" color="$ink">
          {t("Language")}
        </Text>
        <Text fontSize="$2" color="$soft">
          {t("The language Hanzo is shown in, on every Hanzo surface you sign in to.")}
        </Text>
        <XStack pt="$1">
          <LanguagePicker />
        </XStack>
      </YStack>
    </YStack>
  );
}
