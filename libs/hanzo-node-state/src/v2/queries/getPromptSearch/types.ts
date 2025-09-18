import { type Token } from '@hanzo-app/message/api/general/types';
import { type SearchPromptsResponse } from '@hanzo-app/message/api/tools/types';

export type GetPromptSearchInput = Token & {
  nodeAddress: string;
  search: string;
};

export type GetPromptSearchOutput = SearchPromptsResponse;
