import { disableAllTools as disableAllToolsApi } from '@hanzo-app/message/api/tools/index';

import { type DisableAllToolsInput } from './types';

export const disableAllTools = async ({
  nodeAddress,
  token,
}: DisableAllToolsInput) => {
  return await disableAllToolsApi(nodeAddress, token);
};
export * from './useDisableAllTools';
