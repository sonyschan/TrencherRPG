/**
 * Privy Authentication Middleware
 * Verifies Privy tokens for protected routes
 */

import { PrivyClient } from '@privy-io/node';

// Initialize Privy client (lazy initialization for optional auth)
let privyClient = null;

function getPrivyClient() {
  if (!privyClient && process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET) {
    privyClient = new PrivyClient({
      appId: process.env.PRIVY_APP_ID,
      appSecret: process.env.PRIVY_APP_SECRET
    });
  }
  return privyClient;
}

/**
 * Middleware that requires valid Privy authentication
 * Returns 401 if token is missing or invalid
 */
export async function requireAuth(req, res, next) {
  const client = getPrivyClient();

  // If Privy is not configured, skip auth (development mode)
  if (!client) {
    console.warn('Privy not configured, skipping auth check');
    req.privyUserId = null;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const verifiedClaims = await client.utils().auth().verifyAccessToken({
      access_token: token
    });
    req.privyUserId = verifiedClaims.userId;
    next();
  } catch (error) {
    console.error('Privy auth error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

/**
 * Middleware that optionally extracts Privy user (doesn't reject if missing)
 * Useful for endpoints that work with or without auth
 */
export async function optionalAuth(req, res, next) {
  const client = getPrivyClient();

  if (!client) {
    req.privyUserId = null;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.privyUserId = null;
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const verifiedClaims = await client.utils().auth().verifyAccessToken({
      access_token: token
    });
    req.privyUserId = verifiedClaims.userId;
  } catch {
    req.privyUserId = null;
  }

  next();
}
