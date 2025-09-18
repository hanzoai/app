import { uploadAssetsToTool as uploadAssetsToToolApi } from '@hanzo-app/message/api/tools/index';

import { type UploadAssetsToToolInput } from './types';

export const uploadAssetsToTool = async ({
  nodeAddress,
  token,
  files,
  xHanzoAppId,
  xHanzoToolId,
}: UploadAssetsToToolInput) => {
  const response = await uploadAssetsToToolApi(
    nodeAddress,
    token,
    xHanzoAppId,
    xHanzoToolId,
    files,
  );

  return response;
};
export * from './useUploadAssetsTool';
