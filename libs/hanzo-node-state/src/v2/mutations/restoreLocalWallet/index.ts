import {
  restoreLocalWallet as restoreLocalWalletapi,
  type WalletSource,
} from '@hanzo-app/message/api/wallets';

import { type RestoreLocalWalletInput } from './types';

export const restoreLocalWallet = async ({
  nodeAddress,
  token,
  network,
  privateKey,
  mnemonic,
  role,
}: RestoreLocalWalletInput) => {
  let source = {} as WalletSource;

  if (privateKey) {
    source = {
      PrivateKey: privateKey,
    };
  }
  if (mnemonic) {
    source = {
      Mnemonic: mnemonic,
    };
  }

  const data = await restoreLocalWalletapi(nodeAddress, token, {
    network: network,
    source: source,
    role: role,
  });
  return data;
};
export * from './useRestoreLocalWallet';
