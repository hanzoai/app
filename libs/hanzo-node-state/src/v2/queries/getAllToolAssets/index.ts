import { getAllToolAssets as getAllToolAssetsApi } from '@hanzo-app/message/api/tools/index';

import { type GetAllToolAssetsInput } from './types';

export const getAllToolAssets = async ({
  nodeAddress,
  token,
  xHanzoAppId,
  xHanzoToolId,
}: GetAllToolAssetsInput) => {
  const result = await getAllToolAssetsApi(
    nodeAddress,
    token,
    xHanzoAppId,
    xHanzoToolId,
  );
  return result;
};
export * from './useGetAllToolAssets';
