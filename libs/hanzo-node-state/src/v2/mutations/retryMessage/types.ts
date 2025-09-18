import { type Token } from '@hanzo-app/message/api/general/types';
import { type JobMessageResponse } from '@hanzo-app/message/api/jobs/types';

export type RetryMessageInput = Token & {
  nodeAddress: string;
  inboxId: string;
  messageId: string;
};

export type RetryMessageOutput = JobMessageResponse;
