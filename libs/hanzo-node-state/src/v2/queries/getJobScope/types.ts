import { type Token } from '@hanzo-app/message/api/general/types';
import { type JobScope } from '@hanzo-app/message/api/jobs/types';

export type GetJobScopeInput = Token & {
  nodeAddress: string;
  jobId: string;
};

export type GetJobScopeOutput = JobScope;
