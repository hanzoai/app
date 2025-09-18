import { getMcpServers as getMcpServersApi } from '@hanzo-app/message/api/mcp-servers/index';

import type { GetMcpServersInput } from './types';

export const getMcpServers = async ({
  nodeAddress,
  token,
}: GetMcpServersInput) => {
  const result = await getMcpServersApi(nodeAddress, token);
  return result;
};
export * from './useGetMcpServers';
