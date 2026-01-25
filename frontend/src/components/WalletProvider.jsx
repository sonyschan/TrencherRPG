/**
 * Privy Wallet Provider - Solana Only
 * https://docs.privy.io/basics/react/setup
 */

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Solana wallet connectors for external wallets (Phantom, Solflare, OKX, etc.)
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true
});

export function WalletContextProvider({ children }) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID;

  if (!appId || appId === 'your-privy-app-id') {
    console.error('Missing VITE_PRIVY_APP_ID in environment variables');
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Appearance
        appearance: {
          theme: 'dark',
          accentColor: '#6366f1',
          logo: '/idle.svg',
          walletChainType: 'solana-only'
        },
        // Login methods - wallet only
        loginMethods: ['wallet'],
        // Wallet login settings
        showWalletLoginFirst: true,
        // Solana embedded wallet configuration
        embeddedWallets: {
          createOnLogin: 'off', // Don't create embedded wallet, use external
          requireUserPasswordOnCreate: false
        },
        // External wallet connectors - Solana only
        externalWallets: {
          solana: {
            connectors: solanaConnectors
          }
        },
        // Solana clusters
        solanaClusters: [
          { name: 'mainnet-beta', rpcUrl: 'https://api.mainnet-beta.solana.com' }
        ]
      }}
    >
      {children}
    </PrivyProvider>
  );
}
