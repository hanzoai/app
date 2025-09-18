import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetPlaygroundToolsResponse } from '@hanzo-app/message/api/tools/types';

export type GetPlaygroundToolsInput = Token & {
  nodeAddress: string;
};

export type GetPlaygroundToolsOutput = GetPlaygroundToolsResponse;
