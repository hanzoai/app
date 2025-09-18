import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetToolsResponse } from '@hanzo-app/message/api/tools/types';

export type GetSearchToolsInput = Token & {
  nodeAddress: string;
  search: string;
};

export type GetSearchToolsOutput = GetToolsResponse;
