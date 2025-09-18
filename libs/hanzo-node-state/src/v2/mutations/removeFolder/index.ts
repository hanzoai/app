import { removeFolder as removeFolderApi } from '@hanzo-app/message/api/vector-fs/index';

import { type RemoveFolderInput } from './types';

export const removeFolder = async ({
  nodeAddress,
  token,
  folderPath,
}: RemoveFolderInput) => {
  return await removeFolderApi(nodeAddress, token, {
    path: folderPath,
  });
};
export * from './useRemoveFolder';
