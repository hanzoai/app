import { type Token } from '@hanzo-app/message/api/general/types';
import { type UpdateLLMProviderInJobResponse } from '@hanzo-app/message/api/jobs/types';

export type UpdateAgentInJobInput = Token & {
  nodeAddress: string;
  jobId: string;
  newAgentId: string;
};

export type UpdateAgentInJobOutput = UpdateLLMProviderInJobResponse;
