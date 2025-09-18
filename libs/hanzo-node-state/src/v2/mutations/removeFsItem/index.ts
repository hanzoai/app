import { removeFsItem as removeFsItemApi } from '@hanzo-app/message/api/vector-fs/index';

import { type RemoveFsItemInput } from './types';

export const removeFsItem = async ({
  nodeAddress,
  token,
  itemPath,
}: RemoveFsItemInput) => {
  return await removeFsItemApi(nodeAddress, token, {
    path: itemPath,
  });
};
export * from './useRemoveFsItem';
