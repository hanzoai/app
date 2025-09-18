import { useState, useEffect } from 'react';
import type { Wallet } from '@hanzo/wallet';

// Wallet hooks
export const useGetWalletList = () => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setWallets([
      {
        address: '0x0000000000000000000000000000000000000000',
        balance: '0',
        name: 'Default Wallet',
        type: 'ethereum'
      }
    ]);
  }, []);

  return { wallets, loading, error, refetch: () => {} };
};

export const useGetWalletBalance = (address?: string) => {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setBalance('0');
  }, [address]);

  return { balance, loading, error };
};

export const useConnectWallet = () => {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = async () => {
    setLoading(true);
    setTimeout(() => {
      setConnected(true);
      setLoading(false);
    }, 1000);
  };

  const disconnect = async () => {
    setConnected(false);
  };

  return { connected, loading, error, connect, disconnect };
};

export const useWallet = () => {
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    setWallet({
      address: '0x0000000000000000000000000000000000000000',
      balance: '0',
      name: 'Default Wallet',
      type: 'ethereum'
    });
  }, []);

  return wallet;
};