import { type Token } from '@hanzo-app/message/api/general/types';
import { type DisableAllToolsResponse } from '@hanzo-app/message/api/tools/types';

export type DisableAllToolsInput = Token & {
  nodeAddress: string;
};

export type DisableAllToolsOutput = DisableAllToolsResponse;
