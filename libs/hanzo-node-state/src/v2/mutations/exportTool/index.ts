import { exportTool as exportToolApi } from '@hanzo-app/message/api/tools/index';

import { type ExportToolInput } from './types';

export const exportTool = async ({
  nodeAddress,
  token,
  toolKey,
}: ExportToolInput) => {
  return await exportToolApi(nodeAddress, token, {
    toolKey,
  });
};
export * from './useExportTool';
