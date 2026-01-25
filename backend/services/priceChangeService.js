/**
 * Price Change Service
 * Uses DexScreener API to fetch 24-hour price change data
 * Supports batch queries (up to 30 tokens per request)
 *
 * API: https://docs.dexscreener.com/api/reference
 */

const DEXSCREENER_API = 'https://api.dexscreener.com/tokens/v1/solana';
const MAX_TOKENS_PER_REQUEST = 30;

/**
 * Fetch 24-hour price change and social links for multiple tokens
 * Uses DexScreener batch endpoint to minimize API calls
 *
 * @param {string[]} tokenAddresses - Array of Solana token addresses
 * @returns {Promise<Map<string, object>>} Map of tokenAddress -> {priceChange24h, socials, websites, dexscreenerUrl}
 */
export async function getPriceChanges(tokenAddresses) {
  if (!tokenAddresses || tokenAddresses.length === 0) {
    return new Map();
  }

  const results = new Map();

  // Process in batches of 30 (DexScreener limit)
  for (let i = 0; i < tokenAddresses.length; i += MAX_TOKENS_PER_REQUEST) {
    const batch = tokenAddresses.slice(i, i + MAX_TOKENS_PER_REQUEST);
    const batchResults = await fetchBatch(batch);

    // Merge results
    for (const [address, data] of batchResults) {
      results.set(address, data);
    }
  }

  return results;
}

/**
 * Fetch a batch of token data from DexScreener
 * @param {string[]} addresses - Token addresses (max 30)
 * @returns {Promise<Map<string, object>>}
 */
async function fetchBatch(addresses) {
  const results = new Map();

  try {
    const addressList = addresses.join(',');
    const response = await fetch(`${DEXSCREENER_API}/${addressList}`);

    if (!response.ok) {
      console.warn(`DexScreener API error: ${response.status}`);
      return results;
    }

    const pairs = await response.json();

    if (!Array.isArray(pairs)) {
      console.warn('DexScreener returned unexpected format');
      return results;
    }

    // Group pairs by base token address and get the highest liquidity pair
    const tokenPairs = new Map();

    for (const pair of pairs) {
      const address = pair.baseToken?.address;
      if (!address) continue;

      const existing = tokenPairs.get(address);
      const liquidity = pair.liquidity?.usd || 0;

      // Keep the pair with highest liquidity (most reliable price)
      if (!existing || liquidity > (existing.liquidity?.usd || 0)) {
        tokenPairs.set(address, pair);
      }
    }

    // Extract data from best pairs
    for (const [address, pair] of tokenPairs) {
      results.set(address, {
        priceChange24h: pair.priceChange?.h24 ?? 0,
        socials: pair.info?.socials || [],
        websites: pair.info?.websites || [],
        dexscreenerUrl: `https://dexscreener.com/solana/${address}`
      });
    }

  } catch (error) {
    console.error('Error fetching from DexScreener:', error.message);
  }

  return results;
}

/**
 * Get price change for a single token
 * Note: Prefer using getPriceChanges for multiple tokens to save API calls
 *
 * @param {string} tokenAddress
 * @returns {Promise<number>}
 */
export async function getSinglePriceChange(tokenAddress) {
  const changes = await getPriceChanges([tokenAddress]);
  return changes.get(tokenAddress) ?? 0;
}
