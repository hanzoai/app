import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetAllPromptsResponse } from '@hanzo-app/message/api/tools/types';

export type GetPromptListInput = Token & {
  nodeAddress: string;
};

export type GetPromptListOutput = GetAllPromptsResponse;
