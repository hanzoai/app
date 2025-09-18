import { restoreCoinbaseMPCWallet as restoreCoinbaseMPCWalletApi } from '@hanzo-app/message/api/wallets';

import { type RestoreCoinbaseMpcWalletInput } from './types';

export const restoreCoinbaseMPCWallet = async ({
  nodeAddress,
  token,
  network,
  name,
  privateKey,
  walletId,
  useServerSigner,
  role,
}: RestoreCoinbaseMpcWalletInput) => {
  const data = await restoreCoinbaseMPCWalletApi(nodeAddress, token, {
    network: network,
    wallet_id: walletId,
    config: {
      name: name,
      private_key: privateKey,
      wallet_id: walletId,
      use_server_signer: useServerSigner,
    },
    role: role,
  });
  return data;
};
export * from './useRestoreCoinbaseMpcWallet';
