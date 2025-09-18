import './globals.css';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSyncOllamaModels } from '@hanzo/node/v2/mutations/syncOllamaModels/useSyncOllamaModels';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Form,
  FormField,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hanzo/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { info } from '@tauri-apps/plugin-log';
import {
  Bot,
  Cpu,
  Database,
  HardDrive,
  ListRestart,
  Loader2,
  Network,
  PlayCircle,
  Settings,
  StopCircle,
  Trash,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import logo from '../../../src-tauri/icons/128x128@2x.png';
import { OllamaModels } from '../../components/hanzo-node-manager/ollama-models';
import { ALLOWED_OLLAMA_MODELS } from '../../lib/hanzo-node-manager/ollama-models';
import { detectSystem, type SystemInfo } from '../../lib/hardware-detection';
import { INFERENCE_ENGINES, getEnginesForPlatform } from '../../lib/hanzo-node-manager/inference-engines';
import { EMBEDDING_MODELS } from '../../lib/hanzo-node-manager/embedding-models';
import { ALL_MODELS as HANZO_MODELS, canRunModel } from '../../lib/hanzo-node-manager/hanzo-models';
import {
  hanzoNodeQueryClient,
  useHanzoNodeGetOptionsQuery,
  useHanzoNodeIsRunningQuery,
  useHanzoNodeKillMutation,
  useHanzoNodeRemoveStorageMutation,
  useHanzoNodeSetDefaultOptionsMutation,
  useHanzoNodeSetOptionsMutation,
  useHanzoNodeSpawnMutation,
} from '../../lib/hanzo-node-manager/hanzo-node-manager-client';
import { type HanzoNodeOptions } from '../../lib/hanzo-node-manager/hanzo-node-manager-client-types';
import { useHanzoNodeEventsToast } from '../../lib/hanzo-node-manager/hanzo-node-manager-hooks';
import {
  errorOllamaModelsSyncToast,
  errorRemovingHanzoNodeStorageToast,
  hanzoNodeStartedToast,
  hanzoNodeStartErrorToast,
  hanzoNodeStopErrorToast,
  hanzoNodeStoppedToast,
  startingHanzoNodeToast,
  stoppingHanzoNodeToast,
  successOllamaModelsSyncToast,
  successRemovingHanzoNodeStorageToast,
  successHanzoNodeSetDefaultOptionsToast,
} from '../../lib/hanzo-node-manager/hanzo-node-manager-toasts-utils';
import { useAuth } from '../../store/auth';
import { useHanzoNodeManager } from '../../store/hanzo-node-manager';
import { useSyncStorageSecondary } from '../../store/sync-utils';
import { Logs } from './components/logs';

const App = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>('hanzo-engine');
  const [selectedEmbedding, setSelectedEmbedding] = useState<string>('bge-small-en');

  useEffect(() => {
    void info('initializing hanzo-node-manager');
    // Detect hardware on load
    detectSystem().then(setSystemInfo);
  }, []);
  useSyncStorageSecondary();
  const auth = useAuth((auth) => auth.auth);
  const setLogout = useAuth((auth) => auth.setLogout);
  const { setHanzoNodeOptions } = useHanzoNodeManager();
  const [isConfirmResetDialogOpened, setIsConfirmResetDialogOpened] =
    useState<boolean>(false);
  const { data: hanzoNodeIsRunning } = useHanzoNodeIsRunningQuery({
    refetchInterval: 1000,
  });
  const { data: hanzoNodeOptions } = useHanzoNodeGetOptionsQuery({
    refetchInterval: 1000,
  });

  const { isPending: hanzoNodeSpawnIsPending, mutateAsync: hanzoNodeSpawn } =
    useHanzoNodeSpawnMutation({
      onMutate: () => {
        startingHanzoNodeToast();
      },
      onSuccess: () => {
        hanzoNodeStartedToast();
      },
      onError: () => {
        hanzoNodeStartErrorToast();
      },
    });
  const { isPending: hanzoNodeKillIsPending, mutateAsync: hanzoNodeKill } =
    useHanzoNodeKillMutation({
      onMutate: () => {
        stoppingHanzoNodeToast();
      },
      onSuccess: () => {
        hanzoNodeStoppedToast();
      },
      onError: () => {
        hanzoNodeStopErrorToast();
      },
    });
  const {
    isPending: hanzoNodeRemoveStorageIsPending,
    mutateAsync: hanzoNodeRemoveStorage,
  } = useHanzoNodeRemoveStorageMutation({
    onSuccess: async () => {
      successRemovingHanzoNodeStorageToast();
      setHanzoNodeOptions(null);
      setLogout();
    },
    onError: () => {
      errorRemovingHanzoNodeStorageToast();
    },
  });
  const { mutateAsync: hanzoNodeSetOptions } = useHanzoNodeSetOptionsMutation({
    onSuccess: (options) => {
      setHanzoNodeOptions(options);
    },
  });
  const { mutateAsync: hanzoNodeSetDefaultOptions } =
    useHanzoNodeSetDefaultOptionsMutation({
      onSuccess: (options) => {
        hanzoNodeOptionsForm.reset(options);
        successHanzoNodeSetDefaultOptionsToast();
      },
    });
  const hanzoNodeOptionsForm = useForm<Partial<HanzoNodeOptions>>({
    resolver: zodResolver(z.any()),
  });
  const hanzoNodeOptionsFormWatch = useWatch({
    control: hanzoNodeOptionsForm.control,
  });
  const {
    mutateAsync: syncOllamaModels,
    isPending: syncOllamaModelsIsPending,
  } = useSyncOllamaModels({
    onSuccess: () => {
      successOllamaModelsSyncToast();
    },
    onError: () => {
      errorOllamaModelsSyncToast();
    },
  });

  useHanzoNodeEventsToast();

  useEffect(() => {
    const options = {
      ...hanzoNodeOptions,
      ...hanzoNodeOptionsFormWatch,
    };
    void hanzoNodeSetOptions(options as HanzoNodeOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hanzoNodeOptionsFormWatch, hanzoNodeSetOptions]);

  const handleReset = (): void => {
    setIsConfirmResetDialogOpened(false);
    void hanzoNodeRemoveStorage({ preserveKeys: true });
  };

  const startSyncOllamaModels = async () => {
    await syncOllamaModels({
      nodeAddress: auth?.node_address ?? '',
      token: auth?.api_v2_key ?? '',
      allowedModels: ALLOWED_OLLAMA_MODELS,
    });
  };

  const [hanzoNodeOptionsForUI, setHanzoNodeOptionsForUI] =
    useState<Partial<HanzoNodeOptions>>();

  useEffect(() => {
    const filteredHanzoNodeOptionsKeys: (keyof HanzoNodeOptions)[] = [
      'secret_desktop_installation_proof_key',
    ];
    setHanzoNodeOptionsForUI(
      Object.fromEntries(
        Object.entries(hanzoNodeOptions ?? {}).filter(
          ([key]) =>
            !filteredHanzoNodeOptionsKeys.includes(
              key as keyof HanzoNodeOptions,
            ),
        ),
      ) as Partial<HanzoNodeOptions>,
    );
  }, [hanzoNodeOptions]);

  return (
    <div className="flex h-screen w-full flex-col space-y-2">
      <div
        className="absolute top-0 z-50 h-6 w-full"
        data-tauri-drag-region={true}
      />
      <div className="flex flex-row items-center p-4">
        <img alt="hanzo logo" className="h-10 w-10" src={logo} />
        <div className="ml-4 flex flex-col">
          <span className="text-lg">Local Hanzo Node</span>
          <span className="text-text-secondary text-sm">{`API URL: http://${hanzoNodeOptions?.node_api_ip}:${hanzoNodeOptions?.node_api_port}`}</span>
        </div>
        <div className="flex grow flex-row items-center justify-end space-x-4">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  disabled={
                    hanzoNodeSpawnIsPending ||
                    hanzoNodeKillIsPending ||
                    hanzoNodeIsRunning
                  }
                  onClick={() => {
                    console.log('spawning');
                    void hanzoNodeSpawn();
                  }}
                  variant={'default'}
                >
                  {hanzoNodeSpawnIsPending || hanzoNodeKillIsPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <PlayCircle className="" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Start Hanzo Node</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  disabled={
                    hanzoNodeSpawnIsPending ||
                    hanzoNodeKillIsPending ||
                    !hanzoNodeIsRunning
                  }
                  onClick={() => hanzoNodeKill()}
                  variant={'default'}
                >
                  {hanzoNodeKillIsPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <StopCircle className="" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Stop Hanzo Node</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  disabled={hanzoNodeIsRunning}
                  onClick={() => setIsConfirmResetDialogOpened(true)}
                  variant={'default'}
                >
                  {hanzoNodeRemoveStorageIsPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Trash className="" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Reset Hanzo Node</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  disabled={!hanzoNodeIsRunning}
                  onClick={() => startSyncOllamaModels()}
                  variant={'default'}
                >
                  {syncOllamaModelsIsPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Bot className="" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Sync Ollama Models</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <Tabs
        className="mt-4 flex h-full w-full flex-col overflow-hidden p-4"
        defaultValue="hardware"
      >
        <TabsList className="w-full">
          <TabsTrigger className="grow" value="hardware">
            <Cpu className="mr-1 h-4 w-4" />
            Hardware
          </TabsTrigger>
          <TabsTrigger className="grow" value="models">
            <Bot className="mr-1 h-4 w-4" />
            Models
          </TabsTrigger>
          <TabsTrigger className="grow" value="engines">
            <Zap className="mr-1 h-4 w-4" />
            Engines
          </TabsTrigger>
          <TabsTrigger className="grow" value="embeddings">
            <Database className="mr-1 h-4 w-4" />
            Embeddings
          </TabsTrigger>
          <TabsTrigger className="grow" value="network">
            <Network className="mr-1 h-4 w-4" />
            Network
          </TabsTrigger>
          <TabsTrigger className="grow" value="options">
            <Settings className="mr-1 h-4 w-4" />
            Options
          </TabsTrigger>
          <TabsTrigger className="grow" value="app-logs">
            <HardDrive className="mr-1 h-4 w-4" />
            Logs
          </TabsTrigger>
        </TabsList>
        {/* Hardware Tab */}
        <TabsContent className="h-full overflow-hidden" value="hardware">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              {systemInfo && (
                <>
                  {/* System Overview */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold">System Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Platform</span>
                        <p className="font-medium capitalize">{systemInfo.platform}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">CPU Cores</span>
                        <p className="font-medium">{systemInfo.cores}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">System Memory</span>
                        <p className="font-medium">{systemInfo.memory}GB RAM</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Available Memory</span>
                        <p className="font-medium">{(systemInfo.memory * 0.7).toFixed(1)}GB</p>
                      </div>
                    </div>
                  </div>

                  {/* GPU Information */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold">GPU Information</h3>
                    {systemInfo.gpu.available ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm text-muted-foreground">Vendor</span>
                            <p className="font-medium">{systemInfo.gpu.vendor || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-sm text-muted-foreground">VRAM</span>
                            <p className="font-medium">{((systemInfo.gpu.vram || 0) / 1024).toFixed(1)}GB</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Renderer</span>
                          <p className="font-medium text-xs">{systemInfo.gpu.renderer || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Capabilities</span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {systemInfo.gpu.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium uppercase"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No GPU detected</p>
                    )}
                  </div>

                  {/* Supported Engines */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold">Supported Inference Engines</h3>
                    <div className="flex flex-wrap gap-2">
                      {systemInfo.supportedEngines.map((engine) => (
                        <span
                          key={engine}
                          className="rounded-md bg-green-500/10 px-3 py-1 text-sm font-medium text-green-400"
                        >
                          {engine}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Models */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold">Recommended Models for Your Hardware</h3>
                    <div className="space-y-2">
                      {HANZO_MODELS
                        .filter((model) => {
                          const check = canRunModel(model.size, systemInfo);
                          return check.canRun && !check.warning;
                        })
                        .slice(0, 5)
                        .map((model) => {
                          const runCheck = canRunModel(model.size, systemInfo);
                          return (
                            <div key={model.id} className="flex items-center justify-between rounded-lg border border-border/50 p-2">
                              <div>
                                <p className="font-medium">{model.name}</p>
                                <p className="text-xs text-muted-foreground">{model.size}GB</p>
                              </div>
                              {runCheck.warning && (
                                <span className="text-xs text-yellow-500">{runCheck.warning}</span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent className="h-full overflow-hidden" value="app-logs">
          <Logs />
        </TabsContent>
        <TabsContent className="h-full overflow-hidden" value="options">
          <ScrollArea className="flex h-full flex-1 flex-col overflow-auto [&>div>div]:!block">
            <div className="flex flex-row justify-end pr-4">
              <Button
                className=""
                disabled={hanzoNodeIsRunning}
                onClick={() => hanzoNodeSetDefaultOptions()}
                variant={'default'}
              >
                <ListRestart className="mr-2" />
                Restore default
              </Button>
            </div>
            <div className="mt-2 h-full [&>div>div]:!block">
              <Form {...hanzoNodeOptionsForm}>
                <form className="space-y-2 pr-4">
                  {hanzoNodeOptionsForUI &&
                    Object.entries(hanzoNodeOptionsForUI).map(
                      ([key, value]) => {
                        return (
                          <FormField
                            control={hanzoNodeOptionsForm.control}
                            defaultValue={value}
                            disabled={hanzoNodeIsRunning}
                            key={key}
                            name={key as keyof HanzoNodeOptions}
                            render={({ field }) => (
                              <TextField
                                field={field}
                                label={<span className="uppercase">{key}</span>}
                              />
                            )}
                          />
                        );
                      },
                    )}
                </form>
              </Form>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent className="h-full overflow-hidden pb-2" value="models">
          <OllamaModels />
        </TabsContent>

        {/* Inference Engines Tab */}
        <TabsContent className="h-full overflow-hidden" value="engines">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Select Inference Engine</h3>
                <p className="text-sm text-muted-foreground">
                  Choose the backend engine for running models locally
                </p>
              </div>

              <div className="grid gap-4">
                {(systemInfo ? getEnginesForPlatform(systemInfo.platform) : INFERENCE_ENGINES).map((engine) => (
                  <div
                    key={engine.id}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      selectedEngine === engine.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedEngine(engine.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{engine.icon}</span>
                          <h4 className="text-lg font-semibold">{engine.name}</h4>
                          {engine.defaultEngine && (
                            <span className="rounded-md bg-primary/20 px-2 py-0.5 text-xs font-medium">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{engine.description}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-md bg-background px-2 py-1 text-xs">
                            Speed: <span className="font-medium">{engine.performance}</span>
                          </span>
                          <span className="rounded-md bg-background px-2 py-1 text-xs">
                            Memory: <span className="font-medium">{engine.memory}</span>
                          </span>
                        </div>

                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground">Features:</p>
                          <ul className="mt-1 grid grid-cols-2 gap-1">
                            {engine.features.slice(0, 4).map((feature, idx) => (
                              <li key={idx} className="text-xs text-muted-foreground">• {feature}</li>
                            ))}
                          </ul>
                        </div>

                        {engine.requirements.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-yellow-600">Requirements:</p>
                            <p className="text-xs text-yellow-600/80">{engine.requirements.join(', ')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Embeddings Tab */}
        <TabsContent className="h-full overflow-hidden" value="embeddings">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Embedding Models</h3>
                <p className="text-sm text-muted-foreground">
                  Vector models for search and RAG applications
                </p>
              </div>

              <div className="grid gap-3">
                {EMBEDDING_MODELS.map((model) => (
                  <div
                    key={model.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-all ${
                      selectedEmbedding === model.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedEmbedding(model.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{model.name}</h4>
                          {model.recommended && (
                            <span className="rounded-md bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{model.description}</p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-md bg-background px-2 py-0.5 text-xs">
                            Dims: <span className="font-medium">{model.dimensions}</span>
                          </span>
                          <span className="rounded-md bg-background px-2 py-0.5 text-xs">
                            Context: <span className="font-medium">{model.contextLength}</span>
                          </span>
                          <span className="rounded-md bg-background px-2 py-0.5 text-xs">
                            Size: <span className="font-medium">{model.size}GB</span>
                          </span>
                          <span className="rounded-md bg-background px-2 py-0.5 text-xs">
                            Speed: <span className="font-medium">{model.performance}</span>
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{model.provider}</span>
                          {systemInfo && !canRunModel(model.size, systemInfo).canRun && (
                            <span className="text-xs text-red-500">Insufficient memory</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Network Mining Tab */}
        <TabsContent className="h-full overflow-hidden" value="network">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-3 text-lg font-semibold">Network Mining</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Commit your resources to the Hanzo network and earn rewards
                </p>

                <div className="space-y-4">
                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <h4 className="font-medium">Resource Allocation</h4>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">CPU Cores</span>
                          <span className="text-sm font-medium">{systemInfo?.cores ? Math.floor(systemInfo.cores / 2) : 0} / {systemInfo?.cores || 0}</span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-secondary">
                          <div className="h-2 rounded-full bg-primary" style={{ width: '50%' }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Memory</span>
                          <span className="text-sm font-medium">
                            {systemInfo?.memory ? (systemInfo.memory * 0.3).toFixed(1) : 0}GB / {systemInfo?.memory || 0}GB
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full rounded-full bg-secondary">
                          <div className="h-2 rounded-full bg-primary" style={{ width: '30%' }} />
                        </div>
                      </div>

                      {systemInfo?.gpu.available && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">GPU</span>
                            <span className="text-sm font-medium">50%</span>
                          </div>
                          <div className="mt-1 h-2 w-full rounded-full bg-secondary">
                            <div className="h-2 rounded-full bg-primary" style={{ width: '50%' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                    <h4 className="font-medium">Network Selection</h4>
                    <div className="mt-3 space-y-2">
                      <label className="flex items-center gap-2">
                        <input className="rounded" defaultChecked type="radio" name="network" />
                        <span className="text-sm">Hanzo Mainnet</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input className="rounded" type="radio" name="network" />
                        <span className="text-sm">Testnet</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input className="rounded" type="radio" name="network" />
                        <span className="text-sm">Custom Network</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1" variant="default">
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Start Mining
                    </Button>
                    <Button className="flex-1" variant="outline" disabled>
                      <StopCircle className="mr-2 h-4 w-4" />
                      Stop Mining
                    </Button>
                  </div>

                  <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                    <p className="text-xs text-yellow-600">
                      ⚠️ Mining will use your allocated resources to process network tasks.
                      Ensure your system has adequate cooling and stable power.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <AlertDialog
        onOpenChange={setIsConfirmResetDialogOpened}
        open={isConfirmResetDialogOpened}
      >
        <AlertDialogContent className="w-[75%]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset your Hanzo Node</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex flex-col space-y-3 text-left text-white/70">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm">
                    Are you sure you want to reset your Hanzo Node? This will
                    permanently delete all your data.
                  </span>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 flex justify-end gap-1">
            <AlertDialogCancel
              className="mt-0 min-w-[120px]"
              onClick={() => {
                setIsConfirmResetDialogOpened(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-w-[120px]"
              onClick={() => handleReset()}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

ReactDOM.createRoot(document.querySelector('#root') as HTMLElement).render(
  <QueryClientProvider client={hanzoNodeQueryClient}>
    <React.StrictMode>
      <App />
      <Toaster />
    </React.StrictMode>
  </QueryClientProvider>,
);
