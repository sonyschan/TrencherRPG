/**
 * SkinSelectionModal - Modal for selecting and changing token skins
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllSkins, SKINS, isSkinAvailable, SKIN_CATEGORIES } from '../config/skins';
import './SkinSelectionModal.css';

// Icon size for skin icons
const ICON_SIZE = 80;

/**
 * Skin icon component using actual PNG icons
 */
function SkinIcon({ skin, isLocked, isSelected, isUsedByOther }) {
  return (
    <div
      className={`skin-icon ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''} ${isUsedByOther ? 'used' : ''}`}
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        filter: isLocked ? 'grayscale(100%)' : 'none',
        opacity: isLocked ? 0.5 : 1,
      }}
    >
      <img
        src={skin.icon}
        alt={skin.name}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: '6px',
        }}
      />
      {isLocked && <span className="lock-icon">🔒</span>}
      {isSelected && <span className="check-icon">✓</span>}
      {isUsedByOther && !isSelected && <span className="used-icon">⚠️</span>}
    </div>
  );
}

export function SkinSelectionModal({
  partner,
  currentSkin,
  onSelect,
  onClose,
  getTokenUsingSkin,
  partners = [], // All partners for showing which token is using a skin
  idleBalance = 0, // User's $IDLE balance for legendary skins
}) {
  const { t } = useTranslation();
  const [selectedSkin, setSelectedSkin] = useState(currentSkin);
  const [showConfirm, setShowConfirm] = useState(false);
  const [skinToConfirm, setSkinToConfirm] = useState(null);

  const allSkins = useMemo(() => getAllSkins(), []);
  const villagerSkins = useMemo(() => allSkins.filter(s => s.category === SKIN_CATEGORIES.VILLAGER), [allSkins]);
  const premiumSkins = useMemo(() => allSkins.filter(s => s.category === SKIN_CATEGORIES.PREMIUM), [allSkins]);
  const legendarySkins = useMemo(() => allSkins.filter(s => s.category === SKIN_CATEGORIES.LEGENDARY), [allSkins]);

  // Find partner by token mint
  const findPartnerByMint = (mint) => {
    return partners.find(p => p.tokenAddress === mint);
  };

  // Handle skin click
  const handleSkinClick = (skin) => {
    const isAvailable = isSkinAvailable(skin.id, partner.level, idleBalance);
    if (!isAvailable) return; // Can't select locked skins

    // Check if exclusive skin is used by another token
    if (skin.exclusive) {
      const usingToken = getTokenUsingSkin(skin.id);
      if (usingToken && usingToken !== partner.tokenAddress) {
        // Show confirmation dialog
        setSkinToConfirm(skin);
        setShowConfirm(true);
        return;
      }
    }

    setSelectedSkin(skin.id);
  };

  // Handle apply
  const handleApply = () => {
    if (selectedSkin !== currentSkin) {
      onSelect(selectedSkin);
    }
    onClose();
  };

  // Handle confirm reassignment
  const handleConfirmReassign = () => {
    setSelectedSkin(skinToConfirm.id);
    setShowConfirm(false);
    setSkinToConfirm(null);
  };

  // Format number with K/M suffix
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  // Get requirement text for a skin
  const getRequirementText = (skin) => {
    if (skin.idleRequired) {
      return `${formatNumber(skin.idleRequired)} $IDLE`;
    }
    if (skin.levelRequired > 1) {
      return `Lv.${skin.levelRequired}+`;
    }
    return null;
  };

  // Render skin grid
  const renderSkinGrid = (skins, title) => (
    <div className="skin-section">
      <h4 className="skin-section-title">{title}</h4>
      <div className="skin-grid">
        {skins.map(skin => {
          const isLocked = !isSkinAvailable(skin.id, partner.level, idleBalance);
          const isSelected = selectedSkin === skin.id;
          const usingToken = skin.exclusive ? getTokenUsingSkin(skin.id) : null;
          const isUsedByOther = usingToken && usingToken !== partner.tokenAddress;
          const usingPartner = isUsedByOther ? findPartnerByMint(usingToken) : null;
          const requirementText = getRequirementText(skin);

          return (
            <div
              key={skin.id}
              className={`skin-item ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSkinClick(skin)}
            >
              <SkinIcon
                skin={skin}
                isLocked={isLocked}
                isSelected={isSelected}
                isUsedByOther={isUsedByOther}
              />
              <div className="skin-info">
                <span className="skin-name">{skin.name}</span>
                {isLocked ? (
                  <span className="skin-requirement">{requirementText}</span>
                ) : isUsedByOther ? (
                  <span className="skin-used-by">Used by {usingPartner?.tokenSymbol || 'Unknown'}</span>
                ) : (
                  <span className="skin-available">Available</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="skin-selection-modal">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="skin-modal-container">
        <div className="skin-modal-header">
          <h3>Select Skin for {partner.tokenSymbol}</h3>
          <span className="token-level">Lv.{partner.level}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="skin-modal-content">
          {renderSkinGrid(villagerSkins, 'Basic Skins')}
          {renderSkinGrid(premiumSkins, 'Premium Skins (Exclusive)')}
          {legendarySkins.length > 0 && renderSkinGrid(legendarySkins, 'Legendary Skins (1M $IDLE)')}
        </div>

        <div className="skin-modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-apply"
            onClick={handleApply}
            disabled={selectedSkin === currentSkin}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Confirmation dialog for reassigning exclusive skin */}
      {showConfirm && skinToConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h4>Reassign Skin?</h4>
            <p>
              <strong>{skinToConfirm.name}</strong> is currently used by{' '}
              <strong>{findPartnerByMint(getTokenUsingSkin(skinToConfirm.id))?.tokenSymbol || 'another token'}</strong>.
            </p>
            <p>Assigning it to {partner.tokenSymbol} will remove it from the other token.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleConfirmReassign}>Reassign</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SkinSelectionModal;
