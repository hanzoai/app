import { type Token } from '@hanzo-app/message/api/general/types';
import { type UpdateLLMProviderResponse } from '@hanzo-app/message/api/jobs/types';

export type RemoveLLMProviderInput = Token & {
  nodeAddress: string;
  llmProviderId: string;
};
export type RemoveLLMProviderOutput = UpdateLLMProviderResponse;
