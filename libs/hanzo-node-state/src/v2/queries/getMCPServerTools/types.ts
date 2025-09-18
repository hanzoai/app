import { Token, Tool } from '@hanzo-app/message/api/general/types';

export type GetMcpServerToolsInput = Token & {
  nodeAddress: string;
  mcpServerId: number;
};

export type GetMcpServerToolsOutput = {
  tools: Tool[];
};
