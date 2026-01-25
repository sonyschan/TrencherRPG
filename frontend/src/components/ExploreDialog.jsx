/**
 * ExploreDialog - Typewriter dialog for entering wallet address to explore
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import './ExploreDialog.css';

const TYPING_SPEED = 40; // ms per character
const DIALOG_MESSAGE = "Whose village would you like to visit? Enter their wallet address below...";

export function ExploreDialog({ isOpen, onClose, onExplore }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const audioContextRef = useRef(null);

  // Typewriter effect
  useEffect(() => {
    if (!isOpen) {
      setDisplayedText('');
      setIsTypingComplete(false);
      setAddress('');
      setError('');
      return;
    }

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < DIALOG_MESSAGE.length) {
        setDisplayedText(DIALOG_MESSAGE.slice(0, currentIndex + 1));
        playTypingSound();
        currentIndex++;
      } else {
        setIsTypingComplete(true);
        clearInterval(interval);
        // Focus input after typing completes
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }, TYPING_SPEED);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Initialize audio context for typing sound
  const playTypingSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800 + Math.random() * 200;
      oscillator.type = 'square';
      gainNode.gain.value = 0.02;

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.02);
    } catch (e) {
      // Audio not supported
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setError('Please enter a wallet address');
      return;
    }

    if (trimmedAddress.length < 32) {
      setError('Invalid wallet address');
      return;
    }

    setIsLoading(true);
    try {
      await onExplore(trimmedAddress);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to explore wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="explore-dialog-overlay" onClick={onClose}>
      <div
        className="explore-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="dialog-frame">
          <div className="dialog-header">
            <span className="dialog-icon">🔍</span>
            <span className="dialog-title">Explore</span>
          </div>

          <div className="dialog-content">
            <p className="typewriter-text">
              {displayedText}
              {!isTypingComplete && <span className="cursor">|</span>}
            </p>

            {isTypingComplete && (
              <form onSubmit={handleSubmit} className="explore-form">
                <input
                  ref={inputRef}
                  type="text"
                  className="address-input"
                  placeholder="Enter Solana wallet address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={isLoading}
                  autoComplete="off"
                  spellCheck={false}
                />

                {error && <p className="error-message">{error}</p>}

                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-explore"
                    disabled={isLoading || !address.trim()}
                  >
                    {isLoading ? 'Loading...' : 'Visit Village'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExploreDialog;
