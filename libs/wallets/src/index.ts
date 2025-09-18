// Wallet types and exports
export interface Wallet {
  address: string;
  balance?: string;
  name?: string;
  type?: string;
}

export interface WalletProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccounts(): Promise<string[]>;
}

// Export implementations
export const defaultWallet: Wallet = {
  address: '0x0000000000000000000000000000000000000000',
  balance: '0',
  name: 'Default Wallet'
};

export const connectWallet = async (): Promise<Wallet> => {
  return defaultWallet;
};

export const disconnectWallet = async (): Promise<void> => {
  // Disconnect logic
};

export const getWallets = (): Wallet[] => {
  return [defaultWallet];
};

export type { Wallet as WalletType };