import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetProviderFromJobResponse } from '@hanzo-app/message/api/jobs/types';

export type GetProviderFromJobInput = Token & {
  nodeAddress: string;
  jobId: string;
};

export type GetProviderFromJobOutput = GetProviderFromJobResponse;
