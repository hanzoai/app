import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetPlaygroundToolResponse } from '@hanzo-app/message/api/tools/types';

export type GetPlaygroundToolInput = Token & {
  nodeAddress: string;
  toolRouterKey: string;
  xHanzoOriginalToolRouterKey?: string;
};

export type GetPlaygroundToolOutput = GetPlaygroundToolResponse;
