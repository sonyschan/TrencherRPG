/**
 * Crypto Data Service
 * Fetches market data from CoinGecko for portfolio discussions
 */

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export class CryptoService {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.cache = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  async request(endpoint) {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const url = `${COINGECKO_API}${endpoint}`;
    const headers = {};

    if (this.apiKey) {
      headers['x-cg-demo-api-key'] = this.apiKey;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error('CoinGecko request failed:', error.message);
      // Return cached data if available, even if stale
      if (cached) return cached.data;
      throw error;
    }
  }

  /**
   * Get top coins by market cap
   */
  async getTopCoins(limit = 10) {
    const data = await this.request(
      `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=24h`
    );

    return data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      change24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      image: coin.image,
    }));
  }

  /**
   * Get specific coin data
   */
  async getCoin(coinId) {
    const data = await this.request(`/coins/${coinId}`);

    return {
      id: data.id,
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      price: data.market_data?.current_price?.usd,
      change24h: data.market_data?.price_change_percentage_24h,
      change7d: data.market_data?.price_change_percentage_7d,
      ath: data.market_data?.ath?.usd,
      athDate: data.market_data?.ath_date?.usd,
      description: data.description?.en?.slice(0, 200),
    };
  }

  /**
   * Get trending coins
   */
  async getTrending() {
    const data = await this.request('/search/trending');

    return data.coins?.slice(0, 5).map(item => ({
      id: item.item.id,
      symbol: item.item.symbol,
      name: item.item.name,
      marketCapRank: item.item.market_cap_rank,
    })) || [];
  }

  /**
   * Generate ASCII price chart visualization
   */
  generatePriceVisualization(change24h) {
    const bars = 5;
    const absChange = Math.abs(change24h);
    const filled = Math.min(bars, Math.ceil(absChange / 5));

    if (change24h > 0) {
      return `[${'▲'.repeat(filled)}${'·'.repeat(bars - filled)}] +${change24h.toFixed(1)}%`;
    } else if (change24h < 0) {
      return `[${'▼'.repeat(filled)}${'·'.repeat(bars - filled)}] ${change24h.toFixed(1)}%`;
    }
    return `[${'─'.repeat(bars)}] 0%`;
  }

  /**
   * Generate portfolio summary for sharing
   */
  async generatePortfolioSummary(holdings = ['solana', 'ethereum', 'bitcoin']) {
    const coins = await Promise.all(
      holdings.map(id => this.getCoin(id).catch(() => null))
    );

    const valid = coins.filter(Boolean);
    if (valid.length === 0) return null;

    const lines = valid.map(coin => {
      const viz = this.generatePriceVisualization(coin.change24h || 0);
      return `${coin.symbol}: ${viz}`;
    });

    return {
      summary: lines.join('\n'),
      coins: valid,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Format large numbers for display
 */
export function formatNumber(num) {
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

/**
 * Format percentage change
 */
export function formatChange(change) {
  if (!change && change !== 0) return 'N/A';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}
