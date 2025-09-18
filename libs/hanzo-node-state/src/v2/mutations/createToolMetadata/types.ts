import { type Token } from '@hanzo-app/message/api/general/types';
import { type CreateToolMetadataResponse } from '@hanzo-app/message/api/tools/types';

export type CreateToolMetadataInput = Token & {
  nodeAddress: string;
  jobId: string;
  tools: string[];
  xHanzoToolId?: string;
};

export type CreateToolMetadataOutput = CreateToolMetadataResponse;
