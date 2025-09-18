import { type Token } from '@hanzo-app/message/api/general/types';
import { type StopGeneratingLLMResponse } from '@hanzo-app/message/api/jobs/types';

export type StopGeneratingLLMOutput = StopGeneratingLLMResponse;

export type StopGeneratingLLMInput = Token & {
  nodeAddress: string;
  jobId: string;
};
