/**
 * Partner Manager Service
 * Manages token partner states, HP changes, and rankings
 */

import { statements } from '../db/database.js';
import { getWalletPortfolio, getTokenBalance } from './walletTracker.js';
import { calculateLevel, getLevelInfo } from './expCalculator.js';
import { maybeUpdateCacheOnRefresh } from './cacheManager.js';

const IDLE_TOKEN = process.env.IDLE_TOKEN_ADDRESS || '9pgx8fuYwG4wFFrcPAhJquSEenvDCCbbnqQ9RzVgpump';
const IDLE_PER_PARTNER = parseInt(process.env.IDLE_PER_PARTNER || '10000');
const MAX_PARTNERS = parseInt(process.env.MAX_PARTNERS || '10');

// Basic skins for random assignment (before Lv3 or skin setting)
const BASIC_SKINS = ['villager', 'villager2', 'villagerGirl', 'villagerGirl2'];

/**
 * Get a random basic skin
 * @returns {string} Random skin key
 */
function getRandomBasicSkin() {
  return BASIC_SKINS[Math.floor(Math.random() * BASIC_SKINS.length)];
}

/**
 * Calculate HP bars based on designated value comparison
 * @param {number} currentValue
 * @param {number} designatedValue - The baseline value for comparison
 * @returns {object} HP bars info
 */
function calculateHPBars(currentValue, designatedValue) {
  // Default: full HP if no designated value
  if (!designatedValue || designatedValue === 0) {
    return {
      multiplier: 1,
      changePercent: 0,
      bar1: { green: 10, red: 0 },
      bar2: { green: 0, show: false },
      bar3: { green: 0, show: false }
    };
  }

  const multiplier = currentValue / designatedValue;
  const changePercent = (multiplier - 1) * 100;

  // Default bars
  const result = {
    multiplier: Math.round(multiplier * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    bar1: { green: 10, red: 0 },
    bar2: { green: 0, show: false },
    bar3: { green: 0, show: false }
  };

  if (multiplier < 1) {
    // Loss: calculate red blocks on bar1
    const lossPercent = (1 - multiplier) * 100;
    const redBlocks = Math.min(10, Math.ceil(lossPercent / 10));
    result.bar1 = { green: 10 - redBlocks, red: redBlocks };
  } else {
    // Gain or equal: bar1 is full green
    result.bar1 = { green: 10, red: 0 };

    if (multiplier > 1) {
      // Bar2: 1x-10x range (only show when actual gain, not at exactly 1x)
      const bar2Green = Math.min(10, Math.floor(multiplier));
      result.bar2 = { green: bar2Green, show: true };
    }

    if (multiplier >= 10) {
      // Bar3: 10x-100x range
      const bar3Green = Math.min(10, Math.floor(multiplier / 10));
      result.bar3 = { green: bar3Green, show: true };
    }
  }

  return result;
}

/**
 * Calculate animation state based on 24-hour price change from Helius API
 * @param {number} priceChange24h - 24-hour price change percentage from Helius
 * @returns {object} Animation state info
 */
function calculateAnimationState(priceChange24h) {
  const change = priceChange24h || 0;

  let state = 'stable';
  if (change > 1) state = 'increasing';
  else if (change < -1) state = 'decreasing';

  return {
    state,
    priceChange24h: Math.round(change * 100) / 100
  };
}

/**
 * Calculate HP state based on value change (legacy, for backward compatibility)
 * @param {number} currentValue
 * @param {number} previousValue
 * @returns {object} HP state info
 */
function calculateHPState(currentValue, previousValue) {
  if (previousValue === 0 || previousValue === null) {
    return {
      changePercent: 0,
      changeAmount: 0,
      valueState: 'stable'
    };
  }

  const changeAmount = currentValue - previousValue;
  const changePercent = ((currentValue - previousValue) / previousValue) * 100;

  // State for wallet value change display (not animation)
  let valueState = 'stable';
  if (changePercent > 1) valueState = 'increasing';
  else if (changePercent < -1) valueState = 'decreasing';

  return {
    changePercent: Math.round(changePercent * 100) / 100,
    changeAmount: Math.round(changeAmount * 100) / 100,
    valueState
  };
}

/**
 * Check access level based on $idle holdings
 * Free tier: 1 partner slot
 * Each 10,000 $idle unlocks 1 additional slot (up to 10 total)
 * @param {string} walletAddress
 * @returns {Promise<object>}
 */
export async function checkAccess(walletAddress) {
  const FREE_SLOTS = 1;

  try {
    const idleBalance = await getTokenBalance(walletAddress, IDLE_TOKEN);
    const paidSlots = Math.floor(idleBalance / IDLE_PER_PARTNER);
    const maxPartners = Math.min(FREE_SLOTS + paidSlots, MAX_PARTNERS);
    const lockedSlots = MAX_PARTNERS - maxPartners;

    return {
      canAccess: true, // Free tier always has access to 1 slot
      idleBalance,
      maxPartners,
      lockedSlots,
      requiredForNext: maxPartners < MAX_PARTNERS
        ? (paidSlots + 1) * IDLE_PER_PARTNER - idleBalance
        : 0
    };
  } catch (error) {
    console.error('Error checking access:', error);
    return {
      canAccess: true, // Still allow free tier
      idleBalance: 0,
      maxPartners: FREE_SLOTS,
      lockedSlots: MAX_PARTNERS - FREE_SLOTS,
      requiredForNext: IDLE_PER_PARTNER
    };
  }
}

/**
 * Update wallet and partners data
 * @param {string} walletAddress
 * @returns {Promise<object>}
 */
export async function updateWalletData(walletAddress) {
  const now = new Date().toISOString();

  // Get current portfolio
  const portfolio = await getWalletPortfolio(walletAddress);

  // Get existing wallet data
  const existingWallet = statements.getWallet.get(walletAddress);

  // Update wallet record
  statements.upsertWallet.run({
    address: walletAddress,
    totalValue: portfolio.totalValue,
    previousValue: existingWallet?.total_value || 0,
    lastUpdated: now
  });

  // Check access level
  const access = await checkAccess(walletAddress);
  const partnerLimit = access.maxPartners;

  // Get existing partners for EXP tracking
  const existingPartners = statements.getPartners.all(walletAddress);
  const existingPartnerMap = new Map(
    existingPartners.map(p => [p.token_address, p])
  );

  // Update partners - top N tokens (including $idle)
  const topTokens = portfolio.tokens
    .slice(0, partnerLimit);

  const currentTopAddresses = new Set(topTokens.map(t => t.tokenAddress));

  // Reset EXP for tokens that fell out of top N
  for (const existing of existingPartners) {
    if (!currentTopAddresses.has(existing.token_address)) {
      statements.resetPartnerExp.run(walletAddress, existing.token_address);
    }
  }

  // Update current top tokens
  const updatedPartners = [];
  for (let i = 0; i < topTokens.length; i++) {
    const token = topTokens[i];
    const existing = existingPartnerMap.get(token.tokenAddress);
    const rank = i + 1;

    // First seen date: use existing if available, otherwise set to now
    const firstSeenDate = existing?.first_seen_date || now;

    // Calculate EXP dynamically from first_seen_date
    const exp = calculateExpFromDate(firstSeenDate);
    const level = calculateLevel(exp);

    // Designated value: use existing if available, otherwise use first fetch value
    const designatedValue = existing?.designated_value || token.value;

    // Skin: use existing if available, otherwise assign random basic skin
    const skin = existing?.skin || getRandomBasicSkin();

    statements.upsertPartner.run({
      walletAddress,
      tokenAddress: token.tokenAddress,
      tokenSymbol: token.symbol,
      logoUrl: token.logoUrl,
      amount: token.amount,
      currentValue: token.value,
      previousValue: existing?.current_value || token.value,
      designatedValue: designatedValue,
      exp: exp,  // Store calculated exp (for reference, but we always recalculate)
      rank: rank,
      skin: skin,
      priceChange24h: token.priceChange24h || null,  // Store 24h price change from DexScreener
      lastUpdated: now
    });

    // Calculate HP bars using designated value
    const hpBars = calculateHPBars(token.value, designatedValue);

    // Animation state based on 24h price change from Helius
    const animState = calculateAnimationState(token.priceChange24h);

    // Legacy HP state for value change tracking
    const hpState = calculateHPState(
      token.value,
      existing?.current_value || token.value
    );

    updatedPartners.push({
      tokenAddress: token.tokenAddress,
      tokenSymbol: token.symbol,
      logoUrl: token.logoUrl,
      amount: token.amount,
      currentValue: token.value,
      previousValue: existing?.current_value || token.value,
      designatedValue: designatedValue,
      hpBars: hpBars,
      ...animState,  // state, priceChange24h
      ...hpState,    // changePercent, changeAmount
      exp: exp,
      level: level,
      levelInfo: getLevelInfo(exp, firstSeenDate),
      rank: rank,
      skin: skin,
      firstSeenDate: firstSeenDate,
      // Social links from DexScreener
      socials: token.socials || [],
      websites: token.websites || [],
      dexscreenerUrl: token.dexscreenerUrl || `https://dexscreener.com/solana/${token.tokenAddress}`
    });
  }

  // Update cache if stale (>24 hours)
  maybeUpdateCacheOnRefresh(walletAddress, portfolio.totalValue, updatedPartners);

  return {
    wallet: {
      address: walletAddress,
      totalValue: portfolio.totalValue,
      previousValue: existingWallet?.total_value || 0,
      valueChange: calculateHPState(
        portfolio.totalValue,
        existingWallet?.total_value || portfolio.totalValue
      )
    },
    partners: updatedPartners,
    access
  };
}

/**
 * Get current partners for a wallet
 * @param {string} walletAddress
 * @returns {Promise<Array>}
 */
export async function getPartners(walletAddress) {
  const partners = statements.getPartners.all(walletAddress);

  return partners.map(p => {
    const hpBars = calculateHPBars(p.current_value, p.designated_value || p.current_value);
    // For cached data without 24h change, use HP multiplier to determine state
    const stateFromMultiplier = hpBars.multiplier > 1.01 ? 'increasing' :
                                hpBars.multiplier < 0.99 ? 'decreasing' : 'stable';

    // Calculate EXP dynamically from first_seen_date
    const exp = calculateExpFromDate(p.first_seen_date);

    // Use stored 24h price change, or determine state from HP multiplier as fallback
    const storedPriceChange = p.price_change_24h;
    const hasPriceChange = storedPriceChange !== null && storedPriceChange !== undefined;

    // Determine state based on 24h price change if available, otherwise use HP multiplier
    let state;
    if (hasPriceChange) {
      state = storedPriceChange > 1 ? 'increasing' : storedPriceChange < -1 ? 'decreasing' : 'stable';
    } else {
      state = stateFromMultiplier;
    }

    return {
      tokenAddress: p.token_address,
      tokenSymbol: p.token_symbol,
      logoUrl: p.logo_url,
      amount: p.amount,
      currentValue: p.current_value,
      previousValue: p.previous_value,
      designatedValue: p.designated_value || p.current_value,
      hpBars: hpBars,
      state: state,
      priceChange24h: storedPriceChange,  // Now read from database cache
      ...calculateHPState(p.current_value, p.previous_value),
      exp: exp,
      level: calculateLevel(exp),
      levelInfo: getLevelInfo(exp, p.first_seen_date),
      rank: p.rank,
      firstSeenDate: p.first_seen_date,
      skin: p.skin || 'villager',  // Default to villager for existing partners without skin
      // Social links: not stored in DB, but dexscreenerUrl can be generated
      // Full socials are only available after refresh (from DexScreener API)
      socials: [],
      websites: [],
      dexscreenerUrl: `https://dexscreener.com/solana/${p.token_address}`
    };
  });
}

/**
 * Calculate EXP based on days since first seen in top 10
 * @param {string} firstSeenDate - ISO date string
 * @returns {number} Days since first seen (EXP)
 */
function calculateExpFromDate(firstSeenDate) {
  if (!firstSeenDate) return 0;
  const firstSeen = new Date(firstSeenDate);
  const now = new Date();
  const daysDiff = Math.floor((now - firstSeen) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysDiff);
}
