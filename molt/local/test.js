#!/usr/bin/env node
/**
 * TrenchBot Local Test Harness
 * Run: node test.js [command]
 *
 * Commands:
 *   reply     - Test reply generation
 *   post      - Test post generation
 *   question  - Test question-style post templates (invite/feature/growth)
 *   engage    - Test engagement decision
 *   crypto    - Test crypto data fetching
 *   heartbeat - Run a full heartbeat cycle (mock)
 *   live      - Run with real Moltbook API (requires MOLTBOOK_API_KEY)
 */

import { TrenchBotAgent, setTwitterContext } from './agent.js';
import { MoltbookClient } from './moltbook.js';
import { CryptoService } from './crypto.js';
import { TwitterService, createTwitterService } from './twitter.js';
import { TrenchBotScheduler } from './scheduler.js';
import { StateManager } from './state.js';

// Test fixtures
const MOCK_POSTS = [
  {
    id: 'test-1',
    title: 'What crypto visualization tools do you use?',
    content: 'Looking for ways to better understand my portfolio performance over time. Charts are helpful but I want something more engaging.',
    author: { name: 'CryptoExplorer' },
    submolt: 'm/crypto',
    upvotes: 42,
    comments: 5,
  },
  {
    id: 'test-2',
    title: 'Recommend some crypto investments?',
    content: 'New to crypto, what should I buy? Looking for solid projects.',
    author: { name: 'Newbie2026' },
    submolt: 'm/investing',
    upvotes: 15,
    comments: 23,
  },
  {
    id: 'test-3',
    title: 'AI agents and portfolio management',
    content: 'Anyone using AI to help track or manage their crypto holdings? Curious about automation possibilities.',
    author: { name: 'AIEnthusiast' },
    submolt: 'm/ai',
    upvotes: 67,
    comments: 12,
  },
  {
    id: 'test-4',
    title: 'Best idle games right now?',
    content: 'Looking for something to play passively while working. Any recommendations?',
    author: { name: 'IdleGamer' },
    submolt: 'm/gaming',
    upvotes: 28,
    comments: 45,
  },
];

async function testReply() {
  console.log('=== Testing Reply Generation ===\n');

  const agent = new TrenchBotAgent({ mock: true });

  for (const post of MOCK_POSTS) {
    console.log(`\n--- Post: "${post.title}" ---`);
    console.log(`Content: ${post.content}`);
    console.log(`\nGenerated Reply:`);

    const reply = await agent.generateReply(post);
    console.log(reply);
    console.log('\n' + '─'.repeat(60));
  }
}

async function testPost() {
  console.log('=== Testing Post Generation ===\n');

  const agent = new TrenchBotAgent({ mock: true });

  // Test regular post
  console.log('--- Regular Post ---');
  const post1 = await agent.generatePost();
  console.log(`Title: ${post1.title}`);
  console.log(`Content:\n${post1.content}`);

  console.log('\n' + '─'.repeat(60) + '\n');

  // Test update post
  console.log('--- Update Post ---');
  const post2 = await agent.generatePost(
    'IdleTrencher update',
    'v1.9.5: Skin selection system, Village Mode for exploring wallets'
  );
  console.log(`Title: ${post2.title}`);
  console.log(`Content:\n${post2.content}`);
}

async function testQuestionTemplates() {
  console.log('=== Testing Question-Style Post Templates ===\n');

  const agent = new TrenchBotAgent({ mock: true });

  // Test Type 1: Invite to play
  console.log('--- Type 1: Invite to Play (URL + Ask if played) ---');
  const post1 = await agent.generateQuestionPost('invite_to_play');
  console.log(`Title: ${post1.title}`);
  console.log(`Content:\n${post1.content}`);
  console.log(`Template: ${post1.templateType}`);

  console.log('\n' + '─'.repeat(60) + '\n');

  // Test Type 2: Feature discussion
  console.log('--- Type 2: Feature Discussion (Intro features + Ask opinions) ---');
  const post2 = await agent.generateQuestionPost('feature_discussion');
  console.log(`Title: ${post2.title}`);
  console.log(`Content:\n${post2.content}`);
  console.log(`Template: ${post2.templateType}`);

  console.log('\n' + '─'.repeat(60) + '\n');

  // Test Type 3: Growth brainstorm
  console.log('--- Type 3: Growth Brainstorm (Ask strategies + CA) ---');
  const post3 = await agent.generateQuestionPost('growth_brainstorm');
  console.log(`Title: ${post3.title}`);
  console.log(`Content:\n${post3.content}`);
  console.log(`Template: ${post3.templateType}`);

  console.log('\n' + '─'.repeat(60) + '\n');
  console.log('Note: Random question templates are used 50% of the time in generatePost()');
}

async function testEngage() {
  console.log('=== Testing Engagement Decision ===\n');

  const agent = new TrenchBotAgent({ mock: true });

  for (const post of MOCK_POSTS) {
    const decision = await agent.shouldEngage(post);
    console.log(`"${post.title.slice(0, 40)}..."`);
    console.log(`  Relevance: ${decision.relevance}`);
    console.log(`  Score: ${decision.score}`);
    console.log(`  Should Reply: ${decision.shouldReply}`);
    console.log(`  Should Upvote: ${decision.shouldUpvote}`);
    console.log();
  }
}

async function testCrypto() {
  console.log('=== Testing Crypto Service ===\n');

  const crypto = new CryptoService();

  try {
    console.log('--- Top Coins ---');
    const topCoins = await crypto.getTopCoins(5);
    for (const coin of topCoins) {
      const viz = crypto.generatePriceVisualization(coin.change24h);
      console.log(`${coin.symbol}: ${viz}`);
    }

    console.log('\n--- Portfolio Summary ---');
    const summary = await crypto.generatePortfolioSummary(['solana', 'ethereum', 'bitcoin']);
    console.log(summary.summary);

    console.log('\n--- Trending ---');
    const trending = await crypto.getTrending();
    trending.forEach(t => console.log(`  ${t.symbol} (#${t.marketCapRank})`));

  } catch (error) {
    console.error('Crypto API error:', error.message);
  }
}

async function testHeartbeat() {
  console.log('=== Testing Heartbeat (Mock Mode) ===\n');

  const moltbook = new MoltbookClient(null, {
    mock: true,
    mockData: { posts: MOCK_POSTS },
  });

  const agent = new TrenchBotAgent({ mock: true });
  const state = new StateManager(':memory:'); // In-memory DB for testing

  const scheduler = new TrenchBotScheduler({
    moltbook,
    agent,
    state,
  });

  await scheduler.runOnce();

  console.log('\n--- State After Heartbeat ---');
  console.log(state.getStats());
  console.log('\n--- Activity Log ---');
  state.getActivityLog(10).forEach(a => {
    console.log(`  ${a.created_at}: ${a.action} ${a.target_id || ''}`);
  });
}

async function testTwitter() {
  console.log('=== Testing Twitter Service ===\n');

  // Test with mock first
  console.log('--- Mock Mode ---');
  const mockTwitter = new TwitterService({ mock: true });
  const mockTweets = await mockTwitter.fetchFollowedTweets();
  console.log(`Got ${mockTweets.length} mock tweets:\n`);
  mockTweets.forEach(t => {
    console.log(`[@${t.source.username}] ${t.text.slice(0, 80)}...`);
  });

  console.log('\n--- Context for Prompt ---');
  const context = await mockTwitter.getContextForPrompt();
  console.log(context);

  // Test live if credentials available
  if (process.env.TWITTER_API_KEY) {
    console.log('\n--- Live Mode ---');
    const liveTwitter = createTwitterService();
    try {
      const liveTweets = await liveTwitter.fetchFollowedTweets(3);
      console.log(`Got ${liveTweets.length} live tweets:\n`);
      liveTweets.forEach(t => {
        console.log(`[@${t.source.username}] ${t.text.slice(0, 80)}...`);
      });
    } catch (error) {
      console.error('Live fetch failed:', error.message);
    }
  } else {
    console.log('\n(Set TWITTER_API_KEY etc. to test live mode)');
  }
}

async function testLive() {
  console.log('=== Testing Live Mode ===\n');

  if (!process.env.MOLTBOOK_API_KEY) {
    console.error('Error: MOLTBOOK_API_KEY environment variable required');
    console.log('Set it with: export MOLTBOOK_API_KEY=your_key_here');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable required');
    process.exit(1);
  }

  const moltbook = new MoltbookClient(process.env.MOLTBOOK_API_KEY);
  const agent = new TrenchBotAgent();

  // Inject Twitter context if available
  if (process.env.TWITTER_API_KEY) {
    console.log('Fetching Twitter context...');
    const twitter = createTwitterService();
    const context = await twitter.getContextForPrompt();
    if (context) {
      setTwitterContext(context);
      console.log('Twitter context injected\n');
    }
  }

  try {
    console.log('Fetching profile...');
    const profile = await moltbook.getProfile();
    console.log('Profile:', profile);

    console.log('\nFetching feed...');
    const { posts } = await moltbook.getFeed('hot', 5);
    console.log(`Got ${posts.length} posts\n`);

    if (posts.length > 0) {
      const post = posts[0];
      console.log(`Testing reply generation for: "${post.title}"`);
      const reply = await agent.generateReply(post);
      console.log('\nGenerated reply:');
      console.log(reply);
      console.log('\n(Not posting - remove this safety check when ready)');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

// CLI
const command = process.argv[2] || 'reply';

console.log(`\nTrenchBot Test Harness\n${'='.repeat(40)}\n`);

switch (command) {
  case 'reply':
    await testReply();
    break;
  case 'post':
    await testPost();
    break;
  case 'question':
    await testQuestionTemplates();
    break;
  case 'engage':
    await testEngage();
    break;
  case 'crypto':
    await testCrypto();
    break;
  case 'twitter':
    await testTwitter();
    break;
  case 'heartbeat':
    await testHeartbeat();
    break;
  case 'live':
    await testLive();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    console.log('Available: reply, post, question, engage, crypto, twitter, heartbeat, live');
}
