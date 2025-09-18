import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from '@hanzo/i18n';
import {
  type QuickConnectFormSchema,
  quickConnectFormSchema,
} from '@hanzo/node/forms/auth/quick-connection';
import { useInitialRegistration } from '@hanzo/node/v2/mutations/initialRegistration';
import { useGetEncryptionKeys } from '@hanzo/node/v2/queries/getEncryptionKeys';
import { useGetHealth } from '@hanzo/node/v2/queries/getHealth';
import { useGetWalletList } from '@hanzonet/wallet-hooks';
import {
  Button,
  type ButtonProps,
  buttonVariants,
  ErrorMessage,
  Form,
  FormField,
  TextField,
} from '@hanzo/ui';
import {
  submitRegistrationNoCodeError,
  submitRegistrationNoCodeNonPristineError,
} from '@hanzo/ui/helpers';
import { cn } from '@hanzo/ui/utils';
import { ArrowLeft, Key, Wallet } from 'lucide-react';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, type To, useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { OnboardingStep } from '../components/onboarding/constants';
import { useHanzoNodeEventsToast } from '../lib/hanzo-node-manager/hanzo-node-manager-hooks';
import { HOME_PATH } from '../routes/name';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';

export interface ConnectionOptionButtonProps extends ButtonProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ConnectionOptionButton = ({
  description,
  icon,
  title,
  className,
  ...props
}: ConnectionOptionButtonProps) => {
  return (
    <Button
      className={cn(
        'flex flex-1 cursor-pointer flex-col items-start gap-1 rounded-lg p-4 text-left',
        className,
      )}
      size="auto"
      variant="outline"
      {...props}
    >
      <div className="">{icon}</div>
      <p className="text-[15px] leading-none font-medium">{title}</p>
      <p className="text-text-secondary text-xs">{description}</p>
    </Button>
  );
};
const LOCAL_NODE_ADDRESS = 'http://127.0.0.1:9850';

const QuickConnectionPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const setAuth = useAuth((state) => state.setAuth);
  useHanzoNodeEventsToast();
  const { encryptionKeys } = useGetEncryptionKeys();
  const locationState = useLocation().state;
  const isHanzoPrivate = locationState?.connectionType === 'local';
  const [nodeAddress, setNodeAddress] = React.useState('');
  const [requiresAuth, setRequiresAuth] = React.useState(false);
  const [apiKey, setApiKey] = React.useState('');
  const [authMethod, setAuthMethod] = React.useState<'apikey' | 'wallet'>('apikey');

  const { nodeInfo, isSuccess: isNodeInfoSuccess, refetch: refetchHealth } = useGetHealth(
    { nodeAddress: nodeAddress || LOCAL_NODE_ADDRESS },
    { enabled: !!nodeAddress || isHanzoPrivate },
  );

  const completeStep = useSettings((state) => state.completeStep);

  const setupDataForm = useForm<QuickConnectFormSchema>({
    resolver: zodResolver(quickConnectFormSchema),
    defaultValues: {
      node_address: isHanzoPrivate
        ? LOCAL_NODE_ADDRESS
        : 'http://127.0.0.1:3690',
    },
  });

  const {
    isPending,
    isError,
    error,
    mutateAsync: submitRegistrationNoCode,
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
        completeStep(OnboardingStep.ANALYTICS, false);
        void navigate(HOME_PATH);
      } else if (response.status === 'non-pristine') {
        submitRegistrationNoCodeNonPristineError();
      } else {
        submitRegistrationNoCodeError();
      }
    },
  });

  async function onSubmit(currentValues: QuickConnectFormSchema) {
    // First, check if the node exists and its status
    setNodeAddress(currentValues.node_address);

    // Wait a moment for the health check to complete
    setTimeout(async () => {
      const healthResult = await refetchHealth();

      if (healthResult.data) {
        if (healthResult.data.is_pristine) {
          // Node is new/pristine, register without auth
          if (!encryptionKeys) return;
          await submitRegistrationNoCode({
            nodeAddress: currentValues.node_address,
            profileEncryptionPk: encryptionKeys.profile_encryption_pk,
            profileIdentityPk: encryptionKeys.profile_identity_pk,
          });
        } else {
          // Node exists and is locked, require authentication
          setRequiresAuth(true);
        }
      } else {
        toast.error('Unable to connect to node. Please check the address and try again.');
      }
    }, 500);
  }

  async function authenticateWithKey() {
    if (!apiKey) {
      toast.error('Please enter your API key');
      return;
    }

    // Authenticate with the existing node using the provided key
    setAuth({
      api_v2_key: apiKey,
      node_address: nodeAddress,
      profile: 'main',
      hanzo_identity: nodeInfo?.node_name || 'external-node',
      encryption_pk: '',
      identity_pk: '',
    });

    completeStep(OnboardingStep.TERMS_CONDITIONS, true);
    completeStep(OnboardingStep.ANALYTICS, false);
    toast.success('Connected to node successfully!');
    void navigate(HOME_PATH);
  }

  async function authenticateWithWallet() {
    // Navigate to the crypto wallet page with return context
    navigate('/settings/wallets', {
      state: {
        returnTo: '/quick-connection',
        authRequired: true,
        nodeAddress: nodeAddress,
        nodeInfo: nodeInfo,
        message: 'Please unlock your wallet to authenticate with the node'
      }
    });
  }

  useEffect(() => {
    if (isNodeInfoSuccess && isHanzoPrivate && nodeInfo?.is_pristine) {
      toast.loading(t('quickConnection.connectingToNode'), {
        id: 'auto-connect-hanzo-private',
      });
      void setupDataForm.handleSubmit(onSubmit)();
    }
  }, [isNodeInfoSuccess, isHanzoPrivate, nodeInfo, setupDataForm]);

  return (
    <div className="mx-auto flex size-full max-w-lg flex-col justify-between gap-8">
      <div className="flex flex-col">
        <div className="mb-4 flex items-center gap-2">
          <Link
            className={cn(
              buttonVariants({
                size: 'icon',
                variant: 'tertiary',
              }),
            )}
            to={-1 as To}
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-left text-2xl font-semibold">
            {t('quickConnection.label')} <span aria-hidden>⚡</span>
          </h1>
        </div>
        {!requiresAuth ? (
          <Form {...setupDataForm}>
            <form
              className="space-y-6"
              onSubmit={setupDataForm.handleSubmit(onSubmit)}
            >
              <div className="space-y-4">
                <FormField
                  control={setupDataForm.control}
                  name="node_address"
                  render={({ field }) => (
                    <TextField
                      field={field}
                      label={t('quickConnection.form.nodeAddress')}
                    />
                  )}
                />
                {isError && <ErrorMessage message={error.message} />}
              </div>
              <Button
                className="w-full"
                disabled={isPending}
                isLoading={isPending}
                type="submit"
                variant="default"
              >
                {t('quickConnection.form.connect')}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  This node is already initialized. Please authenticate to continue.
                </p>
              </div>

              {/* Authentication method selector */}
              <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  onClick={() => setAuthMethod('apikey')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all",
                    authMethod === 'apikey'
                      ? "bg-white dark:bg-gray-900 shadow-sm"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                >
                  <Key className="w-4 h-4" />
                  <span className="text-sm font-medium">API Key</span>
                </button>
                <button
                  onClick={() => setAuthMethod('wallet')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md transition-all",
                    authMethod === 'wallet'
                      ? "bg-white dark:bg-gray-900 shadow-sm"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700"
                  )}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-sm font-medium">Wallet File</span>
                </button>
              </div>

              {/* API Key input */}
              {authMethod === 'apikey' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your node API key"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  />
                </div>
              )}

              {/* Wallet authentication */}
              {authMethod === 'wallet' && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-start gap-3">
                      <Wallet className="w-5 h-5 mt-0.5 text-purple-500" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium">Authenticate with Hanzo Wallet</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Use your existing Hanzo wallet to securely authenticate with this node.
                          Your wallet credentials will be used to establish a secure connection.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={authenticateWithWallet}
                    variant="default"
                    className="w-full"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Open Wallet
                  </Button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {authMethod === 'apikey' && (
                <>
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => {
                      setRequiresAuth(false);
                      setApiKey('');
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={authenticateWithKey}
                    disabled={!apiKey}
                  >
                    Authenticate
                  </Button>
                </>
              )}
              {authMethod === 'wallet' && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setRequiresAuth(false);
                    setApiKey('');
                  }}
                >
                  Back
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-row justify-between gap-4">
        {/*<ConnectionOptionButton*/}
        {/*  className="h-32"*/}
        {/*  description={'Use the QR code to connect'}*/}
        {/*  icon={<QrCode className="text-text-secondary" />}*/}
        {/*  onClick={() => {*/}
        {/*    navigate('/connect-qr');*/}
        {/*  }}*/}
        {/*  title={'QR Code'}*/}
        {/*/>*/}

        <ConnectionOptionButton
          description={t('restoreConnection.description')}
          icon={
            <span aria-hidden className="text-base">
              🔑
            </span>
          }
          onClick={() => {
            void navigate('/restore');
          }}
          title={t('restoreConnection.restore')}
        />
      </div>
    </div>
  );
};

export default QuickConnectionPage;
