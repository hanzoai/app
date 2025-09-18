import { removeToolAsset as removeToolAssetApi } from '@hanzo-app/message/api/tools/index';

import { type RemoveAssetToToolInput } from './types';

export const removeToolAsset = async ({
  nodeAddress,
  token,
  filename,
  xHanzoAppId,
  xHanzoToolId,
}: RemoveAssetToToolInput) => {
  const response = await removeToolAssetApi(
    nodeAddress,
    token,
    { filename },
    xHanzoAppId,
    xHanzoToolId,
  );

  return response;
};
export * from './useRemoveAssetTool';
