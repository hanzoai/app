import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetToolStoreDetailsResponse } from '@hanzo-app/message/api/tools/types';

export type GetToolStoreDetailsInput = Token & {
  nodeAddress: string;
  toolRouterKey: string;
};

export type GetToolStoreDetailsOutput = GetToolStoreDetailsResponse;
