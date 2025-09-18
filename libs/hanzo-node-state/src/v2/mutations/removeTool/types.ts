import { type Token } from '@hanzo-app/message/api/general/types';

export type RemoveToolOutput = {
  status: string;
};

export type RemoveToolInput = Token & {
  nodeAddress: string;
  toolKey: string;
};
