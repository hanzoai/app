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
  // Load enabled providers from cookies

  // Update enabled providers when cookies change
  useEffect(() => {
    if (!model && modelList.length > 0) {
      const defaultModel = modelList.find((m) => m.name === 'o1');

      if (defaultModel) {
        setModel?.(defaultModel.name);
      }
    }

    if (providerList.length == 0) {
      return;
    }

    if (provider && !providerList.map((p) => p.name).includes(provider.name)) {
      const firstEnabledProvider = providerList[0];
      setProvider?.(firstEnabledProvider);

      const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);

      if (firstModel) {
        setModel?.(firstModel.name);
      }
    }
  }, [providerList, provider, setProvider, modelList, setModel]);

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
          const newProvider = providerList.find((p: ProviderInfo) => p.name === e.target.value);

          if (newProvider && setProvider) {
            setProvider(newProvider);
          }

          const firstModel = [...modelList].find((m) => m.provider === e.target.value);

          if (firstModel && setModel) {
            setModel(firstModel.name);
          }
        }}
        className="flex-1 p-2 rounded-full border border-hanzo-elements-borderColor bg-hanzo-elements-prompt-background text-hanzo-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-hanzo-elements-focus transition-all"
      >
        {providerList.map((provider: ProviderInfo) => (
          <option key={provider.name} value={provider.name}>
            {provider.name}
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
            .filter((e) => e.provider == provider?.name && e.name)
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
