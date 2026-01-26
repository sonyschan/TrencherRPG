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

// Detect device and browser type
const userAgent = navigator.userAgent;
const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
const isInWalletBrowser = /Phantom|OKApp|Solflare/i.test(userAgent);

/**
 * Determine login methods based on context:
 * - In wallet's in-app browser: Only show wallet (it's already injected)
 * - On mobile browser: Only email/google (use MobileWalletSelector for wallets)
 * - On desktop: All options
 */
function getLoginMethods() {
  if (isInWalletBrowser) {
    // In wallet's built-in browser - wallet is injected, show only wallet option
    return ['wallet'];
  }
  if (isMobile) {
    // Mobile browser - use MobileWalletSelector for external wallets
    return ['email', 'google'];
  }
  // Desktop - show all options
  return ['wallet', 'email', 'google'];
}

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
        // Login methods based on context (see getLoginMethods function)
        loginMethods: getLoginMethods(),
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
