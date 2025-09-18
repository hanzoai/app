import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetChatConfigResponse } from '@hanzo-app/message/api/jobs/types';

export type GetChatConfigInput = Token & {
  nodeAddress: string;
  jobId: string;
};

export type GetChatConfigOutput = GetChatConfigResponse;
