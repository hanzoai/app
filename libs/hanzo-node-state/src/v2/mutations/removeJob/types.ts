import { type Token } from '@hanzo-app/message/api/general/types';

export type RemoveJobOutput = {
  status: string;
};

export type RemoveJobInput = Token & {
  nodeAddress: string;
  jobId: string;
};
