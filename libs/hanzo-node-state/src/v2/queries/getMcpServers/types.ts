import { Token } from '@hanzo-app/message/api/general/types';
import { GetMcpServersResponse } from '@hanzo-app/message/api/mcp-servers/types';

export type GetMcpServersInput = Token & {
  nodeAddress: string;
};

export type GetMcpServersOutput = GetMcpServersResponse;
