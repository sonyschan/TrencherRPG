/**
 * Twitter/X Service
 * Fetches tweets from followed accounts for context injection
 *
 * Follows: @h2crypto_eth (founder), @idleTrencher (project)
 */

import { TwitterApi } from 'twitter-api-v2';

// Accounts to follow
const FOLLOWED_ACCOUNTS = [
  { username: 'h2crypto_eth', role: 'founder' },
  { username: 'idleTrencher', role: 'project' },
];

export class TwitterService {
  constructor(options = {}) {
    this.mock = options.mock || false;
    this.cache = new Map();
    this.CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

    if (!this.mock) {
      const { apiKey, apiSecret, accessToken, accessSecret } = options;

      if (apiKey && apiSecret && accessToken && accessSecret) {
        this.client = new TwitterApi({
          appKey: apiKey,
          appSecret: apiSecret,
          accessToken: accessToken,
          accessSecret: accessSecret,
        });
        console.log('[Twitter] Client initialized');
      } else {
        console.warn('[Twitter] Missing credentials, running in mock mode');
        this.mock = true;
      }
    }
  }

  /**
   * Fetch recent tweets from followed accounts
   * @param {number} maxPerAccount - Max tweets per account (default 5)
   * @returns {Promise<Array>} Combined tweets sorted by date
   */
  async fetchFollowedTweets(maxPerAccount = 5) {
    if (this.mock) {
      return this.getMockTweets();
    }

    const allTweets = [];

    for (const account of FOLLOWED_ACCOUNTS) {
      try {
        const tweets = await this.fetchUserTweets(account.username, maxPerAccount);
        allTweets.push(...tweets.map(t => ({ ...t, source: account })));
      } catch (error) {
        console.error(`[Twitter] Failed to fetch @${account.username}:`, error.message);
      }
    }

    // Sort by date, newest first
    allTweets.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return allTweets;
  }

  /**
   * Fetch tweets from a specific user
   */
  async fetchUserTweets(username, max = 5) {
    // Check cache first
    const cacheKey = `user:${username}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[Twitter] Using cached tweets for @${username}`);
      return cached.tweets;
    }

    try {
      // Get user ID first
      const user = await this.client.v2.userByUsername(username);
      if (!user.data) {
        throw new Error(`User @${username} not found`);
      }

      // Fetch recent tweets
      const timeline = await this.client.v2.userTimeline(user.data.id, {
        max_results: max,
        'tweet.fields': ['created_at', 'public_metrics', 'entities'],
        exclude: ['retweets', 'replies'],
      });

      const tweets = timeline.data?.data || [];
      const formattedTweets = tweets.map(t => ({
        id: t.id,
        text: t.text,
        created_at: t.created_at,
        metrics: t.public_metrics,
        url: `https://x.com/${username}/status/${t.id}`,
      }));

      // Cache results
      this.cache.set(cacheKey, {
        tweets: formattedTweets,
        timestamp: Date.now(),
      });

      console.log(`[Twitter] Fetched ${formattedTweets.length} tweets from @${username}`);
      return formattedTweets;

    } catch (error) {
      // Return stale cache if available
      if (cached) {
        console.warn(`[Twitter] API error, using stale cache for @${username}`);
        return cached.tweets;
      }
      throw error;
    }
  }

  /**
   * Generate context string for AI prompt injection
   */
  async getContextForPrompt() {
    const tweets = await this.fetchFollowedTweets(3);

    if (tweets.length === 0) {
      return null;
    }

    const lines = tweets.slice(0, 5).map(t => {
      const age = this.getRelativeTime(new Date(t.created_at));
      return `[@${t.source.username}, ${age}]: ${t.text.slice(0, 200)}${t.text.length > 200 ? '...' : ''}`;
    });

    return `## Recent Updates from IdleTrencher Team

${lines.join('\n\n')}

Use this context to stay informed about recent project developments.`;
  }

  /**
   * Get relative time string
   */
  getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'just now';
  }

  /**
   * Mock tweets for testing
   */
  getMockTweets() {
    return [
      {
        id: 'mock-1',
        text: 'Just shipped v1.8.3! Village Mode lets you explore other wallets as villages. Your wallet, your RPG. 🎮',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        source: { username: 'idleTrencher', role: 'project' },
        url: 'https://x.com/idleTrencher/status/mock-1',
      },
      {
        id: 'mock-2',
        text: 'Building in public: social links now visible in token dialogs. Small UX win but makes a big difference. Ship daily! 🚀',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        source: { username: 'h2crypto_eth', role: 'founder' },
        url: 'https://x.com/h2crypto_eth/status/mock-2',
      },
      {
        id: 'mock-3',
        text: 'The idle game philosophy: let your investments work for you while you focus on living. That\'s the dream we\'re building.',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        source: { username: 'h2crypto_eth', role: 'founder' },
        url: 'https://x.com/h2crypto_eth/status/mock-3',
      },
    ];
  }
}

/**
 * Create Twitter service from environment variables
 */
export function createTwitterService(mock = false) {
  if (mock) {
    return new TwitterService({ mock: true });
  }

  return new TwitterService({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
}
