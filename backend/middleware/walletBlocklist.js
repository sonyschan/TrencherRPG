/**
 * Wallet Blocklist Middleware
 * Prevents blocked wallets from accessing the API
 */

import db from '../db/database.js';

// Check if wallet is blocked
function isWalletBlocked(address) {
  if (!address) return false;

  try {
    const blocked = db.prepare(
      'SELECT 1 FROM blocked_wallets WHERE address = ? AND active = 1'
    ).get(address.toLowerCase());
    return !!blocked;
  } catch (error) {
    // Table might not exist yet, allow access
    console.error('Blocklist check error:', error.message);
    return false;
  }
}

/**
 * Middleware to check if wallet address is blocked
 * Extracts address from req.params.address or req.body.address
 */
export function checkBlocklist(req, res, next) {
  const address = req.params.address || req.body?.address;

  if (address && isWalletBlocked(address)) {
    console.warn(`Blocked wallet attempted access: ${address}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}

/**
 * Admin functions for managing blocklist (use with caution)
 */
export const blocklistAdmin = {
  /**
   * Add wallet to blocklist
   */
  blockWallet(address, reason = '') {
    try {
      db.prepare(`
        INSERT INTO blocked_wallets (address, reason, blocked_at, active)
        VALUES (?, ?, datetime('now'), 1)
        ON CONFLICT(address) DO UPDATE SET active = 1, reason = ?, blocked_at = datetime('now')
      `).run(address.toLowerCase(), reason, reason);
      return true;
    } catch (error) {
      console.error('Error blocking wallet:', error);
      return false;
    }
  },

  /**
   * Remove wallet from blocklist
   */
  unblockWallet(address) {
    try {
      db.prepare('UPDATE blocked_wallets SET active = 0 WHERE address = ?')
        .run(address.toLowerCase());
      return true;
    } catch (error) {
      console.error('Error unblocking wallet:', error);
      return false;
    }
  },

  /**
   * Get all blocked wallets
   */
  getBlockedWallets() {
    try {
      return db.prepare('SELECT * FROM blocked_wallets WHERE active = 1').all();
    } catch (error) {
      console.error('Error getting blocked wallets:', error);
      return [];
    }
  }
};
