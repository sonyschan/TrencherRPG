/**
 * MobileWalletSelector - Deep link to wallet apps for mobile browser users
 *
 * On mobile browsers, external wallets can't inject directly.
 * This component provides deep links to open our site in wallet in-app browsers.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './MobileWalletSelector.css';

// Wallet configurations with deep link formats
const WALLETS = [
  {
    id: 'phantom',
    name: 'Phantom',
    icon: '👻',
    color: '#AB9FF2',
    // https://docs.phantom.com/phantom-deeplinks/other-methods/browse
    getDeepLink: (url, ref) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`,
    appStoreUrl: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=app.phantom',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: '⬡',
    color: '#000000',
    // https://web3.okx.com/build/docs/waas/app-universal-link
    getDeepLink: (url) => {
      const deepLink = `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url)}`;
      return `https://web3.okx.com/download?deeplink=${encodeURIComponent(deepLink)}`;
    },
    appStoreUrl: 'https://apps.apple.com/app/okx-buy-bitcoin-btc-crypto/id1327268470',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.okinc.okex.gp',
  },
  {
    id: 'solflare',
    name: 'Solflare',
    icon: '🔥',
    color: '#FC822B',
    // https://docs.solflare.com/solflare/technical/deeplinks/other-methods/browse
    getDeepLink: (url, ref) =>
      `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`,
    appStoreUrl: 'https://apps.apple.com/app/solflare/id1580902717',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
  },
];

export function MobileWalletSelector({ isOpen, onClose, onEmailLogin }) {
  const { t } = useTranslation();
  const [selectedWallet, setSelectedWallet] = useState(null);

  if (!isOpen) return null;

  const currentUrl = window.location.href;
  const refUrl = window.location.origin;

  const handleWalletClick = (wallet) => {
    const deepLink = wallet.getDeepLink(currentUrl, refUrl);

    // Track which wallet was selected (for potential fallback)
    setSelectedWallet(wallet);

    // Open deep link
    window.location.href = deepLink;

    // Note: If the app is not installed, the universal link
    // will typically redirect to app store automatically
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="mobile-wallet-overlay" onClick={handleBackdropClick}>
      <div className="mobile-wallet-modal">
        <button className="mobile-wallet-close" onClick={onClose}>×</button>

        <h2 className="mobile-wallet-title">
          {t('mobileWallet.title', 'Connect Wallet')}
        </h2>

        <p className="mobile-wallet-description">
          {t('mobileWallet.description', 'Select your wallet to open this site in the wallet browser')}
        </p>

        <div className="mobile-wallet-list">
          {WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              className="mobile-wallet-option"
              onClick={() => handleWalletClick(wallet)}
              style={{ '--wallet-color': wallet.color }}
            >
              <span className="mobile-wallet-icon">{wallet.icon}</span>
              <span className="mobile-wallet-name">{wallet.name}</span>
              <span className="mobile-wallet-arrow">→</span>
            </button>
          ))}
        </div>

        <div className="mobile-wallet-divider">
          <span>{t('mobileWallet.or', 'or')}</span>
        </div>

        <button className="mobile-wallet-email" onClick={onEmailLogin}>
          {t('mobileWallet.useEmail', 'Continue with Email / Google')}
        </button>

        <p className="mobile-wallet-note">
          {t('mobileWallet.note', 'Wallet not installed? The link will take you to the app store.')}
        </p>
      </div>
    </div>
  );
}
