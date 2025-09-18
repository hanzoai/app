import { importMcpServerFromGithubUrl } from '@hanzo-app/message/api/mcp-servers/index';

import type { ImportMCPServerFromGithubURLOutput } from './types';

export const importMCPServerFromGithubURL = async (
  nodeAddress: string,
  token: string,
  githubUrl: string,
): Promise<ImportMCPServerFromGithubURLOutput> => {
  return importMcpServerFromGithubUrl(nodeAddress, token, { url: githubUrl });
};
export * from './useImportMCPServerFromGithubURL';
