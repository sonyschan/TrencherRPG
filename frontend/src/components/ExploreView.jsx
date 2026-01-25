/**
 * ExploreView - View for displaying another wallet's village (cached data)
 * Features:
 * - Back button (top-left) to return home
 * - No feature menu (bottom-right)
 * - Shows cached timestamp
 */

import { useState, useEffect } from 'react';
import { Scene3D } from './Scene3D';
import './ExploreView.css';

export function ExploreView({ walletAddress, data, onBack }) {
  const [showCacheInfo, setShowCacheInfo] = useState(true);

  // Format cached time
  const formatCachedTime = (isoString) => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Auto-hide cache info after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowCacheInfo(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="explore-view">
      {/* Back Button */}
      <button className="back-button" onClick={onBack} title="Return Home">
        <span className="back-arrow">←</span>
        <span className="back-text">Home</span>
      </button>

      {/* Wallet Info Header */}
      <div className="explore-header">
        <div className="explore-wallet-info">
          <span className="explore-icon">🔍</span>
          <span className="explore-address">{formatAddress(walletAddress)}</span>
          <span className="explore-label">Village</span>
        </div>
        {data?.totalValue && (
          <div className="explore-value">
            ${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {/* Cache Info Toast */}
      {showCacheInfo && data?.lastCached && (
        <div className={`cache-info ${data.wasRefreshed ? 'refreshed' : ''}`}>
          {data.wasRefreshed ? (
            <span>Data refreshed just now</span>
          ) : (
            <span>Cached: {formatCachedTime(data.lastCached)}</span>
          )}
        </div>
      )}

      {/* 3D Scene */}
      <div className="explore-scene-container">
        <Scene3D partners={data?.partners || []} isExploreMode={true} />
      </div>

      {/* Partner List (simplified, read-only) */}
      <div className="explore-partner-list">
        <h3 className="list-title">Partners</h3>
        <div className="partners-container">
          {data?.partners?.map((partner) => (
            <ExplorePartnerCard key={partner.tokenAddress} partner={partner} />
          ))}
          {(!data?.partners || data.partners.length === 0) && (
            <p className="no-partners">No partners to display</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExplorePartnerCard({ partner }) {
  const { tokenSymbol, logoUrl, currentValue, hpBars, level, rank } = partner;

  const changePercent = hpBars?.changePercent ?? 0;
  const multiplier = hpBars?.multiplier ?? 1;

  const getState = () => {
    if (multiplier > 1.01) return 'increasing';
    if (multiplier < 0.99) return 'decreasing';
    return 'stable';
  };
  const state = getState();

  const formatValue = (value) => {
    if (!value) return '$0';
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className={`explore-partner-card ${state}`}>
      <div className="partner-rank">#{rank}</div>

      <div className="partner-avatar">
        {logoUrl ? (
          <img src={logoUrl} alt={tokenSymbol} />
        ) : (
          <div className="avatar-placeholder">{tokenSymbol?.[0] || '?'}</div>
        )}
      </div>

      <div className="partner-info">
        <div className="partner-header">
          <span className="partner-symbol">{tokenSymbol}</span>
          <span className="level-badge">Lv{level}</span>
        </div>
        <div className="partner-value">
          <span className="value">{formatValue(currentValue)}</span>
          {changePercent !== 0 && (
            <span className={`change ${state}`}>
              {changePercent > 0 ? '+' : ''}{changePercent?.toFixed(2)}%
            </span>
          )}
        </div>
      </div>

      <div className={`hp-indicator ${state}`}>
        {state === 'increasing' && '▲'}
        {state === 'decreasing' && '▼'}
        {state === 'stable' && '●'}
      </div>
    </div>
  );
}

export default ExploreView;
