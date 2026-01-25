import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, copyFileSync, unlinkSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// GCS sync variables
let storage = null;
let gcsBucket = null;
const GCS_DB_PATH = 'data/idletrencher.db';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let syncIntervalId = null;
let lastSyncTime = null;

// Local database path
const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'idletrencher.db');

// Ensure data directory exists
mkdirSync(dataDir, { recursive: true });

/**
 * Initialize GCS client for production
 */
async function initGCS() {
  if (process.env.NODE_ENV !== 'production' || !process.env.GCS_BUCKET_NAME) {
    console.log('GCS sync disabled (development mode or no bucket configured)');
    return false;
  }

  try {
    const { Storage } = await import('@google-cloud/storage');
    storage = new Storage();
    gcsBucket = storage.bucket(process.env.GCS_BUCKET_NAME);
    console.log(`GCS initialized: ${process.env.GCS_BUCKET_NAME}`);
    return true;
  } catch (error) {
    console.error('Failed to initialize GCS:', error.message);
    return false;
  }
}

/**
 * Download database from GCS on startup
 */
async function downloadFromGCS() {
  if (!gcsBucket) return false;

  try {
    const file = gcsBucket.file(GCS_DB_PATH);
    const [exists] = await file.exists();

    if (exists) {
      console.log('Downloading database from GCS...');
      await file.download({ destination: dbPath });
      console.log('Database downloaded from GCS');
      return true;
    } else {
      console.log('No existing database in GCS, starting fresh');
      return false;
    }
  } catch (error) {
    console.error('Failed to download from GCS:', error.message);
    return false;
  }
}

/**
 * Upload database to GCS
 */
async function uploadToGCS() {
  if (!gcsBucket) return false;

  try {
    // Create a backup before uploading
    const backupPath = `${dbPath}.backup`;
    copyFileSync(dbPath, backupPath);

    console.log('Uploading database to GCS...');
    await gcsBucket.upload(backupPath, {
      destination: GCS_DB_PATH,
      metadata: {
        contentType: 'application/x-sqlite3',
      },
    });

    // Clean up backup
    unlinkSync(backupPath);

    lastSyncTime = new Date();
    console.log(`Database uploaded to GCS at ${lastSyncTime.toISOString()}`);
    return true;
  } catch (error) {
    console.error('Failed to upload to GCS:', error.message);
    return false;
  }
}

/**
 * Start periodic GCS sync
 */
function startGCSSync() {
  if (!gcsBucket || syncIntervalId) return;

  syncIntervalId = setInterval(async () => {
    await uploadToGCS();
  }, SYNC_INTERVAL_MS);

  console.log(`GCS sync started (every ${SYNC_INTERVAL_MS / 1000 / 60} minutes)`);
}

/**
 * Handle graceful shutdown - upload final state
 */
async function handleShutdown(signal) {
  console.log(`Received ${signal}, performing graceful shutdown...`);

  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  if (gcsBucket) {
    await uploadToGCS();
  }

  // Close database
  if (db) {
    db.close();
  }

  process.exit(0);
}

// Initialize GCS in production (async IIFE)
let gcsInitialized = false;
(async () => {
  gcsInitialized = await initGCS();
  if (gcsInitialized) {
    await downloadFromGCS();
    startGCSSync();

    // Register shutdown handlers
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  }
})();

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  -- Wallets table
  CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    total_value REAL DEFAULT 0,
    previous_value REAL DEFAULT 0,
    last_updated TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Token partners table
  CREATE TABLE IF NOT EXISTS token_partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_symbol TEXT,
    logo_url TEXT,
    amount REAL DEFAULT 0,
    current_value REAL DEFAULT 0,
    previous_value REAL DEFAULT 0,
    designated_value REAL DEFAULT 0,
    exp INTEGER DEFAULT 0,
    last_exp_update TEXT,
    rank INTEGER,
    first_seen_date TEXT DEFAULT CURRENT_TIMESTAMP,
    last_updated TEXT,
    UNIQUE(wallet_address, token_address),
    FOREIGN KEY (wallet_address) REFERENCES wallets(address)
  );

  -- Daily snapshots for history
  CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    date TEXT NOT NULL,
    total_value REAL,
    snapshot_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wallet_address, date),
    FOREIGN KEY (wallet_address) REFERENCES wallets(address)
  );

  -- Wallet cache for public viewing (24-hour refresh limit)
  CREATE TABLE IF NOT EXISTS wallet_cache (
    wallet_address TEXT PRIMARY KEY,
    total_value REAL DEFAULT 0,
    partners_data TEXT,
    last_cached TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Blocked wallets table (for abuse prevention)
  CREATE TABLE IF NOT EXISTS blocked_wallets (
    address TEXT PRIMARY KEY,
    reason TEXT,
    blocked_at TEXT DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 1
  );

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_partners_wallet ON token_partners(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_partners_rank ON token_partners(wallet_address, rank);
  CREATE INDEX IF NOT EXISTS idx_snapshots_wallet_date ON daily_snapshots(wallet_address, date);
  CREATE INDEX IF NOT EXISTS idx_wallet_cache_time ON wallet_cache(last_cached);
  CREATE INDEX IF NOT EXISTS idx_blocked_wallets_active ON blocked_wallets(active);
`);

// Migration: Add designated_value column if it doesn't exist (for existing databases)
try {
  const columns = db.prepare("PRAGMA table_info(token_partners)").all();
  const hasDesignatedValue = columns.some(col => col.name === 'designated_value');
  if (!hasDesignatedValue) {
    db.exec('ALTER TABLE token_partners ADD COLUMN designated_value REAL DEFAULT 0');
    // Initialize designated_value with current_value for existing records
    db.exec('UPDATE token_partners SET designated_value = current_value WHERE designated_value = 0 OR designated_value IS NULL');
    console.log('Migration: Added designated_value column to token_partners');
  }
} catch (e) {
  // Column might already exist, ignore
}

// Migration: Add last_exp_update column if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(token_partners)").all();
  const hasLastExpUpdate = columns.some(col => col.name === 'last_exp_update');
  if (!hasLastExpUpdate) {
    db.exec('ALTER TABLE token_partners ADD COLUMN last_exp_update TEXT');
    // Initialize with current timestamp for existing records
    db.exec('UPDATE token_partners SET last_exp_update = CURRENT_TIMESTAMP WHERE last_exp_update IS NULL');
    console.log('Migration: Added last_exp_update column to token_partners');
  }
} catch (e) {
  // Column might already exist, ignore
}

// Migration: Add skin column if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(token_partners)").all();
  const hasSkin = columns.some(col => col.name === 'skin');
  if (!hasSkin) {
    db.exec('ALTER TABLE token_partners ADD COLUMN skin TEXT');
    console.log('Migration: Added skin column to token_partners');
  }
} catch (e) {
  // Column might already exist, ignore
}

// Migration: Add price_change_24h column if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(token_partners)").all();
  const hasPriceChange24h = columns.some(col => col.name === 'price_change_24h');
  if (!hasPriceChange24h) {
    db.exec('ALTER TABLE token_partners ADD COLUMN price_change_24h REAL');
    console.log('Migration: Added price_change_24h column to token_partners');
  }
} catch (e) {
  // Column might already exist, ignore
}

// Prepared statements for common operations
export const statements = {
  // Wallet operations
  upsertWallet: db.prepare(`
    INSERT INTO wallets (address, total_value, previous_value, last_updated)
    VALUES (@address, @totalValue, @previousValue, @lastUpdated)
    ON CONFLICT(address) DO UPDATE SET
      previous_value = wallets.total_value,
      total_value = @totalValue,
      last_updated = @lastUpdated
  `),

  getWallet: db.prepare('SELECT * FROM wallets WHERE address = ?'),

  // Partner operations
  upsertPartner: db.prepare(`
    INSERT INTO token_partners (wallet_address, token_address, token_symbol, logo_url, amount, current_value, previous_value, designated_value, exp, last_exp_update, rank, skin, price_change_24h, last_updated)
    VALUES (@walletAddress, @tokenAddress, @tokenSymbol, @logoUrl, @amount, @currentValue, @previousValue, @designatedValue, @exp, CURRENT_TIMESTAMP, @rank, @skin, @priceChange24h, @lastUpdated)
    ON CONFLICT(wallet_address, token_address) DO UPDATE SET
      token_symbol = @tokenSymbol,
      logo_url = @logoUrl,
      amount = @amount,
      previous_value = token_partners.current_value,
      current_value = @currentValue,
      designated_value = CASE
        WHEN token_partners.designated_value = 0 OR token_partners.designated_value IS NULL
        THEN @designatedValue
        ELSE token_partners.designated_value
      END,
      exp = @exp,
      last_exp_update = COALESCE(token_partners.last_exp_update, CURRENT_TIMESTAMP),
      rank = @rank,
      skin = COALESCE(token_partners.skin, @skin),
      price_change_24h = @priceChange24h,
      last_updated = @lastUpdated
  `),

  // Update designated value (user edit)
  updateDesignatedValue: db.prepare(`
    UPDATE token_partners
    SET designated_value = @designatedValue, last_updated = @lastUpdated
    WHERE wallet_address = @walletAddress AND token_address = @tokenAddress
  `),

  // Update skin (user edit)
  updateSkin: db.prepare(`
    UPDATE token_partners
    SET skin = @skin, last_updated = @lastUpdated
    WHERE wallet_address = @walletAddress AND token_address = @tokenAddress
  `),

  getPartners: db.prepare(`
    SELECT * FROM token_partners
    WHERE wallet_address = ? AND rank IS NOT NULL
    ORDER BY rank ASC
    LIMIT 10
  `),

  getPartner: db.prepare(`
    SELECT * FROM token_partners
    WHERE wallet_address = ? AND token_address = ?
  `),

  resetPartnerExp: db.prepare(`
    UPDATE token_partners
    SET exp = 0, rank = NULL, first_seen_date = CURRENT_TIMESTAMP
    WHERE wallet_address = ? AND token_address = ?
  `),

  incrementPartnerExp: db.prepare(`
    UPDATE token_partners SET exp = exp + 1, last_exp_update = CURRENT_TIMESTAMP WHERE wallet_address = ? AND token_address = ?
  `),

  // Snapshot operations
  insertSnapshot: db.prepare(`
    INSERT INTO daily_snapshots (wallet_address, date, total_value, snapshot_data)
    VALUES (@walletAddress, @date, @totalValue, @snapshotData)
    ON CONFLICT(wallet_address, date) DO UPDATE SET
      total_value = @totalValue,
      snapshot_data = @snapshotData
  `),

  getSnapshots: db.prepare(`
    SELECT * FROM daily_snapshots
    WHERE wallet_address = ?
    ORDER BY date DESC
    LIMIT ?
  `),

  // Wallet cache operations
  upsertWalletCache: db.prepare(`
    INSERT INTO wallet_cache (wallet_address, total_value, partners_data, last_cached)
    VALUES (@walletAddress, @totalValue, @partnersData, @lastCached)
    ON CONFLICT(wallet_address) DO UPDATE SET
      total_value = @totalValue,
      partners_data = @partnersData,
      last_cached = @lastCached
  `),

  getWalletCache: db.prepare(`
    SELECT * FROM wallet_cache WHERE wallet_address = ?
  `),

  isCacheStale: db.prepare(`
    SELECT wallet_address,
      (julianday('now') - julianday(last_cached)) * 24 > 24 as is_stale
    FROM wallet_cache
    WHERE wallet_address = ?
  `)
};

// Export GCS status for health checks
export function getGCSStatus() {
  return {
    enabled: gcsInitialized,
    bucket: process.env.GCS_BUCKET_NAME || null,
    lastSync: lastSyncTime?.toISOString() || null
  };
}

// Manual sync trigger (for admin endpoints)
export async function triggerGCSSync() {
  return await uploadToGCS();
}

export default db;
