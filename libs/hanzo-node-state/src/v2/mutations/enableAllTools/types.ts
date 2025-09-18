import { type Token } from '@hanzo-app/message/api/general/types';
import { type EnableAllToolsResponse } from '@hanzo-app/message/api/tools/types';

export type EnableAllToolsInput = Token & {
  nodeAddress: string;
};

export type EnableAllToolsOutput = EnableAllToolsResponse;
