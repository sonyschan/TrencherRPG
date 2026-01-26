/**
 * Header Component with Privy wallet connection
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useTranslation } from 'react-i18next';
import SettingsMenu from './SettingsMenu';
import './Header.css';

const COOLDOWN_DURATION = 60 * 60; // 1 hour in seconds
const AUTO_REFRESH_INTERVAL = 10 * 60; // 10 minutes in seconds
const PREMIUM_THRESHOLD = 100000; // 100,000 $idle tokens

export function Header({ wallet, onRefresh, loading, lastUpdated, access, isConnected }) {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { t } = useTranslation();

  // Cooldown state for basic users
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Auto-refresh state for premium users
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL);
  const autoRefreshRef = useRef(null);

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

  // Auto-refresh timer for premium users
  useEffect(() => {
    if (autoRefreshEnabled && isPremium) {
      autoRefreshRef.current = setInterval(() => {
        setAutoRefreshCountdown(prev => {
          if (prev <= 1) {
            onRefresh();
            return AUTO_REFRESH_INTERVAL;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(autoRefreshRef.current);
    } else {
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL);
    }
  }, [autoRefreshEnabled, isPremium, onRefresh]);

  const handleRefresh = useCallback(() => {
    if (isPremium) {
      // Toggle auto-refresh for premium users
      const wasEnabled = autoRefreshEnabled;
      setAutoRefreshEnabled(prev => !prev);
      setAutoRefreshCountdown(AUTO_REFRESH_INTERVAL);

      // When enabling auto-refresh, check if last refresh was more than 10 minutes ago
      if (!wasEnabled) {
        const timeSinceLastUpdate = lastUpdated
          ? Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
          : Infinity;

        // If stale (>10 min), trigger immediate refresh
        if (timeSinceLastUpdate >= AUTO_REFRESH_INTERVAL) {
          console.log(`Last refresh was ${timeSinceLastUpdate}s ago, triggering immediate refresh`);
          onRefresh();
        }
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
    return {
      show: true,
      disabled: loading || onCooldown,
      isAuto: false,
      text: loading ? t('header.updating') : (onCooldown ? formatCooldown(cooldownRemaining) : t('header.refresh')),
      className: `btn-refresh ${onCooldown ? 'cooldown' : ''}`
    };
  };

  const refreshState = getRefreshButtonState();

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">
          <span className="logo-icon">⚔️</span>
          idleTrencher
        </h1>
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
              </div>
            )}

            {authenticated ? (
              <span className="wallet-address">
                {formatAddress(user?.wallet?.address)}
              </span>
            ) : (
              <button className="btn-connect" onClick={login}>
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
  );
}
