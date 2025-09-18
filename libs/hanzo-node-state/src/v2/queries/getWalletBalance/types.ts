import { type Token } from '@hanzo-app/message/api/general/types';
import { type GetWalletBalanceResponse } from '@hanzo-app/message/api/wallets';

export type GetWalletBalanceInput = Token & {
  nodeAddress: string;
};

export type GetWalletBalanceOutput = GetWalletBalanceResponse;
