/**
 * State Management
 * SQLite-based persistence for agent state
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'trenchbot.db');

export class StateManager {
  constructor(dbPath = DB_PATH) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      -- Posts we've interacted with
      CREATE TABLE IF NOT EXISTS interactions (
        post_id TEXT PRIMARY KEY,
        replied INTEGER DEFAULT 0,
        upvoted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Our posts
      CREATE TABLE IF NOT EXISTS our_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moltbook_id TEXT,
        title TEXT,
        content TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Activity log
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        target_id TEXT,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Rate limit tracking
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        value TEXT,
        expires_at TEXT
      );

      -- IdleTrencher updates for posting
      CREATE TABLE IF NOT EXISTS updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT,
        description TEXT,
        posted INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // === Interactions ===

  hasInteracted(postId, type = 'replied') {
    const row = this.db.prepare(
      `SELECT ${type} FROM interactions WHERE post_id = ?`
    ).get(postId);
    return row?.[type] === 1;
  }

  markInteraction(postId, type = 'replied') {
    this.db.prepare(`
      INSERT INTO interactions (post_id, ${type})
      VALUES (?, 1)
      ON CONFLICT(post_id) DO UPDATE SET ${type} = 1
    `).run(postId);
  }

  // === Our Posts ===

  savePost(moltbookId, title, content) {
    return this.db.prepare(`
      INSERT INTO our_posts (moltbook_id, title, content)
      VALUES (?, ?, ?)
    `).run(moltbookId, title, content);
  }

  getRecentPosts(limit = 10) {
    return this.db.prepare(`
      SELECT * FROM our_posts
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  }

  // === Activity Log ===

  logActivity(action, targetId = null, details = null) {
    this.db.prepare(`
      INSERT INTO activity_log (action, target_id, details)
      VALUES (?, ?, ?)
    `).run(action, targetId, details);
  }

  getActivityLog(limit = 50) {
    return this.db.prepare(`
      SELECT * FROM activity_log
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);
  }

  // === Rate Limits ===

  getRateLimit(key) {
    const row = this.db.prepare(`
      SELECT value, expires_at FROM rate_limits
      WHERE key = ? AND expires_at > datetime('now')
    `).get(key);
    return row?.value;
  }

  setRateLimit(key, value, expiresInSeconds) {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    this.db.prepare(`
      INSERT INTO rate_limits (key, value, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, expires_at = ?
    `).run(key, value, expiresAt, value, expiresAt);
  }

  // === Updates ===

  addUpdate(version, description) {
    return this.db.prepare(`
      INSERT INTO updates (version, description)
      VALUES (?, ?)
    `).run(version, description);
  }

  getUnpostedUpdates() {
    return this.db.prepare(`
      SELECT * FROM updates
      WHERE posted = 0
      ORDER BY created_at ASC
    `).all();
  }

  markUpdatePosted(id) {
    this.db.prepare(`
      UPDATE updates SET posted = 1 WHERE id = ?
    `).run(id);
  }

  // === Stats ===

  getStats() {
    const interactions = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(replied) as replies,
        SUM(upvoted) as upvotes
      FROM interactions
    `).get();

    const posts = this.db.prepare(`
      SELECT COUNT(*) as count FROM our_posts
    `).get();

    const recentActivity = this.db.prepare(`
      SELECT action, COUNT(*) as count
      FROM activity_log
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY action
    `).all();

    return {
      totalInteractions: interactions.total,
      repliesSent: interactions.replies,
      upvotesGiven: interactions.upvotes,
      postsCreated: posts.count,
      last24h: recentActivity,
    };
  }

  close() {
    this.db.close();
  }
}

// Singleton for convenience
let instance = null;
export function getStateManager() {
  if (!instance) {
    instance = new StateManager();
  }
  return instance;
}
