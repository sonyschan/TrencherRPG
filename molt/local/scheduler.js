/**
 * Scheduler - Heartbeat and polling logic
 * Manages periodic checks and rate-limited actions
 */

import { MoltbookClient, RateLimitError } from './moltbook.js';
import { TrenchBotAgent, setTwitterContext } from './agent.js';
import { CryptoService } from './crypto.js';
import { createTwitterService } from './twitter.js';
import { getStateManager } from './state.js';

export class TrenchBotScheduler {
  constructor(options = {}) {
    this.moltbook = options.moltbook || new MoltbookClient(process.env.MOLTBOOK_API_KEY);
    this.agent = options.agent || new TrenchBotAgent();
    this.crypto = options.crypto || new CryptoService();
    this.twitter = options.twitter || createTwitterService(options.mock);
    this.state = options.state || getStateManager();

    // Intervals (in ms)
    this.HEARTBEAT_INTERVAL = options.heartbeatInterval || 4 * 60 * 60 * 1000; // 4 hours
    this.FEED_CHECK_INTERVAL = options.feedCheckInterval || 30 * 60 * 1000;     // 30 min

    this.running = false;
    this.timers = [];
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting TrenchBot...');
    this.running = true;

    // Initial run
    this.heartbeat();

    // Set up intervals
    this.timers.push(
      setInterval(() => this.heartbeat(), this.HEARTBEAT_INTERVAL)
    );

    console.log(`[Scheduler] Heartbeat every ${this.HEARTBEAT_INTERVAL / 60000} minutes`);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('[Scheduler] Stopping...');
    this.running = false;
    this.timers.forEach(timer => clearInterval(timer));
    this.timers = [];
  }

  /**
   * Main heartbeat - runs periodically
   */
  async heartbeat() {
    console.log(`\n[Heartbeat] ${new Date().toISOString()}`);

    try {
      // 0. Fetch Twitter context from @h2crypto_eth and @idleTrencher
      await this.refreshTwitterContext();

      // 1. Check feed for engagement opportunities
      await this.checkFeed();

      // 2. Maybe create a new post
      await this.maybePost();

      // 3. Log stats
      const stats = this.state.getStats();
      console.log('[Stats]', JSON.stringify(stats, null, 2));

    } catch (error) {
      console.error('[Heartbeat Error]', error.message);
      this.state.logActivity('heartbeat_error', null, error.message);
    }
  }

  /**
   * Refresh Twitter context from followed accounts
   */
  async refreshTwitterContext() {
    console.log('[Twitter] Fetching updates from @h2crypto_eth and @idleTrencher...');

    try {
      const context = await this.twitter.getContextForPrompt();

      if (context) {
        setTwitterContext(context);
        this.state.logActivity('twitter_fetch', null, 'Context updated');
        console.log('[Twitter] Context updated successfully');
      } else {
        console.log('[Twitter] No recent tweets found');
      }
    } catch (error) {
      console.error('[Twitter] Failed to fetch context:', error.message);
      // Continue without fresh context
    }
  }

  /**
   * Check feed and engage with posts
   */
  async checkFeed() {
    console.log('[Feed] Checking for engagement opportunities...');

    try {
      const { posts } = await this.moltbook.getFeed('hot', 20);

      let engaged = 0;
      for (const post of posts) {
        // Skip if already interacted
        if (this.state.hasInteracted(post.id, 'replied') &&
            this.state.hasInteracted(post.id, 'upvoted')) {
          continue;
        }

        // Decide engagement
        const decision = await this.agent.shouldEngage(post);
        console.log(`[Feed] Post "${post.title?.slice(0, 40)}..." - Score: ${decision.score}`);

        // Upvote
        if (decision.shouldUpvote && !this.state.hasInteracted(post.id, 'upvoted')) {
          try {
            await this.moltbook.upvotePost(post.id);
            this.state.markInteraction(post.id, 'upvoted');
            this.state.logActivity('upvote', post.id);
            console.log(`  [Upvoted]`);
          } catch (e) {
            console.error(`  [Upvote failed] ${e.message}`);
          }
        }

        // Reply
        if (decision.shouldReply && !this.state.hasInteracted(post.id, 'replied')) {
          if (!this.moltbook.canComment()) {
            console.log('  [Skip reply] Rate limit');
            continue;
          }

          try {
            // Get existing comments for context
            const { comments } = await this.moltbook.getComments(post.id);

            // Generate reply
            const reply = await this.agent.generateReply(post, comments.slice(0, 5));
            console.log(`  [Reply] ${reply.slice(0, 100)}...`);

            // Post reply
            await this.moltbook.createComment(post.id, reply);
            this.state.markInteraction(post.id, 'replied');
            this.state.logActivity('reply', post.id, reply.slice(0, 200));

            engaged++;
          } catch (e) {
            if (e instanceof RateLimitError) {
              console.log(`  [Rate limited] Wait ${e.retryAfter}s`);
              break;
            }
            console.error(`  [Reply failed] ${e.message}`);
          }
        }

        // Limit engagements per heartbeat
        if (engaged >= 3) break;
      }

      console.log(`[Feed] Engaged with ${engaged} posts`);

    } catch (error) {
      console.error('[Feed Error]', error.message);
    }
  }

  /**
   * Maybe create a new post
   */
  async maybePost() {
    if (!this.moltbook.canPost()) {
      const remaining = this.moltbook.getPostCooldownRemaining();
      console.log(`[Post] Cooldown active (${Math.ceil(remaining / 60000)} min remaining)`);
      return;
    }

    // Check for unposted updates
    const updates = this.state.getUnpostedUpdates();
    let topic = null;
    let news = null;

    if (updates.length > 0) {
      const update = updates[0];
      news = `v${update.version}: ${update.description}`;
      topic = 'IdleTrencher update';
    }

    // Only post occasionally (roughly every 4 hours when possible)
    const recentPosts = this.state.getRecentPosts(1);
    if (recentPosts.length > 0) {
      const lastPost = new Date(recentPosts[0].created_at);
      const hoursSince = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 4 && !news) {
        console.log(`[Post] Last post was ${hoursSince.toFixed(1)}h ago, skipping`);
        return;
      }
    }

    try {
      console.log('[Post] Generating new post...');
      const { title, content } = await this.agent.generatePost(topic, news);

      const result = await this.moltbook.createPost(title, content, 'm/crypto');
      this.state.savePost(result.id, title, content);
      this.state.logActivity('post', result.id, title);

      if (updates.length > 0) {
        this.state.markUpdatePosted(updates[0].id);
      }

      console.log(`[Post] Created: "${title}"`);

    } catch (error) {
      if (error instanceof RateLimitError) {
        console.log(`[Post] Rate limited: ${error.message}`);
      } else {
        console.error('[Post Error]', error.message);
      }
    }
  }

  /**
   * Manual trigger for testing
   */
  async runOnce() {
    console.log('[Manual] Running single heartbeat...');
    await this.heartbeat();
    console.log('[Manual] Complete');
  }
}
