/**
 * TokenDetailModal - RPG-style dialog for token details
 * Features: typewriter effect, typing sound, editable designated value
 * Reference: /Users/sonyschan/gt/beedog/mayor/rig/landing/modules/DialogBox.js
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './TokenDetailModal.css';

const TYPING_SPEED = 50; // ms per character

export function TokenDetailModal({ partner, walletAddress, onClose, onUpdateDesignatedValue }) {
  const { t } = useTranslation();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const audioContextRef = useRef(null);
  const typingIntervalRef = useRef(null);
  const fullTextRef = useRef('');

  // Generate the dialog text with 24h price change and state-based fun messages
  const generateDialogText = useCallback(() => {
    if (!partner) return '';

    const { tokenSymbol, currentValue, designatedValue, level, state, priceChange24h, levelInfo, isDemo, hpBars } = partner;

    // Calculate total HP blocks for display
    const calculateTotalHPBlocks = () => {
      if (!hpBars) return 10;
      const bar1Green = hpBars.bar1?.green || 0;
      const bar2Green = hpBars.bar2?.show ? (hpBars.bar2?.green || 0) : 0;
      const bar3Green = hpBars.bar3?.show ? (hpBars.bar3?.green || 0) : 0;
      return bar1Green + bar2Green + bar3Green;
    };
    const totalHPBlocks = calculateTotalHPBlocks();

    // Special onboarding message for demo SOL token (logged-out users)
    if (isDemo) {
      return `${t('dialog.demo.greeting')}

${t('dialog.demo.intro', { symbol: tokenSymbol })}

${t('dialog.demo.description')}

${t('dialog.demo.companion')}

${t('dialog.demo.upAction')}
${t('dialog.demo.downAction')}
${t('dialog.demo.stableAction')}

${t('dialog.demo.levelUp')}

${t('dialog.demo.cta')}`;
    }

    const multiplier = designatedValue > 0 ? (currentValue / designatedValue) : 1;
    const baseChangePercent = ((multiplier - 1) * 100).toFixed(2);

    // Check if 24h data is available (requires refresh)
    const has24hData = priceChange24h !== null && priceChange24h !== undefined;
    const change24h = has24hData ? priceChange24h : 0;
    const change24hText = change24h > 0 ? `+${change24h.toFixed(2)}%` : `${change24h.toFixed(2)}%`;

    // Fun status text based on animation state
    let statusText = '';
    if (!has24hData) {
      statusText = t('dialog.needRefresh');
    } else if (state === 'increasing') {
      statusText = t('dialog.statusUp', { change: change24hText });
    } else if (state === 'decreasing') {
      statusText = t('dialog.statusDown', { change: change24hText });
    } else {
      statusText = t('dialog.statusStable', { change: change24hText });
    }

    // Base value comparison text with HP info
    let baseValueText = '';
    if (multiplier >= 2) {
      baseValueText = t('dialog.hpUpBig', { percent: baseChangePercent, blocks: totalHPBlocks });
    } else if (multiplier >= 1) {
      baseValueText = t('dialog.hpUp', { percent: baseChangePercent, blocks: totalHPBlocks });
    } else {
      baseValueText = t('dialog.hpDown', { percent: Math.abs(parseFloat(baseChangePercent)).toFixed(2), blocks: totalHPBlocks });
    }

    // Days held text
    const daysHeldText = levelInfo
      ? (levelInfo.exp > 0 ? t('dialog.daysHeld', { days: levelInfo.exp }) : t('dialog.daysHeldFirst'))
      : '';

    return `${t('dialog.greeting')}

${t('dialog.intro', { symbol: tokenSymbol, level: level })}
${daysHeldText}

${statusText}

${baseValueText}

${t('dialog.baseValue', { value: designatedValue?.toFixed(2) || '0.00' })}
${t('dialog.currentValue', { value: currentValue?.toFixed(2) || '0.00' })}

${t('dialog.adjustBase')}`;
  }, [partner, t]);

  // Initialize audio context
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('Audio not supported');
      }
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Play typing sound
  const playTypingSound = useCallback(() => {
    if (!audioContextRef.current) return;

    try {
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);

      // Soft click sound (800-1000Hz range)
      oscillator.frequency.value = 800 + Math.random() * 200;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.03, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.05);

      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + 0.05);
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Start typewriter effect
  const startTyping = useCallback(() => {
    const fullText = generateDialogText();
    fullTextRef.current = fullText;
    setIsTyping(true);
    setDisplayedText('');

    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < fullText.length) {
        const char = fullText[charIndex];
        setDisplayedText(fullText.slice(0, charIndex + 1));
        charIndex++;

        // Play sound for non-space characters
        if (char !== ' ' && char !== '\n') {
          playTypingSound();
        }

        // Adjust timing for punctuation
        let delay = TYPING_SPEED;
        if (['.', '!', '?'].includes(char)) delay = 200;
        else if ([',', '\n'].includes(char)) delay = 150;

        typingIntervalRef.current = setTimeout(typeNextChar, delay);
      } else {
        setIsTyping(false);
      }
    };

    typeNextChar();
  }, [generateDialogText, playTypingSound]);

  // Skip typing animation
  const skipTyping = useCallback(() => {
    if (typingIntervalRef.current) {
      clearTimeout(typingIntervalRef.current);
    }
    setDisplayedText(fullTextRef.current);
    setIsTyping(false);
  }, []);

  // Handle click on dialog
  const handleDialogClick = useCallback(() => {
    initAudio();
    if (isTyping) {
      skipTyping();
    }
  }, [initAudio, isTyping, skipTyping]);

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

  // Start typing on mount
  useEffect(() => {
    if (partner) {
      initAudio();
      startTyping();
    }

    return () => {
      if (typingIntervalRef.current) {
        clearTimeout(typingIntervalRef.current);
      }
    };
  }, [partner, initAudio, startTyping]);

  if (!partner) return null;

  return (
    <div className="token-detail-modal">
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-container">
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-content" onClick={handleDialogClick}>
          {/* Token avatar */}
          <div className="token-avatar-large">
            {partner.logoUrl ? (
              <img src={partner.logoUrl} alt={partner.tokenSymbol} />
            ) : (
              <div className="avatar-placeholder-large">
                {partner.tokenSymbol?.[0] || '?'}
              </div>
            )}
            <div className={`avatar-glow ${isTyping ? 'talking' : ''}`} />
          </div>

          {/* Social links bar */}
          {!partner.isDemo && (
            <SocialLinksBar
              socials={partner.socials}
              websites={partner.websites}
              dexscreenerUrl={partner.dexscreenerUrl}
            />
          )}

          {/* Dialog box */}
          <div className="dialog-box">
            <div className="dialog-header">
              <span className="speaker-name">{partner.tokenSymbol}</span>
              <span className="speaker-level">Lv{partner.level}</span>
            </div>

            <div className="dialog-text">
              {displayedText}
              {isTyping && <span className="typing-cursor">|</span>}
            </div>

            {!isTyping && !showEditForm && (
              <div className="dialog-hint" onClick={onClose} style={{ cursor: 'pointer' }}>
                {partner?.isDemo ? (
                  <span>Click to close</span>
                ) : (
                  <>Click to close or <button className="edit-btn" onClick={handleEditClick}>Edit Base Value</button></>
                )}
              </div>
            )}

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
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * SocialLinksBar - Display social links with icons
 */
function SocialLinksBar({ socials = [], websites = [], dexscreenerUrl }) {
  // Debug: log social data
  console.log('SocialLinksBar data:', { socials, websites, dexscreenerUrl });

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
