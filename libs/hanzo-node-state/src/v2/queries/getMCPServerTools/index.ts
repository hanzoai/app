import { getMcpServerTools as getMcpServerToolsApi } from '@hanzo-app/message/api/mcp-servers/index';

import type { GetMcpServerToolsInput } from './types';

export const getMcpServerTools = async (input: GetMcpServerToolsInput) => {
  return getMcpServerToolsApi(input.nodeAddress, input.token, {
    id: input.mcpServerId,
  });
};
export * from './useGetMCPServerTool';
