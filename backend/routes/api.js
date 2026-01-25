/**
 * API Routes
 */

import { Router } from 'express';
import { updateWalletData, getPartners, checkAccess } from '../services/partnerManager.js';
import { getPublicWalletData } from '../services/cacheManager.js';
import { statements, getGCSStatus } from '../db/database.js';
import { writeLimiter, requireAuth, checkBlocklist } from '../middleware/index.js';

const router = Router();

/**
 * GET /api/wallet/:address
 * Get wallet overview with partners
 * Security: blocklist check
 */
router.get('/wallet/:address', checkBlocklist, async (req, res) => {
  try {
    const { address } = req.params;
    const { refresh } = req.query;

    // Validate address format (basic check)
    if (!address || address.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    let data;

    if (refresh === 'true') {
      // Force refresh from blockchain
      data = await updateWalletData(address);
    } else {
      // Try to get cached data first
      const wallet = statements.getWallet.get(address);
      const allPartners = await getPartners(address);
      const access = await checkAccess(address);

      if (wallet && allPartners.length > 0) {
        // Apply maxPartners limit based on $idle holdings
        const limitedPartners = allPartners.slice(0, access.maxPartners);

        data = {
          wallet: {
            address: wallet.address,
            totalValue: wallet.total_value,
            previousValue: wallet.previous_value,
            lastUpdated: wallet.last_updated
          },
          partners: limitedPartners,
          access
        };
      } else {
        // No cached data, fetch fresh
        data = await updateWalletData(address);
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error in GET /wallet/:address', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/wallet/:address/refresh
 * Force refresh wallet data
 * Security: blocklist check, auth required (write operation), stricter rate limit
 */
router.post('/wallet/:address/refresh', writeLimiter, checkBlocklist, requireAuth, async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || address.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const data = await updateWalletData(address);
    res.json(data);
  } catch (error) {
    console.error('Error in POST /wallet/:address/refresh', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wallet/:address/partners
 * Get partners list only
 * Security: blocklist check
 */
router.get('/wallet/:address/partners', checkBlocklist, async (req, res) => {
  try {
    const { address } = req.params;
    const allPartners = await getPartners(address);
    const access = await checkAccess(address);

    // Apply maxPartners limit based on $idle holdings
    const partners = allPartners.slice(0, access.maxPartners);

    res.json({ partners, access });
  } catch (error) {
    console.error('Error in GET /wallet/:address/partners', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/access/:address
 * Check $idle token access level
 * Security: blocklist check
 */
router.get('/access/:address', checkBlocklist, async (req, res) => {
  try {
    const { address } = req.params;
    const access = await checkAccess(address);
    res.json(access);
  } catch (error) {
    console.error('Error in GET /access/:address', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wallet/:address/history
 * Get historical snapshots
 * Security: blocklist check
 */
router.get('/wallet/:address/history', checkBlocklist, async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 30 } = req.query;

    const snapshots = statements.getSnapshots.all(address, parseInt(limit));

    res.json({
      snapshots: snapshots.map(s => ({
        date: s.date,
        totalValue: s.total_value,
        data: JSON.parse(s.snapshot_data || '{}')
      }))
    });
  } catch (error) {
    console.error('Error in GET /wallet/:address/history', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/wallet/:address/partner/:tokenAddress/designated-value
 * Update the designated value for a partner token
 * Security: blocklist check, auth required, stricter rate limit
 */
router.put('/wallet/:address/partner/:tokenAddress/designated-value', writeLimiter, checkBlocklist, requireAuth, async (req, res) => {
  try {
    const { address, tokenAddress } = req.params;
    const { designatedValue } = req.body;

    if (!address || address.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (!tokenAddress || tokenAddress.length < 32) {
      return res.status(400).json({ error: 'Invalid token address' });
    }

    if (typeof designatedValue !== 'number' || designatedValue < 0) {
      return res.status(400).json({ error: 'Invalid designated value' });
    }

    // Update designated value in database
    statements.updateDesignatedValue.run({
      walletAddress: address,
      tokenAddress: tokenAddress,
      designatedValue: designatedValue,
      lastUpdated: new Date().toISOString()
    });

    // Return updated partner data
    const partner = statements.getPartner.get(address, tokenAddress);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({
      success: true,
      partner: {
        tokenAddress: partner.token_address,
        tokenSymbol: partner.token_symbol,
        designatedValue: partner.designated_value,
        currentValue: partner.current_value
      }
    });
  } catch (error) {
    console.error('Error in PUT /wallet/:address/partner/:tokenAddress/designated-value', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/wallet/:address/partner/:tokenAddress
 * Get single partner details
 * Security: blocklist check
 */
router.get('/wallet/:address/partner/:tokenAddress', checkBlocklist, async (req, res) => {
  try {
    const { address, tokenAddress } = req.params;

    const partner = statements.getPartner.get(address, tokenAddress);
    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({
      tokenAddress: partner.token_address,
      tokenSymbol: partner.token_symbol,
      logoUrl: partner.logo_url,
      amount: partner.amount,
      currentValue: partner.current_value,
      previousValue: partner.previous_value,
      designatedValue: partner.designated_value || partner.current_value,
      exp: partner.exp,
      rank: partner.rank,
      firstSeenDate: partner.first_seen_date
    });
  } catch (error) {
    console.error('Error in GET /wallet/:address/partner/:tokenAddress', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/explore/:address
 * Get public wallet view with cached data (24-hour refresh limit)
 * Used by magnifying glass feature to view other wallets
 * Security: blocklist check
 */
router.get('/explore/:address', checkBlocklist, async (req, res) => {
  try {
    const { address } = req.params;

    if (!address || address.length < 32) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const data = await getPublicWalletData(address, updateWalletData, checkAccess);

    res.json({
      walletAddress: data.walletAddress,
      totalValue: data.totalValue,
      partners: data.partners,
      lastCached: data.lastCached,
      access: data.access,
      wasRefreshed: data.wasRefreshed
    });
  } catch (error) {
    console.error('Error in GET /explore/:address', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const gcsStatus = getGCSStatus();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'idleTrencher API',
    environment: process.env.NODE_ENV || 'development',
    gcs: gcsStatus
  });
});

export default router;
