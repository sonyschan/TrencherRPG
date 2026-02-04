/**
 * useSkinAssignment - Hook for managing skin assignments
 * Stores skin assignments per wallet/token in localStorage
 */

import { useState, useCallback, useEffect } from 'react';
import { SKINS, DEFAULT_SKIN, isSkinAvailable } from '../config/skins';

const STORAGE_KEY = 'skinAssignments';

/**
 * Get all skin assignments from localStorage
 */
const getStoredAssignments = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn('Failed to load skin assignments:', e);
    return {};
  }
};

/**
 * Save all skin assignments to localStorage
 */
const saveAssignments = (assignments) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch (e) {
    console.warn('Failed to save skin assignments:', e);
  }
};

/**
 * Hook for managing skin assignments
 * @param {string} walletAddress - Current wallet address
 */
export function useSkinAssignment(walletAddress) {
  const [assignments, setAssignments] = useState({});

  // Load assignments on mount or wallet change
  useEffect(() => {
    const stored = getStoredAssignments();
    setAssignments(stored[walletAddress] || {});
  }, [walletAddress]);

  /**
   * Get the assigned skin for a token
   * @param {string} tokenMint - Token mint address
   * @returns {string} Skin ID
   */
  const getSkinForToken = useCallback((tokenMint) => {
    return assignments[tokenMint] || DEFAULT_SKIN;
  }, [assignments]);

  /**
   * Get explicitly assigned skin for a token (returns undefined if no assignment)
   * @param {string} tokenMint - Token mint address
   * @returns {string|undefined} Skin ID or undefined if not explicitly assigned
   */
  const getExplicitSkinForToken = useCallback((tokenMint) => {
    return assignments[tokenMint];
  }, [assignments]);

  /**
   * Assign a skin to a token
   * Handles 1:1 exclusive skin logic
   * @param {string} tokenMint - Token mint address
   * @param {string} skinId - Skin ID to assign
   * @param {number} tokenLevel - Token's current level (for validation)
   * @param {number} idleBalance - User's $IDLE balance (for legendary skins)
   * @returns {{ success: boolean, removedFrom?: string, error?: string }}
   */
  const assignSkin = useCallback((tokenMint, skinId, tokenLevel, idleBalance = 0) => {
    const skin = SKINS[skinId];

    // Validate skin exists
    if (!skin) {
      return { success: false, error: 'Skin not found' };
    }

    // Validate level and $IDLE requirements
    if (!isSkinAvailable(skinId, tokenLevel, idleBalance)) {
      if (skin.idleRequired && idleBalance < skin.idleRequired) {
        return { success: false, error: `Requires ${skin.idleRequired.toLocaleString()} $IDLE` };
      }
      return {
        success: false,
        error: `Requires Level ${skin.levelRequired}`
      };
    }

    const allAssignments = getStoredAssignments();
    const walletAssignments = { ...(allAssignments[walletAddress] || {}) };

    let removedFrom = null;

    // Handle exclusive (1:1) skins
    if (skin.exclusive) {
      // Find if this skin is already assigned to another token
      for (const [existingToken, existingSkin] of Object.entries(walletAssignments)) {
        if (existingSkin === skinId && existingToken !== tokenMint) {
          // Remove from previous token (revert to default)
          walletAssignments[existingToken] = DEFAULT_SKIN;
          removedFrom = existingToken;
          break;
        }
      }
    }

    // Assign the new skin
    walletAssignments[tokenMint] = skinId;

    // Save to localStorage
    allAssignments[walletAddress] = walletAssignments;
    saveAssignments(allAssignments);

    // Update state
    setAssignments(walletAssignments);

    return { success: true, removedFrom };
  }, [walletAddress]);

  /**
   * Get which token is using an exclusive skin
   * @param {string} skinId - Skin ID to check
   * @returns {string|null} Token mint using this skin, or null
   */
  const getTokenUsingSkin = useCallback((skinId) => {
    const skin = SKINS[skinId];
    if (!skin?.exclusive) return null;

    for (const [tokenMint, assignedSkin] of Object.entries(assignments)) {
      if (assignedSkin === skinId) {
        return tokenMint;
      }
    }
    return null;
  }, [assignments]);

  /**
   * Check if a skin is available to assign (not used by another token if exclusive)
   * @param {string} skinId - Skin ID
   * @param {string} currentTokenMint - Current token being edited (excluded from check)
   * @returns {boolean}
   */
  const isSkinFree = useCallback((skinId, currentTokenMint) => {
    const skin = SKINS[skinId];
    if (!skin?.exclusive) return true;

    const usingToken = getTokenUsingSkin(skinId);
    return !usingToken || usingToken === currentTokenMint;
  }, [getTokenUsingSkin]);

  return {
    getSkinForToken,
    getExplicitSkinForToken,
    assignSkin,
    getTokenUsingSkin,
    isSkinFree,
    assignments,
  };
}

export default useSkinAssignment;
