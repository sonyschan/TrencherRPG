/**
 * PartnerList - Side panel showing partner details
 */

import './PartnerList.css';

const IDLE_PURCHASE_URL = 'https://web3.okx.com/ul/F4Aow2o?ref=H2CRYTO5';
const SKELETON_COUNT = 3; // Number of skeleton cards to show while loading

export function PartnerList({ partners, access, loading, onPartnerClick }) {
  // Show skeleton placeholders while loading
  if (loading) {
    return (
      <div className="partner-list">
        <h2 className="list-title">Your Partners</h2>
        <div className="partners-container">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <SkeletonCard key={i} index={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!partners || partners.length === 0) {
    return (
      <div className="partner-list empty">
        <p>Connect your wallet to see your partners</p>
      </div>
    );
  }

  const lockedSlots = access?.lockedSlots || 0;
  const hasLockedSlots = lockedSlots > 0;

  return (
    <div className="partner-list">
      <h2 className="list-title">Your Partners</h2>
      <div className="partners-container">
        {partners.map((partner) => (
          <PartnerCard
            key={partner.tokenAddress}
            partner={partner}
            onClick={() => onPartnerClick?.(partner)}
          />
        ))}

        {/* CTA to unlock more slots */}
        {hasLockedSlots && (
          <UnlockCTA
            lockedSlots={lockedSlots}
            requiredForNext={access?.requiredForNext}
          />
        )}

        {/* CTA to unlock auto-refresh feature */}
        {access && access.idleBalance < 100000 && (
          <AutoRefreshCTA idleBalance={access.idleBalance} />
        )}
      </div>
    </div>
  );
}

function SkeletonCard({ index }) {
  return (
    <div className="partner-card skeleton">
      <div className="partner-rank">#{index + 1}</div>
      <div className="partner-avatar">
        <div className="skeleton-circle" />
      </div>
      <div className="partner-info">
        <div className="partner-header">
          <div className="skeleton-text skeleton-symbol" />
          <div className="skeleton-text skeleton-level" />
        </div>
        <div className="partner-value">
          <div className="skeleton-text skeleton-value" />
        </div>
        <div className="partner-exp">
          <div className="skeleton-bar" />
        </div>
      </div>
    </div>
  );
}

function PartnerCard({ partner, onClick }) {
  const {
    tokenSymbol,
    logoUrl,
    currentValue,
    hpBars,
    level,
    levelInfo,
    rank,
    state,
    priceChange24h
  } = partner;

  // Use 24h price change for display, fall back to hpBars change
  const displayChange = priceChange24h !== null && priceChange24h !== undefined
    ? priceChange24h
    : (hpBars?.changePercent ?? 0);

  // State comes from backend (based on 24h change)

  const formatValue = (value) => {
    if (!value) return '$0';
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getLevelClass = (lvl) => {
    if (lvl >= 60) return 'level-legendary';
    if (lvl >= 50) return 'level-elite';
    if (lvl >= 40) return 'level-veteran';
    if (lvl >= 30) return 'level-senior';
    if (lvl >= 20) return 'level-intermediate';
    if (lvl >= 10) return 'level-junior';
    return 'level-novice';
  };

  return (
    <div className={`partner-card ${state || 'stable'}`} onClick={onClick} role="button" tabIndex={0}>
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
          <span className={`level-badge ${getLevelClass(level)}`}>
            Lv{level}
          </span>
        </div>

        <div className="partner-value">
          <span className="value">{formatValue(currentValue)}</span>
          {displayChange !== 0 && (
            <span className={`change ${state || 'stable'}`}>
              {displayChange > 0 ? '+' : ''}{displayChange?.toFixed(2)}%
            </span>
          )}
        </div>

        {levelInfo && (
          <div className="partner-exp">
            <div className="exp-bar">
              <div
                className="exp-fill"
                style={{ width: `${levelInfo.progress}%` }}
              />
            </div>
            <span className="exp-text">
              {levelInfo.isMaxLevel ? 'MAX' : 'EXP'}
            </span>
          </div>
        )}
      </div>

      {/* HP indicator */}
      <div className={`hp-indicator ${state || 'stable'}`}>
        {state === 'increasing' && '▲'}
        {state === 'decreasing' && '▼'}
        {(!state || state === 'stable') && '●'}
      </div>
    </div>
  );
}

function UnlockCTA({ lockedSlots, requiredForNext }) {
  const handleClick = () => {
    window.open(IDLE_PURCHASE_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="unlock-cta" onClick={handleClick}>
      <div className="cta-icon">🔒</div>
      <div className="cta-content">
        <div className="cta-title">Unlock {lockedSlots} more slots</div>
        <div className="cta-subtitle">
          Get {requiredForNext?.toLocaleString()} $idle for next slot
        </div>
      </div>
      <div className="cta-arrow">→</div>
    </div>
  );
}

const AUTO_REFRESH_THRESHOLD = 100000;

function AutoRefreshCTA({ idleBalance }) {
  const handleClick = () => {
    window.open(IDLE_PURCHASE_URL, '_blank', 'noopener,noreferrer');
  };

  const remaining = AUTO_REFRESH_THRESHOLD - (idleBalance || 0);

  return (
    <div className="unlock-cta auto-refresh-cta" onClick={handleClick}>
      <div className="cta-icon">⚡</div>
      <div className="cta-content">
        <div className="cta-title">Unlock Auto-Refresh</div>
        <div className="cta-subtitle">
          Hold {remaining.toLocaleString()} more $idle
        </div>
      </div>
      <div className="cta-arrow">→</div>
    </div>
  );
}
