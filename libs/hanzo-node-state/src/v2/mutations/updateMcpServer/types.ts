import { Token } from '@hanzo-app/message/api/general/types';
import {
  McpServer,
  McpServerType,
} from '@hanzo-app/message/api/mcp-servers/types';
import { UpdateMcpServerRequest } from '@hanzo-app/message/api/mcp-servers/types';

export type UpdateMcpServerInput = Token & {
  nodeAddress: string;
} & UpdateMcpServerRequest;

export type UpdateMcpServerResponse = McpServer;
