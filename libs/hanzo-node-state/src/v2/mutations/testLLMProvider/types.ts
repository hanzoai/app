import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type AddLLMProviderResponse,
  type SerializedLLMProvider,
} from '@hanzo-app/message/api/jobs/types';

export type TestLLMProviderInput = Token & {
  nodeAddress: string;
  agent: SerializedLLMProvider;
};
export type TestLLMProviderOutput = AddLLMProviderResponse;
