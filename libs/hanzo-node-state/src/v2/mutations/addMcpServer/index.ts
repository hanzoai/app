import { addMcpServer as addMcpServerApi } from '@hanzo-app/message/api/mcp-servers/index';
import { type AddMcpServerRequest } from '@hanzo-app/message/api/mcp-servers/types';

import { type AddMcpServerInput } from './types';

export const addMcpServer = async (input: AddMcpServerInput) => {
  const { nodeAddress, token, ...rest } = input;
  return addMcpServerApi(nodeAddress, token, rest as AddMcpServerRequest);
};
export * from './useAddMcpServer';
