import { type Token } from '@hanzo-app/message/api/general/types';

export type UpdatePromptOutput = {
  status: string;
};

export type UpdatePromptInput = Token & {
  nodeAddress: string;
  id: number;
  promptName: string;
  promptContent: string;
  isPromptFavorite: boolean;
  isPromptEnabled: boolean;
  isPromptSystem: boolean;
  promptVersion: string;
};
