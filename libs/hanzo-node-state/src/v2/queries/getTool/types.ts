import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetToolResponse } from '@hanzo-app/message/api/tools/types';

export type GetToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
};

export type GetToolOutput = GetToolResponse;
