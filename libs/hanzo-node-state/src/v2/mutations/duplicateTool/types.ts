import { type Token } from '@hanzo-app/message/api/general/types';
import { type DuplicateToolResponse } from '@hanzo-app/message/api/tools/types';

export type DuplicateToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
};

export type DuplicateToolOutput = DuplicateToolResponse;
