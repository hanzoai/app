import { type Token } from '@hanzo-app/message/api/general/types';
import { type JobMessageResponse } from '@hanzo-app/message/api/jobs/types';

export type SendMessageToJobInput = Token & {
  nodeAddress: string;
  jobId: string;
  message: string;
  files?: File[];
  parent: string | null;
  toolKey?: string;
};

export type SendMessageToJobOutput = JobMessageResponse;
