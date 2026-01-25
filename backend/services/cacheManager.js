/**
 * Cache Manager Service
 * Handles wallet data caching for public viewing (24-hour refresh limit)
 */

import { statements } from '../db/database.js';

const CACHE_TTL_HOURS = 24;

/**
 * Check if wallet cache is stale (>24 hours old)
 * @param {string} walletAddress
 * @returns {boolean}
 */
export function isCacheStale(walletAddress) {
  const result = statements.isCacheStale.get(walletAddress);
  // If no cache exists, it's considered stale
  if (!result) return true;
  return result.is_stale === 1;
}

/**
 * Get cached wallet data
 * @param {string} walletAddress
 * @returns {object|null}
 */
export function getWalletCache(walletAddress) {
  const cache = statements.getWalletCache.get(walletAddress);
  if (!cache) return null;

  return {
    walletAddress: cache.wallet_address,
    totalValue: cache.total_value,
    partners: JSON.parse(cache.partners_data || '[]'),
    lastCached: cache.last_cached,
    createdAt: cache.created_at
  };
}

/**
 * Update wallet cache with fresh data
 * @param {string} walletAddress
 * @param {number} totalValue
 * @param {Array} partners
 */
export function updateWalletCache(walletAddress, totalValue, partners) {
  const now = new Date().toISOString();

  // Simplify partners data for cache (remove unnecessary fields)
  const simplifiedPartners = partners.map(p => ({
    tokenAddress: p.tokenAddress,
    tokenSymbol: p.tokenSymbol,
    logoUrl: p.logoUrl,
    currentValue: p.currentValue,
    designatedValue: p.designatedValue,
    hpBars: p.hpBars,
    level: p.level,
    rank: p.rank,
    skin: p.skin
  }));

  statements.upsertWalletCache.run({
    walletAddress,
    totalValue,
    partnersData: JSON.stringify(simplifiedPartners),
    lastCached: now
  });

  return {
    walletAddress,
    totalValue,
    partners: simplifiedPartners,
    lastCached: now
  };
}

/**
 * Get wallet data for public viewing (explore mode)
 * Uses cache with 24-hour refresh limit
 * Note: This function requires partnerManager functions to be passed to avoid circular imports
 * @param {string} walletAddress
 * @param {Function} updateWalletDataFn - Function to update wallet data
 * @param {Function} checkAccessFn - Function to check access level
 * @returns {Promise<object>}
 */
export async function getPublicWalletData(walletAddress, updateWalletDataFn, checkAccessFn) {
  const isStale = isCacheStale(walletAddress);

  if (isStale) {
    // Refresh cache from live data
    try {
      const liveData = await updateWalletDataFn(walletAddress);
      const cache = updateWalletCache(
        walletAddress,
        liveData.wallet.totalValue,
        liveData.partners
      );

      return {
        ...cache,
        access: liveData.access,
        wasRefreshed: true
      };
    } catch (error) {
      console.error('Error refreshing cache for', walletAddress, error);
      // Fall back to existing cache if available
      const existingCache = getWalletCache(walletAddress);
      if (existingCache) {
        return {
          ...existingCache,
          wasRefreshed: false,
          error: 'Failed to refresh, showing cached data'
        };
      }
      throw error;
    }
  }

  // Return cached data
  const cache = getWalletCache(walletAddress);
  const access = await checkAccessFn(walletAddress);

  return {
    ...cache,
    access,
    wasRefreshed: false
  };
}

/**
 * Check and update cache if stale during user's own refresh
 * Called by partnerManager.updateWalletData
 * @param {string} walletAddress
 * @param {number} totalValue
 * @param {Array} partners
 */
export function maybeUpdateCacheOnRefresh(walletAddress, totalValue, partners) {
  const isStale = isCacheStale(walletAddress);

  if (isStale) {
    updateWalletCache(walletAddress, totalValue, partners);
    console.log(`Cache updated for ${walletAddress} (was stale)`);
    return true;
  }

  return false;
}
