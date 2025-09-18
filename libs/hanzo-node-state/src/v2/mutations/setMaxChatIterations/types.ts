import { type Token } from '@hanzo-app/message/api/general/types';

export type SetMaxChatIterationsInput = Token & {
  nodeAddress: string;
  maxIterations: number;
};

export type SetMaxChatIterationsOutput = string;
