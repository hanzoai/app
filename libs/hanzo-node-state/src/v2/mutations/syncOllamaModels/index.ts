import {
  addOllamaModels,
  scanOllamaModels,
} from '@hanzo-app/message/api/ollama';

import { type SyncOllamaModelsInput } from './types';

export const syncOllamaModels = async ({
  nodeAddress,
  token,
  allowedModels,
}: SyncOllamaModelsInput) => {
  let ollamaModels = await scanOllamaModels(nodeAddress, token);
  if (!ollamaModels?.length) {
    return;
  }
  if (allowedModels?.length) {
    ollamaModels = ollamaModels.filter((model) =>
      allowedModels.includes(model.model),
    );
  }
  const payload = {
    models: ollamaModels.map((v) => v.model),
  };
  return addOllamaModels(nodeAddress, token, payload);
};
export * from './useSyncOllamaModels';
