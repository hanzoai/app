import { zodResolver } from '@hookform/resolvers/zod';
import {
  type LocaleMode,
  localeOptions,
  useTranslation,
} from '@hanzo/i18n';
import { isHanzoIdentityLocalhost } from '@hanzo/message/utils/inbox_name_handler';
import { useSetMaxChatIterations } from '@hanzo/node/v2/mutations/setMaxChatIterations/useSetMaxChatIterations';
import { useUpdateNodeName } from '@hanzo/node/v2/mutations/updateNodeName/useUpdateNodeName';
import { useGetHealth } from '@hanzo/node/v2/queries/getHealth/useGetHealth';
import { useGetLLMProviders } from '@hanzo/node/v2/queries/getLLMProviders/useGetLLMProviders';
import { useGetPreferences } from '@hanzo/node/v2/queries/getPreferences/useGetPreferences';
import { useGetHanzoFreeModelQuota } from '@hanzo/node/v2/queries/getHanzoFreeModelQuota/useGetHanzoFreeModelQuota';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardContent,
  CardFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  TextField,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hanzo/ui';
import { useDebounce } from '@hanzo/ui/hooks';
import { cn } from '@hanzo/ui/utils';
import { getVersion } from '@tauri-apps/api/app';
import { formatDuration, intervalToDuration } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ExternalLinkIcon,
  InfoIcon,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FeedbackModal } from '../components/feedback/feedback-modal';
import { OnboardingStep } from '../components/onboarding/constants';
import {
  useHanzoNodeGetOllamaVersionQuery,
  useHanzoNodeRespawnMutation,
} from '../lib/hanzo-node-manager/hanzo-node-manager-client';
import { isHostingHanzoNode } from '../lib/hanzo-node-manager/hanzo-node-manager-windows-utils';
import {
  useCheckUpdateQuery,
  useDownloadUpdateMutation,
  useUpdateStateQuery,
} from '../lib/updater/updater-client';
import { type Auth, useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useHanzoNodeManager } from '../store/hanzo-node-manager';
import { SimpleLayout } from './layout/simple-layout';
import { RemoteUIToggle } from '../components/remote-ui-toggle';

const formSchema = z.object({
  defaultAgentId: z.string(),
  displayActionButton: z.boolean(),
  nodeAddress: z.string(),
  hanzoIdentity: z.string(),
  nodeVersion: z.string(),
  ollamaVersion: z.string(),
  optInAnalytics: z.boolean(),
  optInExperimental: z.boolean(),
  language: z.string(),
  maxChatIterations: z.number(),
  chatFontSize: z.enum(['xs', 'sm', 'base', 'lg']),
});

type FormSchemaType = z.infer<typeof formSchema>;

const MotionButton = motion(Button);

const SettingsPage = () => {
  const { t } = useTranslation();
  const auth = useAuth((authStore) => authStore.auth);
  const isLocalHanzoNodeInUse = useHanzoNodeManager((state) => state.isInUse);
  const userLanguage = useSettings((state) => state.userLanguage);
  const setUserLanguage = useSettings((state) => state.setUserLanguage);
  const optInAnalytics = useSettings((state) =>
    state.getStepChoice(OnboardingStep.ANALYTICS),
  );
  const optInExperimental = useSettings((state) => state.optInExperimental);
  const setOptInExperimental = useSettings(
    (state) => state.setOptInExperimental,
  );

  const setAuth = useAuth((authStore) => authStore.setAuth);

  const defaultAgentId = useSettings(
    (settingsStore) => settingsStore.defaultAgentId,
  );
  const setDefaultAgentId = useSettings(
    (settingsStore) => settingsStore.setDefaultAgentId,
  );

  const { nodeInfo, isSuccess: isNodeInfoSuccess } = useGetHealth({
    nodeAddress: auth?.node_address ?? '',
  });

  const { mutateAsync: setMaxChatIterationsMutation } = useSetMaxChatIterations(
    {
      onSuccess: (_data) => {
        toast.success(t('settings.maxChatIterations.success'));
      },
      onError: (error) => {
        toast.error(t('settings.maxChatIterations.error'), {
          description: error?.message,
        });
        form.setValue('maxChatIterations', preferences?.max_iterations ?? 10);
      },
    },
  );
  const { data: preferences } = useGetPreferences({
    nodeAddress: auth?.node_address ?? '',
    token: auth?.api_v2_key ?? '',
  });
  const [appVersion, setAppVersion] = useState('');

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      defaultAgentId: defaultAgentId,
      nodeAddress: auth?.node_address,
      hanzoIdentity: auth?.hanzo_identity,
      ollamaVersion: '',
      optInAnalytics: !!optInAnalytics,
      optInExperimental,
      language: userLanguage,
    },
  });

  const currentDefaultAgentId = useWatch({
    control: form.control,
    name: 'defaultAgentId',
  });

  const currentOptInExperimental = useWatch({
    control: form.control,
    name: 'optInExperimental',
  });
  const currentLanguage = useWatch({
    control: form.control,
    name: 'language',
  });

  const currentMaxChatIterations = useWatch({
    control: form.control,
    name: 'maxChatIterations',
  });

  const debouncedMaxChatIterations = useDebounce(
    currentMaxChatIterations?.toString() ?? '',
    1000,
  );

  useEffect(() => {
    void (async () => {
      setAppVersion(await getVersion());
    })();
  }, []);

  useEffect(() => {
    setUserLanguage(currentLanguage as LocaleMode);
  }, [currentLanguage, setUserLanguage]);

  useEffect(() => {
    setOptInExperimental(currentOptInExperimental);
  }, [currentOptInExperimental, setOptInExperimental]);

  useEffect(() => {
    if (preferences) {
      form.setValue('maxChatIterations', preferences.max_iterations ?? 10);
    }
  }, [preferences, form]);

  useEffect(() => {
    if (!preferences) return;
    const currentFormValue = form.getValues('maxChatIterations');
    const currentBackendValue = preferences.max_iterations ?? 10;
    if (currentFormValue === currentBackendValue) return; // Avoid unnecessary update at startup
    const newMaxIterations = parseInt(debouncedMaxChatIterations, 10);
    if (!debouncedMaxChatIterations || isNaN(newMaxIterations)) return;

    if (newMaxIterations !== currentBackendValue) {
      void setMaxChatIterationsMutation({
        nodeAddress: auth?.node_address ?? '',
        token: auth?.api_v2_key ?? '',
        maxIterations: newMaxIterations,
      });
    }
  }, [
    debouncedMaxChatIterations,
    preferences,
    auth,
    setMaxChatIterationsMutation,
    form,
  ]);

  const { llmProviders } = useGetLLMProviders({
    nodeAddress: auth?.node_address ?? '',
    token: auth?.api_v2_key ?? '',
  });

  const { data: ollamaVersion } = useHanzoNodeGetOllamaVersionQuery();
  useEffect(() => {
    form.setValue('ollamaVersion', ollamaVersion ?? '');
  }, [ollamaVersion, form]);

  const { data: updateState } = useUpdateStateQuery();
  const { refetch: checkForUpdates, isFetching: isCheckingUpdates } =
    useCheckUpdateQuery({
      enabled: false,
    });
  const { mutateAsync: downloadUpdate, isPending: isDownloadingUpdate } =
    useDownloadUpdateMutation({
      onSuccess: () => {
        toast.success(
          'Update downloaded successfully! The app will restart now.',
        );
      },
      onError: (error) => {
        toast.error('Failed to download update', {
          description: error?.message,
        });
      },
    });

  const { data: hanzoFreeModelQuota } = useGetHanzoFreeModelQuota(
    { nodeAddress: auth?.node_address ?? '', token: auth?.api_v2_key ?? '' },
    { enabled: !!auth },
  );

  const { mutateAsync: respawnHanzoNode } = useHanzoNodeRespawnMutation();
  const { mutateAsync: updateNodeName, isPending: isUpdateNodeNamePending } =
    useUpdateNodeName({
      onSuccess: async () => {
        toast.success(t('settings.hanzoIdentity.success'));
        if (!auth) return;
        const newAuth: Auth = { ...auth };
        setAuth({
          ...newAuth,
          hanzo_identity: currentHanzoIdentity,
        });
        if (isLocalHanzoNodeInUse) {
          await respawnHanzoNode();
        } else if (!isHostingHanzoNode(auth.node_address)) {
          toast.info(t('hanzoNode.restartNode'));
        }
      },
      onError: (error) => {
        toast.error(t('settings.hanzoIdentity.error'), {
          description: error?.response?.data?.error
            ? error?.response?.data?.error +
              ': ' +
              error?.response?.data?.message
            : error.message,
        });
      },
    });

  useEffect(() => {
    if (isNodeInfoSuccess) {
      form.setValue('nodeVersion', nodeInfo?.version ?? '');
      form.setValue('hanzoIdentity', nodeInfo?.node_name ?? '');
    }
  }, [form, isNodeInfoSuccess, nodeInfo?.node_name, nodeInfo?.version]);

  const currentHanzoIdentity = useWatch({
    control: form.control,
    name: 'hanzoIdentity',
  });
  const handleUpdateNodeName = async () => {
    if (!auth) return;
    await updateNodeName({
      nodeAddress: auth?.node_address ?? '',
      token: auth?.api_v2_key ?? '',
      newNodeName: form.getValues().hanzoIdentity,
    });
  };

  useEffect(() => {
    setDefaultAgentId(currentDefaultAgentId);
  }, [currentDefaultAgentId, setDefaultAgentId]);

  const isIdentityLocalhost = isHanzoIdentityLocalhost(
    auth?.hanzo_identity ?? '',
  );

  return (
    <SimpleLayout classname="max-w-2xl" title={t('settings.layout.general')}>
      <div className="mb-6 flex items-center justify-between">
        <p>{t('settings.description')}</p>
        <FeedbackModal />
      </div>
      <div className="flex flex-col space-y-8 pr-2.5">
        <div className="flex flex-col space-y-8">
          {hanzoFreeModelQuota && (
            <div className="bg-bg-secondary space-y-4 rounded-lg p-4">
              <div>
                <h2 className="text-text-default text-base font-semibold">
                  Usage
                </h2>
                <p className="text-text-secondary text-sm">
                  Monitor your AI usage
                </p>
              </div>
              <Card className="w-full border-none p-0">
                <CardContent className="space-y-2 p-0 py-2">
                  <div className="flex justify-between text-sm">
                    <h3 className="text-base font-semibold">
                      Free Hanzo AI Usage
                    </h3>

                    <div className="flex items-center gap-1">
                      <span>Total tokens used: </span>
                      <span className="text-text-default text-xs">
                        {hanzoFreeModelQuota.usedTokens.toLocaleString()}{' '}
                        <span className="text-text-tertiary text-xs">
                          / {hanzoFreeModelQuota.tokensQuota.toLocaleString()}
                        </span>
                      </span>
                      <Tooltip>
                        <TooltipTrigger>
                          <InfoIcon className="size-3 text-current" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            A token is a chunk of text — it can be a word, part
                            of a word, or even punctuation. AI processes text in
                            tokens, and usage is measured by how many tokens are
                            used. <br /> <br /> Based on your current usage, you
                            have approximately{' '}
                            {Math.floor(
                              (hanzoFreeModelQuota.tokensQuota -
                                hanzoFreeModelQuota.usedTokens) /
                                2,
                            )}{' '}
                            messages remaining.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <Progress
                    className="h-2 rounded-full bg-cyan-900 [&>div]:bg-cyan-400"
                    max={100}
                    value={
                      hanzoFreeModelQuota?.tokensQuota
                        ? Math.min(
                            100,
                            (hanzoFreeModelQuota.usedTokens /
                              hanzoFreeModelQuota.tokensQuota) *
                              100,
                          )
                        : 0
                    }
                  />
                </CardContent>

                <CardFooter className="p-0">
                  <span className="text-text-default text-xs">
                    Your free limit resets in{' '}
                    {formatDuration(
                      intervalToDuration({
                        start: 0,
                        end: hanzoFreeModelQuota?.resetTime * 60 * 1000,
                      }),
                    )}
                  </span>
                </CardFooter>
              </Card>
            </div>
          )}

          <div className="bg-bg-secondary space-y-4 rounded-lg p-4">
            <div>
              <h2 className="text-text-default text-base font-semibold">
                Preferences
              </h2>
              <p className="text-text-secondary text-sm">
                Customize language, AI models, and application behavior
              </p>
            </div>
            <Form {...form}>
              <form className="flex grow flex-col justify-between space-y-6 overflow-hidden">
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('settings.language.label')}</FormLabel>
                      <Select
                        defaultValue={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t(
                                'settings.language.selectLanguage',
                              )}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[
                            {
                              label: 'Automatic',
                              value: 'auto',
                            },
                            ...localeOptions,
                          ].map((locale) => (
                            <SelectItem key={locale.value} value={locale.value}>
                              {locale.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormItem>
                  <Select
                    defaultValue={defaultAgentId}
                    name="defaultAgentId"
                    onValueChange={(value) => {
                      form.setValue('defaultAgentId', value);
                    }}
                    value={
                      llmProviders?.find((agent) => agent.id === defaultAgentId)
                        ?.id
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <FormLabel>{t('settings.defaultAgent')}</FormLabel>
                    <SelectContent>
                      {llmProviders?.map((llmProvider) => (
                        <SelectItem key={llmProvider.id} value={llmProvider.id}>
                          {llmProvider.name || llmProvider.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              </form>
            </Form>
          </div>

          <div className="bg-bg-secondary space-y-4 rounded-lg p-4">
            <div>
              <h2 className="text-text-default text-base font-semibold">
                Hanzo Node Configuration
              </h2>
              <p className="text-text-secondary text-sm">
                Configure your Hanzo node connection and identity settings
              </p>
            </div>
            <Form {...form}>
              <form className="flex grow flex-col justify-between space-y-6 overflow-hidden">
                <div className="divide-divider flex flex-col divide-y">
                  {[
                    {
                      label: t('hanzoNode.nodeAddress'),
                      value: auth?.node_address,
                    },
                    {
                      label: t('hanzoNode.nodeVersion'),
                      value: nodeInfo?.version,
                    },
                    {
                      label: t('ollama.version'),
                      value: ollamaVersion ?? '-',
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-1 py-3"
                    >
                      <span className="text-text-secondary text-sm">
                        {item.label}
                      </span>
                      <span className="text-text-default font-mono text-sm">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <FormField
                    control={form.control}
                    name="hanzoIdentity"
                    render={({ field }) => (
                      <TextField
                        field={{
                          ...field,
                          onKeyDown: (event) => {
                            if (currentHanzoIdentity === auth?.hanzo_identity)
                              return;
                            if (event.key === 'Enter') {
                              void handleUpdateNodeName();
                            }
                          },
                        }}
                        helperMessage={
                          <span className="flex items-center justify-start gap-3">
                            <span className="text-text-secondary hover:text-text-default inline-flex items-center gap-1 px-1 py-2.5">
                              {isIdentityLocalhost ? (
                                <a
                                  className={cn(
                                    buttonVariants({
                                      size: 'auto',
                                      variant: 'link',
                                    }),
                                    'rounded-lg p-0 text-xs text-inherit underline',
                                  )}
                                  href={`https://hanzo-contracts.pages.dev?encryption_pk=${auth?.encryption_pk}&signature_pk=${auth?.identity_pk}&node_address=${auth?.node_address}`}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {t('settings.hanzoIdentity.registerIdentity')}
                                </a>
                              ) : (
                                <a
                                  className={cn(
                                    buttonVariants({
                                      size: 'auto',
                                      variant: 'link',
                                    }),
                                    'rounded-lg p-0 text-xs text-inherit underline',
                                  )}
                                  href={`https://hanzo-contracts.pages.dev/identity/${auth?.hanzo_identity?.replace(
                                    '@@',
                                    '',
                                  )}`}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  {t(
                                    'settings.hanzoIdentity.goToHanzoIdentity',
                                  )}
                                </a>
                              )}
                              <ExternalLinkIcon className="h-4 w-4" />
                            </span>
                            <a
                              className={cn(
                                buttonVariants({
                                  size: 'auto',
                                  variant: 'link',
                                }),
                                'text-text-secondary hover:text-text-default rounded-lg p-0 text-xs underline',
                              )}
                              href="https://docs.hanzo.com/advanced/hanzo-identity-troubleshooting"
                              rel="noreferrer"
                              target="_blank"
                            >
                              {t(
                                'settings.hanzoIdentity.troubleRegisterIdentity',
                              )}
                            </a>
                          </span>
                        }
                        label={t('settings.hanzoIdentity.label')}
                      />
                    )}
                  />
                  {currentHanzoIdentity !== auth?.hanzo_identity && (
                    <div className="space-y-1.5">
                      <p className="text-text-tertiary flex items-center gap-1 text-xs">
                        <InfoIcon className="size-3" />
                        {t('settings.hanzoIdentity.saveWillRestartApp')}
                      </p>
                      <div className="flex items-center gap-3">
                        <MotionButton
                          className="h-10 min-w-[100px] rounded-lg text-sm"
                          isLoading={isUpdateNodeNamePending}
                          layout
                          onClick={handleUpdateNodeName}
                          size="auto"
                          type="button"
                        >
                          {t('common.save')}
                        </MotionButton>
                        <Button
                          className="h-10 min-w-10 rounded-lg text-sm"
                          onClick={() => {
                            form.setValue(
                              'hanzoIdentity',
                              auth?.hanzo_identity ?? '',
                            );
                          }}
                          type="button"
                          variant="outline"
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isIdentityLocalhost && (
                    <a
                      className={cn(
                        buttonVariants({
                          size: 'auto',
                          variant: 'tertiary',
                        }),
                        'flex cursor-pointer items-start justify-start gap-2 rounded-lg text-xs',
                      )}
                      href={`https://hanzo-contracts.pages.dev/identity/${auth?.hanzo_identity?.replace(
                        '@@',
                        '',
                      )}?encryption_pk=${auth?.encryption_pk}&signature_pk=${auth?.identity_pk}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ShieldCheck className="h-5 w-5" />
                      <span className="flex flex-col gap-0.5">
                        <span className="capitalize">
                          {t('settings.hanzoIdentity.checkIdentityInSync')}
                        </span>
                        <span className="text-text-tertiary">
                          {t(
                            'settings.hanzoIdentity.checkIdentityInSyncDescription',
                          )}
                        </span>
                      </span>
                    </a>
                  )}
                </div>
              </form>
            </Form>
          </div>

          <div className="bg-bg-secondary space-y-4 rounded-lg p-4">
            <div>
              <h2 className="text-text-default text-base font-semibold">
                Advanced Settings
              </h2>
              <p className="text-text-secondary text-sm">
                Configure advanced features and experimental options
              </p>
            </div>
            <Form {...form}>
              <form className="flex grow flex-col justify-between space-y-6 overflow-hidden">
                <FormField
                  control={form.control}
                  name="maxChatIterations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('settings.maxChatIterations.label')}
                      </FormLabel>
                      <FormControl>
                        <TextField
                          field={{ ...field, value: field.value ?? '' }}
                          helperMessage={t(
                            'settings.maxChatIterations.description',
                          )}
                          label={t('settings.maxChatIterations.label')}
                          max={100}
                          min={1}
                          type="number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="optInExperimental"
                  render={({ field }) => (
                    <FormItem className="flex gap-2.5">
                      <FormControl>
                        <Switch
                          aria-readonly
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=unchecked]:bg-gray-400"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-text-default static space-y-1.5 text-sm">
                          {t('settings.experimentalFeature.label')}
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>

          <div className="bg-bg-secondary space-y-4 rounded-lg p-4">
            <div>
              <h2 className="text-text-default text-base font-semibold">Remote Control</h2>
              <p className="text-text-secondary text-sm">
                Enable the Remote UI server for Playwright or MCP control.
              </p>
            </div>
            <RemoteUIToggle />
          </div>

          <div className="bg-bg-secondary mb-10 space-y-4 rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-text-default flex items-center gap-2 text-base font-semibold">
                  Updates
                </h2>

                <p className="text-text-secondary text-sm">
                  Manage application updates and version information.
                </p>
              </div>
              <Button
                disabled={isCheckingUpdates}
                onClick={() => checkForUpdates()}
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isCheckingUpdates ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check for Updates
                  </>
                )}
              </Button>
            </div>

            <div className="divide-divider flex flex-col gap-1 divide-y text-sm">
              <div className="flex items-center justify-between gap-1 py-3">
                <span className="text-text-secondary text-sm">
                  Current Hanzo App Version
                </span>
                <span className="text-text-default font-mono text-sm">
                  {appVersion}
                </span>
              </div>

              <div className="space-y-5 p-2">
                {updateState?.update?.available && (
                  <div className="flex items-center justify-between gap-2">
                    {updateState?.update?.available && (
                      <Badge className="flex items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-sm font-semibold text-cyan-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                        New version available: {updateState.update.version}
                      </Badge>
                    )}
                    <Button
                      disabled={
                        isDownloadingUpdate ||
                        updateState.state === 'downloading'
                      }
                      onClick={() => downloadUpdate()}
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      {isDownloadingUpdate ||
                      updateState.state === 'downloading' ? (
                        <>Downloading...</>
                      ) : (
                        <>Install Update</>
                      )}
                    </Button>
                  </div>
                )}

                {updateState?.state === 'downloading' &&
                  updateState.downloadState && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          Downloading update...
                        </span>
                        <span>
                          {updateState.downloadState.data
                            ?.downloadProgressPercent || 0}
                          %
                        </span>
                      </div>
                      <Progress
                        className="h-2 w-full rounded-lg bg-cyan-900 [&>div]:bg-cyan-400"
                        value={
                          updateState.downloadState.data
                            ?.downloadProgressPercent || 0
                        }
                      />
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SimpleLayout>
  );
};

export default SettingsPage;
