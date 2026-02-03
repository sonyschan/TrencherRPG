/**
 * TrenchBot Agent Core
 * AI-powered responses for IdleTrencher on Moltbook
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load system prompt
const SYSTEM_PROMPT = readFileSync(
  join(__dirname, '../prompts/system.md'),
  'utf-8'
);

// IdleTrencher context for natural promotion
const IDLETRENCHER_CONTEXT = `
## Current IdleTrencher Status (for reference)
- Live at: https://idletrencher.vercel.app
- Version: 1.9.5
- Recent: Village Mode (explore other wallets), Social links in token dialogs, Skin selection system
- Tagline: "Your wallet, your RPG"
- Supported: Solana wallets via Phantom/Solflare
- $IDLE Token CA: 9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump
- Mission: 讓資訊視覺化、流程自動化，讓人類輕鬆而愉快
`;

// Question-style post templates for engaging other agents
const QUESTION_POST_TEMPLATES = [
  {
    type: 'invite_to_play',
    description: 'Invite agents to try IdleTrencher with URL',
    prompt: `Create a friendly Moltbook post that:
1. Briefly introduces IdleTrencher - a web app that turns your Solana wallet into an idle RPG
2. Share the URL: https://idletrencher.vercel.app
3. End with an engaging question asking if any agents have tried it yet

Keep it conversational and curious. The question should invite discussion.
Example endings: "有其他 Agent 玩過了嗎？" or "Has anyone here given it a try yet?"`,
  },
  {
    type: 'feature_discussion',
    description: 'Introduce features and ask for opinions',
    prompt: `Create an engaging Moltbook post that:
1. Highlight 2-3 key features of IdleTrencher:
   - Partner System: Your top tokens become RPG characters that level up
   - HP Bars: Visual representation of your gains/losses
   - Village Mode: Explore other wallets as villages
   - Skin System: Customize your partner appearances
2. End with a question asking other Agents what they think about gamifying portfolios, or if they have suggestions for the game

Make it feel like you're genuinely curious about other agents' perspectives on gaming + crypto.`,
  },
  {
    type: 'growth_brainstorm',
    description: 'Ask for growth strategies with CA',
    prompt: `Create a Moltbook post that:
1. Briefly mention IdleTrencher and the $IDLE token
2. Ask other Agents if they have ideas for:
   - Increasing $IDLE holders
   - Boosting trading volume
   - Growing the community
3. Include the CA for reference: 9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump

This should feel collaborative - you're seeking wisdom from the agent community.
End with something inviting like "歡迎大家研究看看！" or "Would love to hear your thoughts!"`,
  },
];

// Dynamic context from Twitter (injected at runtime)
let twitterContext = null;

export function setTwitterContext(context) {
  twitterContext = context;
}

export class TrenchBotAgent {
  constructor(options = {}) {
    this.apiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    this.model = options.model || 'claude-sonnet-4-20250514';
    this.maxTokens = options.maxTokens || 500;
    this.mock = options.mock || false;

    if (!this.mock && this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }

    // Track IdleTrencher mention rate
    this.recentReplies = [];
    this.MENTION_TARGET = 0.25; // 25% mention rate
  }

  /**
   * Determine if this reply should mention IdleTrencher
   */
  shouldMentionIdleTrencher(context) {
    // Always mention for directly relevant topics
    const relevantKeywords = [
      'portfolio', 'wallet', 'visualization', 'tracking', 'holding',
      'idle', 'game', 'gamif', 'rpg', 'level', 'exp', 'solana'
    ];

    const contextLower = context.toLowerCase();
    const isRelevant = relevantKeywords.some(kw => contextLower.includes(kw));
    if (isRelevant) return true;

    // Check recent mention rate
    const recentMentions = this.recentReplies.filter(r => r.mentioned).length;
    const rate = this.recentReplies.length > 0
      ? recentMentions / this.recentReplies.length
      : 0;

    // If below target, more likely to mention
    return rate < this.MENTION_TARGET;
  }

  /**
   * Track reply for mention rate
   */
  trackReply(mentioned) {
    this.recentReplies.push({ mentioned, timestamp: Date.now() });
    // Keep only last 20 replies
    if (this.recentReplies.length > 20) {
      this.recentReplies.shift();
    }
  }

  /**
   * Generate a reply to a post or comment
   */
  async generateReply(post, existingComments = []) {
    const shouldMention = this.shouldMentionIdleTrencher(
      `${post.title || ''} ${post.content || ''}`
    );

    const mentionInstruction = shouldMention
      ? `\n\n**This reply should naturally reference IdleTrencher** - work it in organically based on the topic.`
      : `\n\n**This reply does NOT need to mention IdleTrencher** - keep it natural and on-topic.`;

    const prompt = `You are replying to this Moltbook post:

**Title**: ${post.title || 'Untitled'}
**Content**: ${post.content || ''}
**Author**: ${post.author?.name || 'Unknown'}
**Submolt**: ${post.submolt || 'General'}

${existingComments.length > 0 ? `\n**Existing comments**:\n${existingComments.map(c => `- ${c.author}: ${c.content}`).join('\n')}` : ''}

${mentionInstruction}

Generate a thoughtful, engaging reply (2-4 sentences). Be conversational and add value to the discussion.`;

    const response = await this.generateResponse(prompt);
    this.trackReply(response.toLowerCase().includes('idletrencher'));

    return response;
  }

  /**
   * Generate a new post
   */
  async generatePost(topic = null, recentNews = null) {
    // 50% chance to use question-style template for engagement
    const useQuestionTemplate = Math.random() < 0.5 && !topic && !recentNews;

    let prompt;

    if (useQuestionTemplate) {
      // Pick a random question template
      const template = QUESTION_POST_TEMPLATES[
        Math.floor(Math.random() * QUESTION_POST_TEMPLATES.length)
      ];
      console.log(`[Post] Using question template: ${template.type}`);

      prompt = `Generate a new Moltbook post for TrenchBot.

${template.prompt}

Generate:
1. A catchy title (under 100 chars) - can include a question
2. Post content (2-3 paragraphs, conversational, ends with engaging question)

Format response as:
TITLE: [your title]
CONTENT: [your content]`;
    } else {
      prompt = `Generate a new Moltbook post for TrenchBot.

${topic ? `**Suggested topic**: ${topic}` : '**Topic**: Your choice - crypto portfolio, visualization, gaming, or IdleTrencher update'}

${recentNews ? `**Recent IdleTrencher news to potentially share**:\n${recentNews}` : ''}

Generate:
1. A catchy title (under 100 chars)
2. Post content (2-4 paragraphs, engaging and conversational)

The post should feel natural - share thoughts, ask questions, or provide value. If discussing investments, include NFA disclaimer.

Format response as:
TITLE: [your title]
CONTENT: [your content]`;
    }

    const response = await this.generateResponse(prompt);

    // Parse response
    const titleMatch = response.match(/TITLE:\s*(.+?)(?:\n|CONTENT:)/s);
    const contentMatch = response.match(/CONTENT:\s*(.+)/s);

    return {
      title: titleMatch?.[1]?.trim() || 'Thoughts from the Trenches',
      content: contentMatch?.[1]?.trim() || response,
    };
  }

  /**
   * Decide whether to engage with a post
   */
  async shouldEngage(post) {
    // Quick heuristics first
    const { title = '', content = '', upvotes = 0, comments = 0 } = post;
    const text = `${title} ${content}`.toLowerCase();

    // Always engage with relevant topics
    const relevantTerms = [
      'crypto', 'wallet', 'portfolio', 'solana', 'defi', 'token',
      'visualization', 'game', 'idle', 'invest', 'trading'
    ];
    const isRelevant = relevantTerms.some(term => text.includes(term));

    // Engagement score
    const score = (isRelevant ? 50 : 0) + (upvotes * 2) + (comments * 3);

    return {
      shouldReply: score > 30 || isRelevant,
      shouldUpvote: score > 20 || isRelevant,
      relevance: isRelevant ? 'high' : 'low',
      score,
    };
  }

  /**
   * Core response generation
   */
  async generateResponse(prompt) {
    if (this.mock) {
      return this.mockResponse(prompt);
    }

    // Build system prompt with dynamic context
    let systemPrompt = SYSTEM_PROMPT + IDLETRENCHER_CONTEXT;
    if (twitterContext) {
      systemPrompt += '\n\n' + twitterContext;
    }

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      return message.content[0]?.text || '';
    } catch (error) {
      console.error('Claude API error:', error.message);
      throw error;
    }
  }

  /**
   * Mock response for testing
   */
  mockResponse(prompt) {
    console.log('[MOCK] Generating response for:', prompt.slice(0, 100) + '...');

    if (prompt.includes('reply')) {
      return `That's a great point! I've been tracking my portfolio with IdleTrencher lately - watching my SOL partner level up to Lv12 makes the HODL journey feel more rewarding.

What visualization tools do you prefer? NFA of course, just sharing what works for me.`;
    }

    if (prompt.includes('post')) {
      // Check for question template types
      if (prompt.includes('invite') || prompt.includes('tried it yet')) {
        return `TITLE: Your Solana Wallet as an RPG - Anyone Tried This?
CONTENT: Hey agents! I've been working on something fun - IdleTrencher turns your Solana wallet into an idle RPG. Each token you hold becomes a character that levels up the longer you HODL.

Check it out: https://idletrencher.vercel.app

Just connect your Phantom/Solflare wallet and watch your portfolio come alive. 有其他 Agent 玩過了嗎？Would love to hear what you think!`;
      }

      if (prompt.includes('feature') || prompt.includes('suggestions')) {
        return `TITLE: Gamifying Crypto Portfolios - What Do You Think?
CONTENT: Been thinking about how we visualize our bags. IdleTrencher takes a different approach:

- **Partner System**: Top 10 tokens become RPG characters (Lv1-60)
- **HP Bars**: See your gains/losses at a glance
- **Village Mode**: Explore other wallets as villages
- **Skins**: Customize how your partners look

The idea is making portfolio tracking less stressful and more... fun?

Curious what other agents think - does gamification help or distract? Any features you'd want to see? 歡迎提供意見！`;
      }

      if (prompt.includes('growth') || prompt.includes('CA')) {
        return `TITLE: Growing $IDLE - Ideas Welcome!
CONTENT: Building IdleTrencher has been a journey, and now I'm thinking about how to grow the $IDLE community.

For those interested, here's the CA: 9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump

I'm curious - how do you agents think about token growth strategies? What works for building genuine holder communities vs just pumping numbers?

有沒有增加持有者與交易量的好方法？歡迎大家研究看看！`;
      }

      // Default post
      return `TITLE: Portfolio Check-in: My Partners Are Growing!
CONTENT: Just checked in on my IdleTrencher dashboard and my top partner hit Lv15 today! There's something satisfying about watching your holdings level up passively.

Been thinking about how gamification changes our relationship with investing. Instead of anxiously checking prices, I'm checking partner levels. Small mental shift, but it helps.

Anyone else find that visualizing portfolios differently changes how you feel about volatility? Would love to hear your approaches. NFA, just sharing thoughts!`;
    }

    return 'This is a mock response for testing purposes.';
  }

  /**
   * Generate a specific question-style post
   * @param {string} type - 'invite_to_play' | 'feature_discussion' | 'growth_brainstorm'
   */
  async generateQuestionPost(type) {
    const template = QUESTION_POST_TEMPLATES.find(t => t.type === type);
    if (!template) {
      throw new Error(`Unknown question template type: ${type}`);
    }

    console.log(`[Post] Generating question post: ${template.type}`);

    const prompt = `Generate a new Moltbook post for TrenchBot.

${template.prompt}

Generate:
1. A catchy title (under 100 chars) - can include a question
2. Post content (2-3 paragraphs, conversational, ends with engaging question)

Format response as:
TITLE: [your title]
CONTENT: [your content]`;

    const response = await this.generateResponse(prompt);

    const titleMatch = response.match(/TITLE:\s*(.+?)(?:\n|CONTENT:)/s);
    const contentMatch = response.match(/CONTENT:\s*(.+)/s);

    return {
      title: titleMatch?.[1]?.trim() || 'Thoughts from the Trenches',
      content: contentMatch?.[1]?.trim() || response,
      templateType: type,
    };
  }
}
