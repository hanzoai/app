import { getToolPlaygroundMetadata as getToolPlaygroundMetadataApi } from '@hanzo-app/message/api/tools/index';

import {
  type GetToolPlaygroundMetadataInput,
  type GetToolPlaygroundMetadataOutput,
} from './types';

export const getToolPlaygroundMetadata = async ({
  toolRouterKey,
  nodeAddress,
  token,
}: GetToolPlaygroundMetadataInput): Promise<GetToolPlaygroundMetadataOutput> => {
  const response = await getToolPlaygroundMetadataApi(nodeAddress, token, {
    tool_router_key: toolRouterKey,
  });
  return response;
};
export * from './useGetToolPlaygroundMetadata';
