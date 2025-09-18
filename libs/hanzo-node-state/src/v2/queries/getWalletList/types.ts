import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetWalletListResponse } from '@hanzo-app/message/api/wallets';

export type GetWalletListInput = Token & {
  nodeAddress: string;
};

export type GetWalletListOutput = GetWalletListResponse;
