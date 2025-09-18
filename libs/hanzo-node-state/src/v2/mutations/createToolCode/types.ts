import { type Token } from '@hanzo-app/message/api/general/types';
import {
  type CodeLanguage,
  type CreateToolCodeResponse,
} from '@hanzo-app/message/api/tools/types';

export type CreateToolCodeInput = Token & {
  nodeAddress: string;
  message: string;
  llmProviderId: string;
  jobId?: string;
  tools: string[];
  language: CodeLanguage;
};

export type CreateToolCodeOutput = CreateToolCodeResponse;
