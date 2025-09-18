import { useTranslation } from '@hanzo_network/hanzo-i18n';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Progress,
  ScrollArea,
  Slider,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hanzo_network/hanzo-ui';
import { cn } from '@hanzo_network/hanzo-ui/utils';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Filter,
  Gpu,
  HardDrive,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import {
  fetchEmbeddingModels,
  fetchLMStudioModels,
  fetchMLXModels,
  fetchTrendingModels,
  searchHuggingFaceModels,
} from '../../lib/hanzo-node-manager/huggingface-api';
import { FEATURED_MODELS } from '../../lib/hanzo-node-manager/hanzo-models';
import { INFERENCE_ENGINES, getEnginesForPlatform, getDefaultEngine } from '../../lib/hanzo-node-manager/inference-engines';
import { EMBEDDING_MODELS, getRecommendedEmbeddings } from '../../lib/hanzo-node-manager/embedding-models';
import { detectSystem, canRunModel, getRecommendedModels } from '../../lib/hardware-detection';
import { getPlatformSync } from '../../lib/platform-utils';

// Create a custom Zen logo component
const ZenLogo: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg
    className={className}
    viewBox="0 0 200 200"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="100" cy="100" r="100" fill="#000"/>
    <text x="100" y="125" fontSize="80" fill="white" textAnchor="middle" fontFamily="monospace">Z</text>
  </svg>
);

interface LiveModelCardProps {
  model: any;
  onInstall?: (model: any) => void;
}

const LiveModelCard: React.FC<LiveModelCardProps> = ({ model, onInstall }) => {
  const [isInstalling, setIsInstalling] = useState(false);
  const huggingFaceUrl = `https://huggingface.co/${model.modelId || model.id}`;

  const handleInstall = async () => {
    setIsInstalling(true);
    // TODO: Implement actual installation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsInstalling(false);
    onInstall?.(model);
  };

  // Extract size from model name
  const getModelSize = (name: string): string => {
    const match = name.match(/(\d+(?:\.\d+)?)[bB]/);
    if (match) return `${match[1]}B`;

    const match2 = name.match(/(\d+)x(\d+(?:\.\d+)?)[bB]/);
    if (match2) return `${match2[1]}x${match2[2]}B`;

    return 'Unknown';
  };

  // Get model type from tags
  const getModelType = (tags?: string[]): string => {
    if (!tags) return 'text-generation';
    if (tags.includes('text-generation')) return '📝 Text';
    if (tags.includes('code')) return '💻 Code';
    if (tags.includes('vision')) return '👁️ Vision';
    if (tags.includes('audio')) return '🎵 Audio';
    return '📝 Text';
  };

  const modelName = model.modelId?.split('/').pop() || model.name || 'Unknown Model';
  const authorName = model.modelId?.split('/')[0] || model.author || 'Community';
  const downloads = model.downloads || 0;
  const likes = model.likes || 0;

  return (
    <Card className="flex h-full flex-col hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate">
              {modelName}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              by {authorName}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs ml-2">
            {getModelSize(modelName)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 pb-3">
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {getModelType(model.tags)}
          </Badge>
          {model.pipeline_tag && (
            <Badge variant="outline" className="text-xs">
              {model.pipeline_tag}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-text-secondary">
          <div className="flex items-center gap-3">
            {downloads > 0 && (
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {downloads > 1000000
                  ? `${(downloads / 1000000).toFixed(1)}M`
                  : downloads > 1000
                  ? `${(downloads / 1000).toFixed(1)}k`
                  : downloads}
              </span>
            )}
            {likes > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {likes > 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
              </span>
            )}
          </div>
        </div>

        {model.lastModified && (
          <p className="text-xs text-text-tertiary">
            Updated: {new Date(model.lastModified).toLocaleDateString()}
          </p>
        )}
      </CardContent>

      <CardFooter className="gap-2 pt-3">
        <Button
          size="sm"
          variant="default"
          className="flex-1"
          onClick={handleInstall}
          disabled={isInstalling}
        >
          {isInstalling ? 'Installing...' : 'Install'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(huggingFaceUrl, '_blank')}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </CardFooter>
    </Card>
  );
};

interface HanzoModelBrowserProps {
  onModelSelect?: (model: any) => void;
  onContinue?: () => void;
  isOnboardingStep?: boolean;
}

export const HanzoModelBrowser: React.FC<HanzoModelBrowserProps> = ({
  onModelSelect,
  onContinue,
  isOnboardingStep = false,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeFilter, setSizeFilter] = useState([0, 1000]);
  const [isLoading, setIsLoading] = useState(false);
  const [lmStudioModels, setLmStudioModels] = useState<any[]>([]);
  const [mlxModels, setMlxModels] = useState<any[]>([]);
  const [trendingModels, setTrendingModels] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [embeddingModels, setEmbeddingModels] = useState<any[]>([]);

  const currentPlatform = getPlatformSync();
  const showMLXTab = currentPlatform === 'macos';
  const defaultEngine = getDefaultEngine();
  const platformEngines = getEnginesForPlatform(currentPlatform);

  // Load models and detect hardware on mount
  useEffect(() => {
    loadInitialModels();
    detectHardware();
  }, []);

  const detectHardware = async () => {
    try {
      const info = await detectSystem();
      setSystemInfo(info);
    } catch (error) {
      console.error('Hardware detection failed:', error);
    }
  };

  const loadInitialModels = async () => {
    setIsLoading(true);
    try {
      const [lmStudio, mlx, trending, embeddings] = await Promise.all([
        fetchLMStudioModels(),
        showMLXTab ? fetchMLXModels() : Promise.resolve([]),
        fetchTrendingModels(),
        fetchEmbeddingModels(),
      ]);

      setLmStudioModels(lmStudio);
      setMlxModels(mlx);
      setTrendingModels(trending);
      setEmbeddingModels(embeddings);
    } catch (error) {
      console.error('Error loading models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search
  useEffect(() => {
    if (searchQuery.length > 2) {
      const searchTimer = setTimeout(async () => {
        setIsLoading(true);
        try {
          const results = await searchHuggingFaceModels(searchQuery);
          setSearchResults(results);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setIsLoading(false);
        }
      }, 500);

      return () => clearTimeout(searchTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // Filter models by size (in GB)
  const filterModelsBySize = (models: any[]) => {
    return models.filter(model => {
      const name = model.modelId || model.name || '';
      const sizeMatch = name.match(/(\d+(?:\.\d+)?)[bB]/);
      if (!sizeMatch) return true;

      const size = parseFloat(sizeMatch[1]);
      return size >= sizeFilter[0] && size <= sizeFilter[1];
    });
  };

  const filteredLMStudioModels = filterModelsBySize(lmStudioModels);
  const filteredMLXModels = filterModelsBySize(mlxModels);
  const filteredTrendingModels = filterModelsBySize(trendingModels);
  const filteredSearchResults = filterModelsBySize(searchResults);

  const handleCustomUrlImport = () => {
    if (customUrl && customUrl.includes('huggingface.co')) {
      // Extract model ID from URL
      const match = customUrl.match(/huggingface\.co\/([^\/]+\/[^\/\?]+)/);
      if (match) {
        const modelId = match[1];
        // Create a model object
        const customModel = {
          modelId,
          name: modelId.split('/').pop(),
          author: modelId.split('/')[0],
        };
        onModelSelect?.(customModel);
        setCustomUrl('');
      }
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hanzo Model Repository</h1>
          <p className="text-sm text-text-secondary">
            Live models from LM Studio and MLX communities on Hugging Face
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={loadInitialModels}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3 rounded-lg border bg-bg-secondary p-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models across Hugging Face..."
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-text-secondary" />
            <span className="text-sm text-text-secondary">Size:</span>
            <div className="w-48">
              <Slider
                value={sizeFilter}
                onValueChange={setSizeFilter}
                min={0}
                max={1000}
                step={1}
                className="w-full"
              />
            </div>
            <span className="text-sm font-mono whitespace-nowrap">
              {sizeFilter[0]}GB-{sizeFilter[1] === 1000 ? '1TB' : `${sizeFilter[1]}GB`}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Paste a Hugging Face model URL to import..."
            className="flex-1"
          />
          <Button
            onClick={handleCustomUrlImport}
            disabled={!customUrl || !customUrl.includes('huggingface.co')}
            variant="outline"
          >
            Import
          </Button>
        </div>
      </div>

      {/* System Info Banner */}
      {systemInfo && (
        <div className="rounded-lg border bg-bg-secondary p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                {systemInfo.gpu.available ? (
                  <>
                    <Gpu className="h-4 w-4 text-green-500" />
                    <span>{systemInfo.gpu.renderer || 'GPU Available'}</span>
                    <Badge variant="secondary">{(systemInfo.gpu.vram / 1024).toFixed(1)}GB VRAM</Badge>
                  </>
                ) : (
                  <>
                    <Cpu className="h-4 w-4 text-yellow-500" />
                    <span>CPU Only</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>{systemInfo.memory}GB RAM</span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                <span>{systemInfo.cores} Cores</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Hanzo Engine Active</span>
            </div>
          </div>
        </div>
      )}

      {/* Model Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-7">
          <TabsTrigger value="featured">
            <Sparkles className="h-4 w-4 mr-1" />
            Featured
          </TabsTrigger>
          <TabsTrigger value="engines">
            <Server className="h-4 w-4 mr-1" />
            Engines
          </TabsTrigger>
          <TabsTrigger value="embeddings">
            <Database className="h-4 w-4 mr-1" />
            Embeddings
          </TabsTrigger>
          <TabsTrigger value="lmstudio">
            LM Studio
            {lmStudioModels.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {lmStudioModels.length}
              </Badge>
            )}
          </TabsTrigger>
          {showMLXTab && (
            <TabsTrigger value="mlx">
              MLX
              {mlxModels.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {mlxModels.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="trending">
            <TrendingUp className="h-4 w-4 mr-1" />
            Trending
          </TabsTrigger>
          {searchResults.length > 0 && (
            <TabsTrigger value="search">
              Search
              <Badge variant="secondary" className="ml-1 text-xs">
                {searchResults.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <ScrollArea className="flex-1 mt-4">
          {/* Featured Models */}
          <TabsContent value="featured" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURED_MODELS.map((model) => {
                const memCheck = systemInfo ? canRunModel(model.size, systemInfo) : { canRun: true };

                return (
                  <Card key={model.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ZenLogo className="h-5 w-5" />
                        {model.name}
                        <Star className="h-4 w-4 text-yellow-500" />
                      </CardTitle>
                      <CardDescription>{model.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-2 text-xs">
                        <div>Size: {model.size}GB</div>
                        <div>Context: {model.contextLength / 1000}k</div>
                        <div className="flex flex-wrap gap-1">
                          {model.capabilities.map(cap => (
                            <Badge key={cap} variant="outline" className="text-xs">
                              {cap}
                            </Badge>
                          ))}
                        </div>
                        {!memCheck.canRun && (
                          <Alert className="mt-2">
                            <AlertTriangle className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                              {memCheck.warning}
                            </AlertDescription>
                          </Alert>
                        )}
                        {memCheck.canRun && memCheck.warning && (
                          <Alert className="mt-2">
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            <AlertDescription className="text-xs">
                              {memCheck.warning}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => onModelSelect?.(model)}
                        disabled={!memCheck.canRun}
                      >
                        {!memCheck.canRun ? 'Insufficient Memory' : 'Install'}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Inference Engines Tab */}
          <TabsContent value="engines" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platformEngines.map((engine) => (
                <Card key={engine.id} className={cn(
                  "flex flex-col",
                  engine.defaultEngine && "ring-2 ring-primary"
                )}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-xl">{engine.icon}</span>
                      {engine.name}
                      {engine.defaultEngine && (
                        <Badge variant="default" className="ml-auto">Default</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{engine.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span>Performance:</span>
                        <Badge variant={
                          engine.performance === 'very-fast' ? 'success' :
                          engine.performance === 'fast' ? 'default' :
                          engine.performance === 'slow' ? 'secondary' : 'outline'
                        }>
                          {engine.performance}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Memory Usage:</span>
                        <Badge variant={
                          engine.memory === 'low' ? 'success' :
                          engine.memory === 'medium' ? 'default' : 'destructive'
                        }>
                          {engine.memory}
                        </Badge>
                      </div>
                      {engine.requirements.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold">Requirements:</p>
                          <ul className="text-xs text-text-secondary">
                            {engine.requirements.map((req, i) => (
                              <li key={i}>• {req}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold">Features:</p>
                        <div className="flex flex-wrap gap-1">
                          {engine.features.map((feature) => (
                            <Badge key={feature} variant="outline" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={engine.defaultEngine ? "default" : "outline"}
                      disabled={engine.defaultEngine}
                    >
                      {engine.defaultEngine ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        'Select'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Embeddings Tab */}
          <TabsContent value="embeddings" className="mt-0">
            <div className="space-y-4">
              {/* Recommended Embeddings */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Recommended for Your System</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {getRecommendedEmbeddings().map((model) => (
                    <Card key={model.id} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{model.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {model.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 pb-3">
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span>Dimensions:</span>
                            <Badge variant="outline">{model.dimensions}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Context:</span>
                            <Badge variant="outline">{model.contextLength}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Speed:</span>
                            <Badge variant={
                              model.performance === 'very-fast' ? 'success' :
                              model.performance === 'fast' ? 'default' : 'secondary'
                            }>
                              {model.performance}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-3">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => onModelSelect?.(model)}
                        >
                          Install
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Live Embedding Models from Hugging Face */}
              {embeddingModels.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Live from Hugging Face</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {embeddingModels.slice(0, 20).map((model) => (
                      <LiveModelCard
                        key={model.modelId}
                        model={model}
                        onInstall={onModelSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* LM Studio Models */}
          <TabsContent value="lmstudio" className="mt-0">
            {isLoading ? (
              <div className="text-center py-8">Loading LM Studio models...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredLMStudioModels.map((model) => (
                  <LiveModelCard
                    key={model.modelId}
                    model={model}
                    onInstall={onModelSelect}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* MLX Models */}
          {showMLXTab && (
            <TabsContent value="mlx" className="mt-0">
              {isLoading ? (
                <div className="text-center py-8">Loading MLX models...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredMLXModels.map((model) => (
                    <LiveModelCard
                      key={model.modelId}
                      model={model}
                      onInstall={onModelSelect}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* Trending Models */}
          <TabsContent value="trending" className="mt-0">
            {isLoading ? (
              <div className="text-center py-8">Loading trending models...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredTrendingModels.map((model) => (
                  <LiveModelCard
                    key={model.modelId}
                    model={model}
                    onInstall={onModelSelect}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <TabsContent value="search" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredSearchResults.map((model) => (
                  <LiveModelCard
                    key={model.modelId}
                    model={model}
                    onInstall={onModelSelect}
                  />
                ))}
              </div>
            </TabsContent>
          )}
        </ScrollArea>
      </Tabs>

      {/* Continue Button */}
      {isOnboardingStep && (
        <div className="flex justify-center pt-4">
          <Button onClick={onContinue || (() => {})}

>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};