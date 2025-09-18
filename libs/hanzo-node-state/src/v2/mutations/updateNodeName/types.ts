import { type Token } from '@hanzo-app/message/api/general/types';

export type UpdateNodeNameInput = Token & {
  nodeAddress: string;
  newNodeName: string;
};

export type UpdateNodeNameOutput = {
  status: string;
};
