import { copyFolder as copyFolderApi } from '@hanzo-app/message/api/vector-fs/index';

import { type CopyFolderInput } from './types';

export const copyFolder = async ({
  nodeAddress,
  token,
  originPath,
  destinationPath,
}: CopyFolderInput) => {
  return await copyFolderApi(nodeAddress, token, {
    destination_path: destinationPath,
    origin_path: originPath,
  });
};
export * from './useCopyFolder';
