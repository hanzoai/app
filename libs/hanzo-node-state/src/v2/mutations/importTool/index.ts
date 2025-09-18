import { importTool as importToolApi } from '@hanzo-app/message/api/tools/index';

import { type ImportToolInput } from './types';

export const importTool = async ({
  nodeAddress,
  token,
  url,
}: ImportToolInput) => {
  return await importToolApi(nodeAddress, token, {
    url: url,
  });
};
export * from './useImportTool';
