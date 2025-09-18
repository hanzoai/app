import { Token } from '@hanzo-app/message/api/general/types';
import { McpServer } from '@hanzo-app/message/api/mcp-servers/types';

export type ImportMCPServerFromGithubURLInput = Token & {
  nodeAddress: string;
  githubUrl: string;
};

export type ImportMCPServerFromGithubURLOutput = McpServer;
