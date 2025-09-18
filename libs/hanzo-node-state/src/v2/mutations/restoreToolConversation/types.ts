import { type Token } from '@hanzo-app/message/api/general/types';
import { type UndoToolImplementationResponse } from '@hanzo-app/message/api/tools/types';

export type RestoreToolConversationInput = Token & {
  nodeAddress: string;
  jobId: string;
  messageId: string;
};

export type RestoreToolConversationOutput = UndoToolImplementationResponse;
