import { type Token } from '@hanzo-app/message/api/general/types';
import { type ImportToolResponse } from '@hanzo-app/message/api/tools/types';

export type ImportToolInput = Token & {
  nodeAddress: string;
  url: string;
};

export type ImportToolOutput = ImportToolResponse;
