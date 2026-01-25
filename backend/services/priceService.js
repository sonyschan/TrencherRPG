/**
 * Price Service - DexScreener API integration
 * Fetches token prices and logos from DexScreener
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens';

// Cache to reduce API calls
const priceCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get token info from DexScreener
 * @param {string} tokenAddress - Solana token mint address
 * @returns {Promise<{price: number, logoUrl: string|null, symbol: string, name: string}>}
 */
export async function getTokenInfo(tokenAddress) {
  // Check cache first
  const cached = priceCache.get(tokenAddress);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `${DEXSCREENER_API}/${tokenAddress}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`DexScreener API error: ${response.status}`);
    }

    const data = await response.json();
    const pairs = data.pairs || [];

    if (pairs.length === 0) {
      return {
        price: 0,
        logoUrl: null,
        symbol: 'UNKNOWN',
        name: 'Unknown Token'
      };
    }

    // Get pair with highest liquidity
    const bestPair = pairs.sort((a, b) =>
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];

    // Extract social links from DexScreener info
    const socials = bestPair.info?.socials || [];
    const websites = bestPair.info?.websites || [];

    const result = {
      price: parseFloat(bestPair.priceUsd || 0),
      logoUrl: bestPair.info?.imageUrl || null,
      symbol: bestPair.baseToken?.symbol || 'UNKNOWN',
      name: bestPair.baseToken?.name || 'Unknown Token',
      priceChange24h: bestPair.priceChange?.h24 || 0,
      volume24h: bestPair.volume?.h24 || 0,
      liquidity: bestPair.liquidity?.usd || 0,
      // Social links: [{type: "twitter", url: "..."}, {type: "telegram", url: "..."}]
      socials: socials,
      // Websites: [{label: "Website", url: "..."}] or just strings
      websites: websites,
      // DexScreener page URL
      dexscreenerUrl: `https://dexscreener.com/solana/${tokenAddress}`
    };

    // Update cache
    priceCache.set(tokenAddress, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error(`Error fetching token info for ${tokenAddress}:`, error.message);

    // Return cached data if available (even if stale)
    if (cached) {
      return cached.data;
    }

    return {
      price: 0,
      logoUrl: null,
      symbol: 'ERROR',
      name: 'Error Loading'
    };
  }
}

/**
 * Get prices for multiple tokens
 * @param {string[]} tokenAddresses - Array of token addresses
 * @returns {Promise<Map<string, object>>}
 */
export async function getMultipleTokenInfo(tokenAddresses) {
  const results = new Map();

  // Process in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < tokenAddresses.length; i += batchSize) {
    const batch = tokenAddresses.slice(i, i + batchSize);
    const promises = batch.map(addr =>
      getTokenInfo(addr).then(info => ({ addr, info }))
    );

    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ addr, info }) => {
      results.set(addr, info);
    });

    // Small delay between batches
    if (i + batchSize < tokenAddresses.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}

/**
 * Clear price cache
 */
export function clearCache() {
  priceCache.clear();
}
