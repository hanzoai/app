import { searchTools as searchToolsApi } from '@hanzo-app/message/api/tools/index';

import { type GetSearchToolsInput } from './types';

export const searchTools = async ({
  nodeAddress,
  token,
  search,
}: GetSearchToolsInput) => {
  const response = await searchToolsApi(nodeAddress, token, search);
  return response;
};
export * from './useGetToolsSearch';
