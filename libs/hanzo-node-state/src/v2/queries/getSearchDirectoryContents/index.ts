import { getSearchDirectoryContents as getSearchDirectoryContentsApi } from '@hanzo-app/message/api/vector-fs/index';

import { type GetSearchDirectoryContentsInput } from './types';

export const getSearchDirectoryContents = async ({
  nodeAddress,
  token,
  name,
}: GetSearchDirectoryContentsInput) => {
  const response = await getSearchDirectoryContentsApi(nodeAddress, token, {
    name,
  });
  return response;
};
export * from './useGetSearchDirectoryContents';
