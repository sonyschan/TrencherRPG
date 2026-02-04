/**
 * TokenDetailModal - RPG-style attribute table for token details
 * Features: Skin preview, attribute table, editable values
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getSkinById, SKINS } from '../config/skins';
import { SkinSelectionModal } from './SkinSelectionModal';
import './TokenDetailModal.css';

export function TokenDetailModal({
  partner,
  walletAddress,
  onClose,
  onUpdateDesignatedValue,
  // Skin-related props
  currentSkin,
  onSkinChange,
  getTokenUsingSkin,
  partners = [],
  idleBalance = 0, // User's $IDLE balance for legendary skins
}) {
  const { t } = useTranslation();
  const [showEditForm, setShowEditForm] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [showSkinModal, setShowSkinModal] = useState(false);

  // Get current skin info
  const skinInfo = getSkinById(currentSkin || 'villager');

  // Calculate stats
  const calculateStats = useCallback(() => {
    if (!partner) return {};

    const { currentValue, designatedValue, level, state, priceChange24h, levelInfo, hpBars } = partner;

    // Total HP blocks
    const totalHP = (() => {
      if (!hpBars) return 10;
      const bar1 = hpBars.bar1?.green || 0;
      const bar2 = hpBars.bar2?.show ? (hpBars.bar2?.green || 0) : 0;
      const bar3 = hpBars.bar3?.show ? (hpBars.bar3?.green || 0) : 0;
      return bar1 + bar2 + bar3;
    })();

    // HP change percent
    const multiplier = designatedValue > 0 ? (currentValue / designatedValue) : 1;
    const hpChangePercent = ((multiplier - 1) * 100).toFixed(2);

    // Days held (exp is in hours)
    const daysHeld = levelInfo?.exp ? Math.floor(levelInfo.exp / 24) : 0;

    // 24h change
    const has24hData = priceChange24h !== null && priceChange24h !== undefined;
    const change24h = has24hData ? priceChange24h : null;

    return {
      totalHP,
      hpChangePercent,
      daysHeld,
      change24h,
      state,
      currentValue,
      designatedValue,
      level,
    };
  }, [partner]);

  const stats = calculateStats();

  // Handle edit button click
  const handleEditClick = useCallback((e) => {
    e.stopPropagation();
    setEditValue(partner?.designatedValue?.toString() || '');
    setShowEditForm(true);
  }, [partner]);

  // Handle save designated value
  const handleSave = useCallback(async () => {
    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue <= 0) {
      setEditError(t('dialog.errorPositive'));
      return;
    }

    setEditError('');
    setIsSaving(true);
    try {
      await onUpdateDesignatedValue(partner.tokenAddress, newValue);
      setShowEditForm(false);
    } catch (error) {
      console.error('Failed to update designated value:', error);
      setEditError(t('dialog.errorUpdate'));
    } finally {
      setIsSaving(false);
    }
  }, [editValue, partner, onUpdateDesignatedValue, t]);

  // Handle cancel edit
  const handleCancel = useCallback(() => {
    setShowEditForm(false);
    setEditValue('');
    setEditError('');
  }, []);

  if (!partner) return null;

  // Find skin thumbnail path
  const getSkinThumbnail = (skinId) => {
    const skin = SKINS[skinId];
    return skin?.icon || '/assets/skin-icon/villager.png';
  };

  return (
    <div className="token-detail-modal">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-container">
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-content rpg-style">
          {/* Header with Token Avatar and Skin Preview */}
          <div className="modal-header-row">
            {/* Token Avatar */}
            <div className="token-avatar-section">
              <div className="token-avatar-large">
                {partner.logoUrl ? (
                  <img src={partner.logoUrl} alt={partner.tokenSymbol} referrerPolicy="no-referrer" />
                ) : (
                  <div className="avatar-placeholder-large">
                    {partner.tokenSymbol?.[0] || '?'}
                  </div>
                )}
              </div>
              <div className="avatar-label">{partner.tokenSymbol}</div>
            </div>

            {/* Skin Preview */}
            <div className="skin-preview-section">
              <div className="skin-preview-frame">
                <img
                  src={getSkinThumbnail(currentSkin || 'villager')}
                  alt={skinInfo.name}
                  className="skin-preview-img"
                />
              </div>
              <div className="avatar-label">{skinInfo.name}</div>
            </div>
          </div>

          {/* Social links bar */}
          <SocialLinksBar
            socials={partner.socials}
            websites={partner.websites}
            dexscreenerUrl={partner.dexscreenerUrl}
          />

          {/* RPG Attribute Table */}
          <div className="rpg-stats-table">
            <div className="stat-row">
              <span className="stat-label">Token</span>
              <span className="stat-value">{partner.tokenSymbol}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Skin</span>
              <span className="stat-value">
                {skinInfo.name}
                {!partner.isDemo && (
                  <button
                    className="inline-btn change-btn"
                    onClick={(e) => { e.stopPropagation(); setShowSkinModal(true); }}
                  >
                    Change
                  </button>
                )}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Level</span>
              <span className="stat-value stat-highlight">{stats.level}</span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Age</span>
              <span className="stat-value">
                {stats.daysHeld > 0 ? `${stats.daysHeld} days` : 'New partner!'}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">HP</span>
              <span className="stat-value">
                <span className={`hp-value ${stats.state}`}>
                  {stats.totalHP}
                </span>
                <span className={`hp-change ${parseFloat(stats.hpChangePercent) >= 0 ? 'positive' : 'negative'}`}>
                  ({parseFloat(stats.hpChangePercent) >= 0 ? '+' : ''}{stats.hpChangePercent}%)
                </span>
                {!partner.isDemo && (
                  <button
                    className="inline-btn edit-btn"
                    onClick={handleEditClick}
                  >
                    Edit
                  </button>
                )}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">24h</span>
              <span className="stat-value">
                {stats.change24h !== null ? (
                  <span className={`change-value ${stats.change24h >= 0 ? 'positive' : 'negative'}`}>
                    {stats.change24h >= 0 ? '+' : ''}{stats.change24h.toFixed(2)}%
                  </span>
                ) : (
                  <span className="no-data">Refresh for data</span>
                )}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Value</span>
              <span className="stat-value stat-currency">
                ${stats.currentValue?.toFixed(2) || '0.00'}
              </span>
            </div>

            <div className="stat-row">
              <span className="stat-label">Base</span>
              <span className="stat-value stat-currency muted">
                ${stats.designatedValue?.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          {/* Edit form */}
          {showEditForm && (
            <div className="edit-form" onClick={(e) => e.stopPropagation()}>
              <label>New Base Value ($)</label>
              <input
                type="number"
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  setEditError('');
                }}
                placeholder="Enter new base value"
                min="0.01"
                step="0.01"
                autoFocus
              />
              {editError && <div className="edit-error">{editError}</div>}
              <div className="edit-actions">
                <button className="btn-cancel" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </button>
                <button className="btn-save" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Demo message */}
          {partner.isDemo && (
            <div className="demo-hint">
              <span className="demo-icon">💡</span>
              Connect your wallet to track your own tokens!
            </div>
          )}
        </div>
      </div>

      {/* Skin Selection Modal */}
      {showSkinModal && (
        <SkinSelectionModal
          partner={partner}
          currentSkin={currentSkin || 'villager'}
          onSelect={(skinId) => {
            onSkinChange && onSkinChange(partner.tokenAddress, skinId);
          }}
          onClose={() => setShowSkinModal(false)}
          getTokenUsingSkin={getTokenUsingSkin}
          partners={partners}
          idleBalance={idleBalance}
        />
      )}
    </div>
  );
}

/**
 * SocialLinksBar - Display social links with icons
 */
function SocialLinksBar({ socials = [], websites = [], dexscreenerUrl }) {
  // Get social link by type
  const getSocialByType = (type) => {
    return socials.find(s =>
      s.type?.toLowerCase() === type ||
      s.label?.toLowerCase() === type
    );
  };

  const twitter = getSocialByType('twitter') || getSocialByType('x');
  const telegram = getSocialByType('telegram');
  const discord = getSocialByType('discord');

  // Get first website
  const website = websites.length > 0
    ? (typeof websites[0] === 'string' ? { url: websites[0] } : websites[0])
    : null;

  const hasLinks = twitter || telegram || discord || website || dexscreenerUrl;
  if (!hasLinks) return null;

  const handleLinkClick = (e, url) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="social-links-bar" onClick={(e) => e.stopPropagation()}>
      {twitter && (
        <button
          className="social-link-btn"
          onClick={(e) => handleLinkClick(e, twitter.url)}
          title="X (Twitter)"
        >
          <XIcon />
        </button>
      )}
      {telegram && (
        <button
          className="social-link-btn"
          onClick={(e) => handleLinkClick(e, telegram.url)}
          title="Telegram"
        >
          <TelegramIcon />
        </button>
      )}
      {discord && (
        <button
          className="social-link-btn"
          onClick={(e) => handleLinkClick(e, discord.url)}
          title="Discord"
        >
          <DiscordIcon />
        </button>
      )}
      {website && (
        <button
          className="social-link-btn"
          onClick={(e) => handleLinkClick(e, website.url)}
          title="Website"
        >
          <WebsiteIcon />
        </button>
      )}
      {dexscreenerUrl && (
        <button
          className="social-link-btn dexscreener"
          onClick={(e) => handleLinkClick(e, dexscreenerUrl)}
          title="DexScreener"
        >
          <DexScreenerIcon />
        </button>
      )}
    </div>
  );
}

// X (Twitter) Icon
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Telegram Icon
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

// Discord Icon
function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

// Website Icon
function WebsiteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

// DexScreener Icon (Chart icon)
function DexScreenerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
