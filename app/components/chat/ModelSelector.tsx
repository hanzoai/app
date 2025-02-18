import type { ProviderInfo } from '~/types/model';
import { useEffect } from 'react';
import type { ModelInfo } from '~/lib/modules/llm/types';

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
  modelLoading?: string;
}

export const ModelSelector = ({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
  modelLoading,
}: ModelSelectorProps) => {
  // Set initial model on page load/refresh
  useEffect(() => {
    const hasInitialized = localStorage.getItem('modelSelector_initialized');

    if (modelList.length > 0 && !hasInitialized) {
      const o1Model = modelList.find((m) => m.name === 'o1');

      if (o1Model) {
        setModel?.(o1Model.name);
        localStorage.setItem('modelSelector_initialized', 'true');
      }
    }
  }, [modelList, setModel]);

  // Clear initialization flag when component unmounts
  useEffect(() => {
    return () => {
      localStorage.removeItem('modelSelector_initialized');
    };
  }, []);

  if (providerList.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-hanzo-elements-borderColor bg-hanzo-elements-prompt-background text-hanzo-elements-textPrimary">
        <p className="text-center">
          No providers are currently enabled. Please enable at least one provider in the settings to start using the
          chat.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 flex gap-2 flex-row">
      <select
        value={provider?.name ?? ''}
        onChange={(e) => {
          const selectedProvider = providerList.find((p) => p.name === e.target.value);

          if (selectedProvider && setProvider) {
            setProvider(selectedProvider);

            // Find and set the first model for this provider
            const providerModels = modelList.filter((m) => m.provider === selectedProvider.name);

            if (providerModels.length > 0 && setModel) {
              setModel(providerModels[0].name);
            }
          }
        }}
        className="flex-1 p-2 rounded-full border border-hanzo-elements-borderColor bg-hanzo-elements-prompt-background text-hanzo-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-hanzo-elements-focus transition-all"
      >
        {providerList.map((p: ProviderInfo) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        key={provider?.name}
        value={model}
        onChange={(e) => setModel?.(e.target.value)}
        className="flex-1 p-2 rounded-full border border-hanzo-elements-borderColor bg-hanzo-elements-prompt-background text-hanzo-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-hanzo-elements-focus transition-all lg:max-w-[70%]"
        disabled={modelLoading === 'all' || modelLoading === provider?.name}
      >
        {modelLoading == 'all' || modelLoading == provider?.name ? (
          <option key={0} value="">
            Loading...
          </option>
        ) : (
          [...modelList]
            .filter((e) => e.provider === provider?.name && e.name)
            .map((modelOption, index) => (
              <option key={index} value={modelOption.name}>
                {modelOption.label}
              </option>
            ))
        )}
      </select>
    </div>
  );
};
