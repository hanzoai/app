import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetInstalledNetworkToolsResponse } from '@hanzo-app/message/api/tools/types';

export type GetInstalledNetworkToolsInput = Token & {
  nodeAddress: string;
};

export type GetInstalledNetworkToolsOutput = GetInstalledNetworkToolsResponse;
