import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type AddLLMProviderResponse,
  type SerializedLLMProvider,
} from '@hanzo-app/message/api/jobs/types';

export type AddLLMProviderInput = Token & {
  nodeAddress: string;
  agent: SerializedLLMProvider;
  enableTest?: boolean;
};
export type AddLLMProviderOutput = AddLLMProviderResponse;
