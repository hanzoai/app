import { type Token } from '@hanzo-app/message/api/general/types';
import { type UpdateInboxNameResponse } from '@hanzo-app/message/api/jobs/types';

export type UpdateInboxNameInput = Token & {
  nodeAddress: string;
  inboxName: string;
  inboxId: string;
};

export type UpdateInboxNameOutput = UpdateInboxNameResponse;
