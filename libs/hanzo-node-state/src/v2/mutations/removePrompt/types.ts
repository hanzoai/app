import { type Token } from '@hanzo-app/message/api/general/types';

export type RemovePromptOutput = {
  status: string;
};

export type RemovePromptInput = Token & {
  nodeAddress: string;
  promptName: string;
};
