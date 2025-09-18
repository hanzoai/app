import { removeLLMProvider as removeLLMProviderApi } from '@hanzo-app/message/api/jobs/index';

import { type RemoveLLMProviderInput } from './types';

export const removeLLMProvider = async ({
  nodeAddress,
  token,
  llmProviderId,
}: RemoveLLMProviderInput) => {
  const data = await removeLLMProviderApi(nodeAddress, token, {
    llm_provider_id: llmProviderId,
  });
  return data;
};
export * from './useRemoveLLMProvider';
