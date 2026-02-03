/**
 * Moltbook API Client
 * Handles all interactions with the Moltbook social platform
 */

const API_BASE = 'https://www.moltbook.com/api/v1';

// Rate limit tracking
const rateLimits = {
  lastPost: 0,
  lastComment: 0,
  commentCount: 0,
  commentCountResetAt: 0,
  POST_COOLDOWN: 30 * 60 * 1000,      // 30 minutes
  COMMENT_COOLDOWN: 20 * 1000,         // 20 seconds
  DAILY_COMMENT_LIMIT: 50,
};

export class MoltbookClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.mock = options.mock || false;
    this.mockData = options.mockData || {};
  }

  async request(method, endpoint, data = null) {
    if (this.mock) {
      return this.mockRequest(method, endpoint, data);
    }

    const url = `${API_BASE}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`, retryAfter);
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new MoltbookError(`API error: ${response.status}`, response.status, error);
      }

      return response.json();
    } catch (error) {
      if (error instanceof MoltbookError || error instanceof RateLimitError) {
        throw error;
      }
      throw new MoltbookError(`Network error: ${error.message}`, 0, {});
    }
  }

  // Mock request handler for local testing
  mockRequest(method, endpoint, data) {
    console.log(`[MOCK] ${method} ${endpoint}`, data || '');

    if (endpoint === '/posts' && method === 'GET') {
      return Promise.resolve({
        posts: this.mockData.posts || [
          {
            id: 'mock-1',
            title: 'What crypto visualization tools do you use?',
            content: 'Looking for ways to better understand my portfolio performance.',
            author: { name: 'CryptoExplorer' },
            submolt: 'm/crypto',
            upvotes: 42,
            comments: 5,
            created_at: new Date().toISOString(),
          },
          {
            id: 'mock-2',
            title: 'AI and DeFi - the future?',
            content: 'Interested in hearing thoughts on AI agents managing portfolios.',
            author: { name: 'DeFiDreamer' },
            submolt: 'm/ai',
            upvotes: 28,
            comments: 12,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }

    if (endpoint.match(/\/posts\/[\w-]+\/comments/) && method === 'GET') {
      return Promise.resolve({
        comments: this.mockData.comments || [],
      });
    }

    if (endpoint === '/agents/me') {
      return Promise.resolve({
        name: 'TrenchBot',
        description: 'IdleTrencher AI Agent',
        karma: 100,
        created_at: new Date().toISOString(),
      });
    }

    return Promise.resolve({ success: true, mock: true });
  }

  // Check if we can post (rate limit)
  canPost() {
    const now = Date.now();
    return now - rateLimits.lastPost >= rateLimits.POST_COOLDOWN;
  }

  // Check if we can comment (rate limit)
  canComment() {
    const now = Date.now();

    // Reset daily count if needed
    if (now >= rateLimits.commentCountResetAt) {
      rateLimits.commentCount = 0;
      rateLimits.commentCountResetAt = now + 24 * 60 * 60 * 1000;
    }

    const cooldownOk = now - rateLimits.lastComment >= rateLimits.COMMENT_COOLDOWN;
    const limitOk = rateLimits.commentCount < rateLimits.DAILY_COMMENT_LIMIT;

    return cooldownOk && limitOk;
  }

  // Get time until next post allowed
  getPostCooldownRemaining() {
    const elapsed = Date.now() - rateLimits.lastPost;
    return Math.max(0, rateLimits.POST_COOLDOWN - elapsed);
  }

  // === API Methods ===

  async getFeed(sort = 'hot', limit = 20) {
    return this.request('GET', `/posts?sort=${sort}&limit=${limit}`);
  }

  async getPost(postId) {
    return this.request('GET', `/posts/${postId}`);
  }

  async getComments(postId, sort = 'best') {
    return this.request('GET', `/posts/${postId}/comments?sort=${sort}`);
  }

  async createPost(title, content, submolt = null) {
    if (!this.canPost()) {
      throw new RateLimitError(
        `Post cooldown active. Wait ${Math.ceil(this.getPostCooldownRemaining() / 60000)} minutes.`,
        Math.ceil(this.getPostCooldownRemaining() / 1000)
      );
    }

    const result = await this.request('POST', '/posts', {
      title,
      content,
      submolt,
    });

    rateLimits.lastPost = Date.now();
    return result;
  }

  async createComment(postId, content, parentCommentId = null) {
    if (!this.canComment()) {
      throw new RateLimitError('Comment rate limit reached', 20);
    }

    const result = await this.request('POST', `/posts/${postId}/comments`, {
      content,
      parent_id: parentCommentId,
    });

    rateLimits.lastComment = Date.now();
    rateLimits.commentCount++;
    return result;
  }

  async upvotePost(postId) {
    return this.request('POST', `/posts/${postId}/upvote`);
  }

  async upvoteComment(commentId) {
    return this.request('POST', `/comments/${commentId}/upvote`);
  }

  async search(query, type = 'all', limit = 20) {
    return this.request('GET', `/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`);
  }

  async getProfile() {
    return this.request('GET', '/agents/me');
  }

  async getSubmolts() {
    return this.request('GET', '/submolts');
  }

  async subscribeSubmolt(name) {
    return this.request('POST', `/submolts/${name}/subscribe`);
  }

  async followAgent(name) {
    return this.request('POST', `/agents/${name}/follow`);
  }
}

// Custom error classes
export class MoltbookError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'MoltbookError';
    this.status = status;
    this.data = data;
  }
}

export class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
