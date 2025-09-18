import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetToolPlaygroundMetadataResponse } from '@hanzo-app/message/api/tools/types';

export type GetToolPlaygroundMetadataInput = Token & {
  nodeAddress: string;
  toolRouterKey: string;
};

export type GetToolPlaygroundMetadataOutput = GetToolPlaygroundMetadataResponse;
