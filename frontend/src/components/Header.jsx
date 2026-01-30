/**
 * Header Component with Privy wallet connection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslation } from 'react-i18next';
import SettingsMenu from './SettingsMenu';
import { MobileWalletSelector } from './MobileWalletSelector';
import { checkIdleBalance } from '../services/api';
import './Header.css';

// App version from package.json
const APP_VERSION = __APP_VERSION__ || '0.0.0';

// Detect mobile browser (not in-app wallet browser)
const isMobileBrowser = () => {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  // Check if we're NOT in a wallet's in-app browser
  const isInWalletBrowser = /Phantom|OKApp|Solflare/i.test(ua);
  return isMobile && !isInWalletBrowser;
};

const COOLDOWN_DURATION = 60 * 60; // 1 hour in seconds
const AUTO_REFRESH_INTERVAL = 10 * 60; // 10 minutes in seconds
const PREMIUM_THRESHOLD = 100000; // 100,000 $IDLE tokens

export function Header({ wallet, onRefresh, loading, isLoading, isUpdating, lastUpdated, access, isConnected }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { t } = useTranslation();

  // Mobile wallet selector state
  const [showMobileWalletSelector, setShowMobileWalletSelector] = useState(false);

  // Cooldown state for basic users
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Verify IDLE purchase state
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto-refresh state for premium users
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL);
  const autoRefreshRef = useRef(null);
  const nextRefreshTimeRef = useRef(null); // Store next refresh timestamp

  const isPremium = access && access.idleBalance >= PREMIUM_THRESHOLD;

  // Get wallet address for per-wallet cooldown tracking
  const walletAddress = wallet?.address;

  // Load cooldown from localStorage (per wallet address)
  useEffect(() => {
    if (isConnected && !isPremium && walletAddress) {
      const storageKey = `lastRefreshTime_${walletAddress}`;
      const lastRefreshTime = localStorage.getItem(storageKey);
      if (lastRefreshTime) {
        const elapsed = Math.floor((Date.now() - parseInt(lastRefreshTime)) / 1000);
        const remaining = Math.max(0, COOLDOWN_DURATION - elapsed);
        setCooldownRemaining(remaining);
      } else {
        setCooldownRemaining(0);
      }
    }
  }, [isConnected, isPremium, walletAddress]);

  // Cooldown timer for basic users
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  // Auto-refresh timer for premium users (with visibility API support)
  useEffect(() => {
    if (autoRefreshEnabled && isPremium) {
      // Initialize next refresh time if not set
      if (!nextRefreshTimeRef.current) {
        nextRefreshTimeRef.current = Date.now() + AUTO_REFRESH_INTERVAL * 1000;
      }

      // Timer that checks based on timestamp (resilient to background throttling)
      autoRefreshRef.current = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((nextRefreshTimeRef.current - now) / 1000));

        if (remaining <= 0) {
          onRefresh();
          nextRefreshTimeRef.current = Date.now() + AUTO_REFRESH_INTERVAL * 1000;
          setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL);
        } else {
          setAutoRefreshCountdown(remaining);
        }
      }, 1000);

      // Handle visibility change - check if refresh is due when tab becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && nextRefreshTimeRef.current) {
          const now = Date.now();
          const remaining = Math.ceil((nextRefreshTimeRef.current - now) / 1000);

          if (remaining <= 0) {
            // Refresh was due while tab was hidden - trigger immediately
            console.log('Tab became visible, triggering missed auto-refresh');
            onRefresh();
            nextRefreshTimeRef.current = Date.now() + AUTO_REFRESH_INTERVAL * 1000;
            setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL);
          } else {
            // Update countdown to correct value
            setAutoRefreshCountdown(remaining);
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        clearInterval(autoRefreshRef.current);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL);
      nextRefreshTimeRef.current = null;
    }
  }, [autoRefreshEnabled, isPremium, onRefresh]);

  const handleRefresh = useCallback(() => {
    if (isPremium) {
      // Toggle auto-refresh for premium users
      const wasEnabled = autoRefreshEnabled;
      setAutoRefreshEnabled(prev => !prev);
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL);

      // When enabling auto-refresh, set next refresh time and check if stale
      if (!wasEnabled) {
        nextRefreshTimeRef.current = Date.now() + AUTO_REFRESH_INTERVAL * 1000;
        const timeSinceLastUpdate = lastUpdated
          ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
          : Infinity;

        // If stale (>10 min), trigger immediate refresh
        if (timeSinceLastUpdate >= AUTO_REFRESH_INTERVAL) {
          console.log(`Last refresh was ${timeSinceLastUpdate}s ago, triggering immediate refresh`);
          onRefresh();
        }
      } else {
        // Disabling - clear the next refresh time
        nextRefreshTimeRef.current = null;
      }
    } else {
      // Manual refresh with cooldown for basic users
      if (cooldownRemaining === 0 && walletAddress) {
        onRefresh();
        const storageKey = `lastRefreshTime_${walletAddress}`;
        localStorage.setItem(storageKey, Date.now().toString());
        setCooldownRemaining(COOLDOWN_DURATION);
      }
    }
  }, [isPremium, autoRefreshEnabled, cooldownRemaining, onRefresh, walletAddress, lastUpdated]);

  // Verify $IDLE purchase - lightweight check without consuming Helius quota
  const handleVerifyIdlePurchase = useCallback(async () => {
    if (!walletAddress || isVerifying) return;

    setIsVerifying(true);
    try {
      const result = await checkIdleBalance(walletAddress);

      if (result.hasIdle) {
        // User has $IDLE! Clear cooldown and trigger full refresh
        const storageKey = `lastRefreshTime_${walletAddress}`;
        localStorage.removeItem(storageKey);
        setCooldownRemaining(0);

        // Trigger full refresh to update access level
        onRefresh();
      } else {
        // No $IDLE found - show feedback (could use toast, but keeping simple)
        console.log('No $IDLE tokens found in wallet');
      }
    } catch (error) {
      console.error('Error verifying IDLE purchase:', error);
    } finally {
      setIsVerifying(false);
    }
  }, [walletAddress, isVerifying, onRefresh]);

  // Show verify button when: basic user (idleBalance === 0) AND on cooldown
  const showVerifyButton = isConnected && !isPremium && access?.idleBalance === 0 && cooldownRemaining > 0;

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatValue = (value) => {
    if (!value) return '$0.00';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatCooldown = (seconds) => {
    const mins = Math.ceil(seconds / 60);
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  };

  const formatCountdown = (seconds) => {
    return `${seconds} sec`;
  };

  // Determine refresh button state and text
  const getRefreshButtonState = () => {
    if (!isConnected) {
      return { show: false };
    }

    if (isPremium) {
      return {
        show: true,
        disabled: loading,
        isAuto: true,
        isActive: autoRefreshEnabled,
        text: autoRefreshEnabled ? formatCountdown(autoRefreshCountdown) : 'Auto',
        className: autoRefreshEnabled ? 'btn-refresh auto-active' : 'btn-refresh auto'
      };
    }

    // Basic user with cooldown
    const onCooldown = cooldownRemaining > 0;

    // Determine button text based on loading state
    let buttonText = t('header.refresh');
    if (isLoading) {
      buttonText = t('header.loading');
    } else if (isUpdating) {
      buttonText = t('header.updating');
    } else if (onCooldown) {
      buttonText = formatCooldown(cooldownRemaining);
    }

    return {
      show: true,
      disabled: loading || onCooldown,
      isAuto: false,
      text: buttonText,
      className: `btn-refresh ${onCooldown ? 'cooldown' : ''}`
    };
  };

  const refreshState = getRefreshButtonState();

  // Handle connect button click
  const handleConnectClick = useCallback(() => {
    if (isMobileBrowser()) {
      // Show mobile wallet selector on mobile browsers
      setShowMobileWalletSelector(true);
    } else {
      // Use Privy's default login on desktop or wallet in-app browsers
      login();
    }
  }, [login]);

  // Handle email/social login from mobile wallet selector
  const handleEmailLogin = useCallback(() => {
    setShowMobileWalletSelector(false);
    login();
  }, [login]);

  return (
  <>
    <header className="header">
      <div className="header-left">
        <h1 className="logo">
          <span className="logo-icon">⚔️</span>
          idleTrencher
          <span className="app-version">v{APP_VERSION}</span>
        </h1>
        <a
          href="https://idletrencher.xyz/wiki"
          target="_blank"
          rel="noopener noreferrer"
          className="wiki-link"
        >
          📖 Wiki
        </a>
      </div>

      <div className="header-center">
        {wallet && (
          <div className="wallet-stats">
            <div className="stat">
              <span className="stat-label">Portfolio</span>
              <span className="stat-value">{formatValue(wallet.totalValue)}</span>
              {wallet.valueChange && wallet.valueChange.changePercent !== 0 && (
                <span className={`stat-change ${wallet.valueChange.state}`}>
                  {wallet.valueChange.changePercent > 0 ? '+' : ''}
                  {wallet.valueChange.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="header-right">
        {ready && (
          <>
            {/* Refresh button - only for logged in users */}
            {refreshState.show && (
              <div className="refresh-section">
                {lastUpdated && (
                  <span className="last-updated">
                    {t('header.updated', { time: formatTime(lastUpdated) })}
                  </span>
                )}
                <button
                  className={refreshState.className}
                  onClick={handleRefresh}
                  disabled={refreshState.disabled}
                  title={refreshState.isAuto ? t('header.toggleAutoRefresh') : t('header.refreshPortfolio')}
                >
                  <span className="refresh-icon">
                    {refreshState.isAuto ? (refreshState.isActive ? '◉' : '○') : '⏳'}
                  </span>
                  <span className="refresh-text">{refreshState.text}</span>
                </button>
                {/* Verify $IDLE purchase button - shown when basic user on cooldown */}
                {showVerifyButton && (
                  <button
                    className="btn-verify-idle"
                    onClick={handleVerifyIdlePurchase}
                    disabled={isVerifying}
                    title={t('header.verifyIdlePurchase')}
                  >
                    {isVerifying ? '...' : '✓ $IDLE'}
                  </button>
                )}
              </div>
            )}

            {authenticated ? (
              <span className="wallet-address">
                {formatAddress(user?.wallet?.address)}
              </span>
            ) : (
              <button className="btn-connect" onClick={handleConnectClick}>
                {t('header.connectWallet')}
              </button>
            )}

            {/* Settings Menu - rightmost position */}
            <SettingsMenu
              authenticated={authenticated}
              onLogout={logout}
              walletAddress={user?.wallet?.address}
            />
          </>
        )}
      </div>
    </header>

    {/* Mobile Wallet Selector */}
    <MobileWalletSelector
      isOpen={showMobileWalletSelector}
      onClose={() => setShowMobileWalletSelector(false)}
      onEmailLogin={handleEmailLogin}
    />
  </>
  );
}
