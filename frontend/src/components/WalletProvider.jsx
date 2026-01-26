/**
 * Privy Wallet Provider - Solana Only
 * https://docs.privy.io/basics/react/setup
 *
 * Supports both:
 * - External wallets (Phantom, OKX, etc.) - best for desktop
 * - Embedded wallet (via email/social) - best for mobile PWA
 */

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Solana wallet connectors for external wallets (Phantom, Solflare, OKX, etc.)
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true
});

// Detect if running on mobile
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

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
          logo: '/assets/idleTrencherLogo.png',
          walletChainType: 'solana-only',
          // On mobile, show email login first for better UX
          loginMessage: isMobile
            ? 'Sign in to view your token partners'
            : undefined
        },
        // Login methods - email for embedded wallet, wallet for external
        // On mobile: only email/google (we use MobileWalletSelector for external wallets)
        // On desktop: wallet first, then email/google
        loginMethods: isMobile
          ? ['email', 'google']
          : ['wallet', 'email', 'google'],
        // Solana embedded wallet configuration
        embeddedWallets: {
          // Create embedded wallet for users who login via email/social
          createOnLogin: 'users-without-wallets',
          requireUserPasswordOnCreate: false,
          // Don't prompt for signature on every action (better mobile UX)
          noPromptOnSignature: true
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
