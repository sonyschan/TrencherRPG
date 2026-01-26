/**
 * Custom hook for wallet data management
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { getWalletData, refreshWalletData, initApiAuth } from '../services/api';

// Constants
const SOL_ADDRESS = '11111111111111111111111111111111';
const PREMIUM_THRESHOLD = 100000; // 100K $idle tokens
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes in milliseconds
const SOL_LOGO_URL = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';

/**
 * Generate demo SOL token data for logged-out users
 * Random value: $500-$1500, Random price change: -5% to +5%
 */
function generateDemoSOL() {
  const randomValue = 500 + Math.random() * 1000; // $500 - $1500
  const randomChange = (Math.random() - 0.5) * 10; // -5% to +5%
  const state = randomChange > 1 ? 'increasing' : randomChange < -1 ? 'decreasing' : 'stable';

  return {
    tokenAddress: SOL_ADDRESS,
    tokenSymbol: 'SOL',
    tokenName: 'Solana',
    logoUrl: SOL_LOGO_URL,
    currentValue: randomValue,
    designatedValue: randomValue, // Same as current (no base value set)
    level: 1,
    rank: 1,
    state,
    priceChange24h: randomChange,
    hpBars: {
      bar1: { green: 10, red: 0 },
      bar2: { green: 0, show: false },
      bar3: { green: 0, show: false }
    },
    levelInfo: {
      level: 1,
      exp: 0,
      progress: 0,
      isMaxLevel: false
    },
    isDemo: true // Mark as demo token for special handling
  };
}

export function useWalletData() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const apiAuthInitialized = useRef(false);

  // Initialize API auth with Privy's getAccessToken (once)
  useEffect(() => {
    if (ready && getAccessToken && !apiAuthInitialized.current) {
      initApiAuth(getAccessToken);
      apiAuthInitialized.current = true;
    }
  }, [ready, getAccessToken]);

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);  // Reading from cache
  const [isUpdating, setIsUpdating] = useState(false); // Calling API to refresh
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [demoSOL, setDemoSOL] = useState(null);

  // Get Solana wallet address from Privy user
  const getUserWalletAddress = () => {
    if (!user) return null;

    // Check for Solana wallet in linked accounts
    const solanaWallet = user.linkedAccounts?.find(
      a => a.type === 'wallet' && a.chainType === 'solana'
    );
    if (solanaWallet) return solanaWallet.address;

    // Check wallet object
    if (user.wallet?.chainType === 'solana') {
      return user.wallet.address;
    }

    return null;
  };

  const userWalletAddress = getUserWalletAddress();

  // Determine if we're in demo mode (no wallet connected)
  const isDemoMode = ready && !userWalletAddress;

  // Generate demo SOL on first render when in demo mode
  useEffect(() => {
    if (isDemoMode && !demoSOL) {
      setDemoSOL(generateDemoSOL());
    }
  }, [isDemoMode, demoSOL]);

  // Clear demo SOL when user connects wallet
  useEffect(() => {
    if (userWalletAddress) {
      setDemoSOL(null);
    }
  }, [userWalletAddress]);

  // Fetch wallet data (only when logged in)
  const fetchData = useCallback(async (forceRefresh = false) => {
    // Don't fetch API data when not logged in - use demo SOL instead
    if (!userWalletAddress) {
      setIsDemo(true);
      setIsLoading(false);
      setIsUpdating(false);
      return;
    }

    // forceRefresh = true means calling API (Updating)
    // forceRefresh = false means reading cache (Loading)
    if (forceRefresh) {
      setIsUpdating(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = forceRefresh
        ? await refreshWalletData(userWalletAddress)
        : await getWalletData(userWalletAddress);
      setData(result);
      setIsDemo(false);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Error fetching wallet data:', err);
    } finally {
      setIsLoading(false);
      setIsUpdating(false);
    }
  }, [userWalletAddress]);

  // Auto-fetch on mount and when wallet changes
  // Only premium users (>=100K $idle) get auto-refresh, and only if data is stale (>10 min)
  useEffect(() => {
    if (!ready) return;

    if (!userWalletAddress) {
      // Demo mode - no API calls
      setIsDemo(true);
      setIsLoading(false);
      setIsUpdating(false);
      return;
    }

    // Always fetch cached data first (saves API calls)
    const initializeData = async () => {
      setIsLoading(true);  // Reading from cache
      setError(null);

      try {
        // Step 1: Get cached data first
        const cachedResult = await getWalletData(userWalletAddress);
        setData(cachedResult);
        setIsDemo(false);
        setIsLoading(false);  // Done reading cache

        // Step 2: Check if premium user (>=100K $idle)
        const isPremium = cachedResult?.access?.idleBalance >= PREMIUM_THRESHOLD;

        // Step 3: Check if data is stale (>10 minutes since last update)
        const lastUpdatedStr = cachedResult?.wallet?.lastUpdated;
        const lastUpdatedTime = lastUpdatedStr ? new Date(lastUpdatedStr).getTime() : 0;
        const isStale = (Date.now() - lastUpdatedTime) > STALE_THRESHOLD;

        // Step 4: Refresh logic
        // - Premium users: refresh only if data is stale (>10 min)
        // - Basic users: use cached data (can manually refresh with cooldown)
        // - First time users (no cache): will get fresh data from backend anyway
        if (isPremium && isStale) {
          console.log(`Premium user - data stale (>${STALE_THRESHOLD / 60000} min), refreshing...`);
          setIsUpdating(true);  // Now calling API
          const freshResult = await refreshWalletData(userWalletAddress);
          setData(freshResult);
          setLastUpdated(new Date());
          setIsUpdating(false);
        } else {
          // Use cached data
          setLastUpdated(lastUpdatedStr ? new Date(lastUpdatedStr) : new Date());
          if (isPremium) {
            console.log('Premium user - data fresh, using cache');
          } else {
            console.log('Basic user - using cached data to save API calls');
          }
        }
      } catch (err) {
        setError(err.message);
        console.error('Error fetching wallet data:', err);
      } finally {
        setIsLoading(false);
        setIsUpdating(false);
      }
    };

    initializeData();
  }, [ready, userWalletAddress]);

  // Refresh function - regenerates demo SOL in demo mode
  const refresh = useCallback(() => {
    if (!userWalletAddress) {
      // In demo mode, regenerate random SOL data
      setDemoSOL(generateDemoSOL());
      return Promise.resolve();
    }
    return fetchData(true);
  }, [fetchData, userWalletAddress]);

  // Compute wallet and partners based on demo mode
  const wallet = useMemo(() => {
    if (isDemoMode && demoSOL) {
      return {
        address: 'demo',
        totalValue: demoSOL.currentValue
      };
    }
    return data?.wallet;
  }, [isDemoMode, demoSOL, data]);

  const partners = useMemo(() => {
    if (isDemoMode && demoSOL) {
      return [demoSOL];
    }
    return data?.partners || [];
  }, [isDemoMode, demoSOL, data]);

  return {
    walletAddress: userWalletAddress || 'demo',
    wallet,
    partners,
    access: data?.access,
    loading: isLoading || isUpdating,  // Combined for backward compatibility
    isLoading,   // Reading from cache (show "Loading")
    isUpdating,  // Calling API (show "Updating")
    error,
    refresh,
    lastUpdated,
    isConnected: ready && authenticated && !!userWalletAddress,
    isDemo: isDemoMode // True when not logged in
  };
}
