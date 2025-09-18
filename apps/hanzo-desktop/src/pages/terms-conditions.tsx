import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from '@hanzo/i18n';
import {
  type QuickConnectFormSchema,
  quickConnectFormSchema,
} from '@hanzo/node/forms/auth/quick-connection';
import { useInitialRegistration } from '@hanzo/node/v2/mutations/initialRegistration/useInitialRegistration';
import { useGetEncryptionKeys } from '@hanzo/node/v2/queries/getEncryptionKeys/useGetEncryptionKeys';
import { Button, buttonVariants, Checkbox } from '@hanzo/ui';
import { submitRegistrationNoCodeError } from '@hanzo/ui/helpers';
import { cn } from '@hanzo/ui/utils';
import { createContext, useContext, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { OnboardingStep } from '../components/onboarding/constants';
import { ResetStorageBeforeConnectConfirmationPrompt } from '../components/reset-storage-before-connect-confirmation-prompt';
import config from '../config';
import {
  useHanzoNodeRemoveStorageMutation,
  useHanzoNodeSpawnMutation,
  useHanzoNodeKillMutation,
} from '../lib/hanzo-node-manager/hanzo-node-manager-client';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useHanzoNodeManager } from '../store/hanzo-node-manager';

export const LogoTapContext = createContext<{
  tapCount: number;
  setTapCount: (count: number) => void;
  showLocalNodeOption: boolean;
  setShowLocalNodeOption: (show: boolean) => void;
}>({
  tapCount: 0,
  setTapCount: () => {
    // no-op
  },
  showLocalNodeOption: false,
  setShowLocalNodeOption: () => {
    // no-op
  },
});

export const useLogoTap = () => useContext(LogoTapContext);

export const LogoTapProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [tapCount, setTapCount] = useState(0);
  const [showLocalNodeOption, setShowLocalNodeOption] = useState(false);

  return (
    <LogoTapContext.Provider
      value={{
        tapCount,
        setTapCount,
        showLocalNodeOption,
        setShowLocalNodeOption,
      }}
    >
      {children}
    </LogoTapContext.Provider>
  );
};

const TermsAndConditionsPage = () => {
  const { t, Trans } = useTranslation();
  const navigate = useNavigate();
  const [termsAndConditionsAccepted, setTermsAndConditionsAccepted] =
    useState(false);
  const { showLocalNodeOption } = useLogoTap();

  const completeStep = useSettings((state) => state.completeStep);

  const termsAndConditionsAcceptedLegacy = useSettings((state) =>
    state.getTermsAndConditionsAccepted(),
  );
  const isLocalHanzoNodeInUse = useHanzoNodeManager((state) => state.isInUse);
  useEffect(() => {
    if (
      termsAndConditionsAcceptedLegacy !== undefined &&
      isLocalHanzoNodeInUse
    ) {
      completeStep(OnboardingStep.TERMS_CONDITIONS, true);
    }
  }, [completeStep, isLocalHanzoNodeInUse, termsAndConditionsAcceptedLegacy]);

  const setAuth = useAuth((state) => state.setAuth);
  const [
    resetStorageBeforeConnectConfirmationPromptOpen,
    setResetStorageBeforeConnectConfirmationPrompt,
  ] = useState(false);

  const { encryptionKeys } = useGetEncryptionKeys();
  const setupDataForm = useForm<QuickConnectFormSchema>({
    resolver: zodResolver(quickConnectFormSchema),
    defaultValues: {
      node_address: 'http://127.0.0.1:3690',
    },
  });

  const {
    mutateAsync: submitRegistrationNoCode,
    isPending: submitRegistrationNodeCodeIsPending,
  } = useInitialRegistration({
    onSuccess: (response, setupPayload) => {
      if (response.status === 'success' && encryptionKeys) {
        setAuth({
          api_v2_key: response.data?.api_v2_key ?? '',
          node_address: setupPayload.nodeAddress,
          profile: 'main',
          hanzo_identity: response.data?.node_name ?? '',
          encryption_pk: response.data?.encryption_public_key ?? '',
          identity_pk: response.data?.identity_public_key ?? '',
        });
        completeStep(OnboardingStep.TERMS_CONDITIONS, true);
      } else if (response.status === 'non-pristine') {
        setResetStorageBeforeConnectConfirmationPrompt(true);
      } else {
        submitRegistrationNoCodeError();
      }
    },
  });
  const { isPending: hanzoNodeRemoveStorageIsPending } =
    useHanzoNodeRemoveStorageMutation();
  const [hanzoNodeSpawned, setHanzoNodeSpawned] = useState(false);
  const {
    isPending: hanzoNodeSpawnIsPending,
    mutateAsync: hanzoNodeSpawn,
  } = useHanzoNodeSpawnMutation({
    onSuccess: () => {
      console.log('✅ HANZO NODE SPAWN SUCCESS - WAITING FOR ENCRYPTION KEYS');
      setHanzoNodeSpawned(true);
    },
    onError: (error) => {
      console.error('❌ HANZO NODE SPAWN FAILED:', error);
      alert(`Failed to spawn hanzo node: ${error}`);
    },
  });
  const { isPending: hanzoNodeKillIsPending } = useHanzoNodeKillMutation();

  const isStartLocalButtonLoading =
    hanzoNodeSpawnIsPending ||
    hanzoNodeKillIsPending ||
    hanzoNodeRemoveStorageIsPending ||
    submitRegistrationNodeCodeIsPending ||
    (hanzoNodeSpawned && !encryptionKeys);

  async function onSubmit(currentValues: QuickConnectFormSchema) {
    if (!encryptionKeys) return;
    await submitRegistrationNoCode({
      nodeAddress: currentValues.node_address,
      profileEncryptionPk: encryptionKeys.profile_encryption_pk,
      profileIdentityPk: encryptionKeys.profile_identity_pk,
    });
  }

  // Handle race between node spawn and encryption keys availability
  useEffect(() => {
    if (hanzoNodeSpawned && encryptionKeys) {
      console.log('🔐 ENCRYPTION KEYS READY - SUBMITTING REGISTRATION');
      void onSubmit(setupDataForm.getValues());
    }
  }, [hanzoNodeSpawned, encryptionKeys, setupDataForm]);

  const onCancelConfirmation = () => {
    setResetStorageBeforeConnectConfirmationPrompt(false);
  };

  const onRestoreConfirmation = () => {
    setResetStorageBeforeConnectConfirmationPrompt(false);
  };

  const onResetConfirmation = () => {
    setResetStorageBeforeConnectConfirmationPrompt(false);
    void onSubmit(setupDataForm.getValues());
  };

  return (
    <div className="flex h-full flex-col justify-between gap-10">
      <div className="space-y-5">
        <h1 className="font-clash text-4xl font-semibold">
          {t('desktop.welcome')}
        </h1>
        <p className="text-text-secondary text-base">
          <Trans
            components={{
              b: <span className={'text-text-default font-semibold'} />,
            }}
            i18nKey="desktop.welcomeDescription"
          />
        </p>
      </div>
      <div className="flex gap-3">
        <Checkbox
          checked={termsAndConditionsAccepted}
          id="terms"
          onCheckedChange={(checked) =>
            setTermsAndConditionsAccepted(checked as boolean)
          }
        />
        <label
          className="inline-block cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          htmlFor="terms"
        >
          <span className={'leading-4 tracking-wide'}>
            <Trans
              components={{
                a: (
                  <a
                    className={'text-text-default underline'}
                    href={'https://www.hanzo.ai/terms-of-service'}
                    rel="noreferrer"
                    target={'_blank'}
                  />
                ),
                b: (
                  <a
                    className={'text-text-default underline'}
                    href={'https://www.hanzo.ai/privacy-policy'}
                    rel="noreferrer"
                    target={'_blank'}
                  />
                ),
              }}
              i18nKey="common.termsAndConditionsText"
            />
          </span>
        </label>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-4">
        <Button
          className={cn(
            buttonVariants({
              variant: 'default',
              size: 'lg',
            }),
          )}
          disabled={!termsAndConditionsAccepted || isStartLocalButtonLoading}
          isLoading={isStartLocalButtonLoading}
          onClick={async () => {
            console.log(
              '🚀 GET STARTED BUTTON CLICKED - ATTEMPTING TO SPAWN/CONNECT TO HANZOD',
            );
            try {
              // The spawn function will auto-detect if hanzod is already running
              await hanzoNodeSpawn();

              // Wait a bit for the node to start
              setTimeout(async () => {
                if (encryptionKeys) {
                  // Try to connect
                  const formData = setupDataForm.getValues();
                  await submitRegistrationNoCode({
                    nodeAddress: formData.node_address,
                    encryptionKeys: encryptionKeys!,
                  });
                }
              }, 2000);
            } catch (error) {
              console.error('Failed to start node:', error);
              // Try direct navigation as fallback
              navigate('/quick-connection');
            }
          }}
        >
          {t('common.getStarted')}
        </Button>

        {/* Single animated status line */}
        <div className="text-center text-sm">
          {isStartLocalButtonLoading ? (
            <div className="flex items-center justify-center gap-2 text-cyan-400">
              <span className="animate-spin">⚡</span>
              <span className="animate-pulse">
                {hanzoNodeSpawned && !encryptionKeys
                  ? 'Initializing node...'
                  : 'Connecting to port 3690...'}
              </span>
            </div>
          ) : (
            <div className="text-text-secondary">
              <span>Local node on port 3690 • </span>
              <Link
                className="text-cyan-400 hover:text-cyan-300 underline transition-colors"
                to="/quick-connection"
              >
                Connect to different node →
              </Link>
            </div>
          )}
        </div>
      </div>
      <ResetStorageBeforeConnectConfirmationPrompt
        onCancel={() => onCancelConfirmation()}
        onReset={() => onResetConfirmation()}
        onRestore={() => onRestoreConfirmation()}
        open={resetStorageBeforeConnectConfirmationPromptOpen}
      />
    </div>
  );
};

export default TermsAndConditionsPage;
