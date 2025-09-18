import { type Token } from '@hanzo-app/message/api/general/types';

export type SetNgrokAuthTokenInput = Token & {
  nodeAddress: string;
  authToken: string;
};

export type SetNgrokAuthTokenOutput = void;
