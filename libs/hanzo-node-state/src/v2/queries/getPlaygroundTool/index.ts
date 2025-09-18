import { getPlaygroundTool as getPlaygroundToolApi } from '@hanzo-app/message/api/tools/index';

import { type GetPlaygroundToolInput } from './types';

export const getPlaygroundTool = async ({
  nodeAddress,
  token,
  toolRouterKey,
  xHanzoOriginalToolRouterKey,
}: GetPlaygroundToolInput) => {
  const response = await getPlaygroundToolApi(
    nodeAddress,
    token,
    {
      tool_key: toolRouterKey,
    },
    xHanzoOriginalToolRouterKey,
  );
  return response;
};
export * from './useGetPlaygroundTool';
