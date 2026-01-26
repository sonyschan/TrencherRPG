import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy } from '@privy-io/react-auth';
import { useSolanaWallets } from '@privy-io/react-auth/solana';
import { languages } from '../i18n';

export default function SettingsMenu({ authenticated, onLogout, walletAddress }) {
  const { t, i18n } = useTranslation();
  const { user } = usePrivy();
  // Use Solana-specific export for Solana embedded wallets
  const { exportWallet } = useSolanaWallets();
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [showWalletInfo, setShowWalletInfo] = useState(false);
  const menuRef = useRef(null);

  // Check if user has a Solana embedded wallet
  const hasEmbeddedWallet = user?.linkedAccounts?.some(
    a => a.type === 'wallet' &&
         a.walletClientType === 'privy' &&
         a.chainType === 'solana'
  );

  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLanguageChange = (langCode) => {
    if (langCode === i18n.language) return;

    const newLang = languages.find(l => l.code === langCode);
    i18n.changeLanguage(langCode);
    setIsOpen(false);

    // Show toast notification
    setToast(newLang?.name || langCode);
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setToast(t('settings.addressCopied'));
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleExportWallet = async () => {
    if (!walletAddress) return;
    try {
      // Export the specific Solana wallet by address
      await exportWallet({ address: walletAddress });
    } catch (err) {
      console.error('Failed to export Solana wallet:', err);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatAddressMedium = (address) => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  return (
    <div className="settings-menu" ref={menuRef}>
      <button
        className="settings-button"
        onClick={() => setIsOpen(!isOpen)}
        title={t('settings.title')}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
      </button>

      {isOpen && (
        <div className="settings-dropdown">
          <div className="settings-section">
            <div className="settings-label">{t('settings.language')}</div>
            <div className="language-options">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`language-option ${lang.code === i18n.language ? 'active' : ''}`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  <span className="lang-name">{lang.name}</span>
                  {lang.code === i18n.language && (
                    <span className="check-icon">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {authenticated && (
            <>
              <div className="settings-divider"></div>
              <div className="settings-section">
                <div className="settings-label">{t('settings.wallet')}</div>

                {/* Wallet address with copy button */}
                <button className="wallet-address-row" onClick={handleCopyAddress}>
                  <span className="wallet-address-text">{formatAddressMedium(walletAddress)}</span>
                  <span className="copy-icon">📋</span>
                </button>

                {/* Export wallet (only for embedded wallets) */}
                {hasEmbeddedWallet && (
                  <button className="settings-option" onClick={handleExportWallet}>
                    <span>🔑</span>
                    <span>{t('settings.exportWallet')}</span>
                  </button>
                )}

                {/* Embedded wallet info */}
                {hasEmbeddedWallet && (
                  <div className="wallet-info-note">
                    {t('settings.embeddedWalletNote')}
                  </div>
                )}

                <button className="logout-option" onClick={handleLogout}>
                  {t('settings.walletLogout')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Language change toast notification */}
      {toast && (
        <div className="language-toast">
          {t('settings.languageChanged', { language: toast })}
        </div>
      )}
    </div>
  );
}
