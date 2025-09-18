import { getWalletBalance as getWalletBalanceApi } from '@hanzo-app/message/api/wallets';
import { type GetWalletBalanceInput } from './types';

export const getWalletBalance = async ({
  nodeAddress,
  token,
}: GetWalletBalanceInput) => {
  const response = await getWalletBalanceApi(nodeAddress, token);
  return response;
};
export * from './useGetWalletBalance';
