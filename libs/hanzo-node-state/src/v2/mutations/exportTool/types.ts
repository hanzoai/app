import { type Token } from '@hanzo-app/message/api/general/types';
import { type ExportToolResponse } from '@hanzo-app/message/api/tools/types';

export type ExportToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
};

export type ExportToolOutput = ExportToolResponse;
