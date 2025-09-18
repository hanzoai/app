import { type Token } from '@hanzo-app/message/api/general/types';
import { type CreatePromptResponse } from '@hanzo-app/message/api/tools/types';

export type CreatePromptOutput = CreatePromptResponse;

export type CreatePromptInput = Token & {
  nodeAddress: string;
  promptName: string;
  promptContent: string;
};
