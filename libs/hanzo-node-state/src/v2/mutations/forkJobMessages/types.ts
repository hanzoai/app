import { type Token } from '@hanzo-app/message/api/general/types';
import { type ForkJobMessagesResponse } from '@hanzo-app/message/api/jobs/types';

export type ForkJobMessagesInput = Token & {
  nodeAddress: string;
  jobId: string;
  messageId: string;
};

export type ForkJobMessagesOutput = ForkJobMessagesResponse;
