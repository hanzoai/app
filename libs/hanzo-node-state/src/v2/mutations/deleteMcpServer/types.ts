import { Token } from '@hanzo-app/message/api/general/types';
import { McpServer } from '@hanzo-app/message/api/mcp-servers/types';

export type DeleteMcpServerInput = Token & {
  nodeAddress: string;
  id: number;
};

export type DeleteMcpServerResponse = McpServer;
