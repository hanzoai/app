import { importAgentFromUrl as importAgentFromUrlApi } from '@hanzo-app/message/api/agents/index';

import { type ImportAgentFromUrlInput } from './types';

export const importAgentFromUrl = async ({
  nodeAddress,
  token,
  url,
}: ImportAgentFromUrlInput) => {
  return await importAgentFromUrlApi(nodeAddress, token, url);
};
export * from './useImportAgentFromUrl';
