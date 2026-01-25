/**
 * Wallet Tracker Service
 * Uses Helius DAS API for efficient portfolio fetching
 * Uses DexScreener API for 24-hour price change data
 *
 * API Strategy (minimize calls):
 * - Helius: 1 call per refresh (all tokens + prices)
 * - DexScreener: 1 call per refresh (batch up to 30 tokens for 24h change)
 *
 * https://docs.helius.dev/solana-apis/digital-asset-standard-das-api
 * https://docs.dexscreener.com/api/reference
 */

import { getPriceChanges } from './priceChangeService.js';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const HELIUS_RPC_URL = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

// Native SOL mint address
const NATIVE_SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Get wallet portfolio using Helius DAS API
 * One API call returns all assets with estimated values
 * @param {string} walletAddress - Solana wallet address
 * @returns {Promise<{tokens: Array, totalValue: number}>}
 */
export async function getWalletPortfolio(walletAddress) {
  try {
    // Use Helius DAS API if API key is available
    if (HELIUS_API_KEY) {
      return await getPortfolioFromHelius(walletAddress);
    }

    // Fallback to basic RPC + DexScreener (slower)
    console.warn('No Helius API key, using fallback method (slower)');
    return await getPortfolioFallback(walletAddress);
  } catch (error) {
    console.error('Error fetching portfolio:', error.message);
    throw error;
  }
}

/**
 * Fetch portfolio using Helius DAS API (recommended)
 * Single API call for all assets with prices
 */
async function getPortfolioFromHelius(walletAddress) {
  const response = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'portfolio',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: walletAddress,
        displayOptions: {
          showFungible: true,
          showNativeBalance: true
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Helius API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'Helius API error');
  }

  const assets = data.result?.items || [];
  const nativeBalance = data.result?.nativeBalance;

  const tokens = [];

  // Add native SOL balance
  if (nativeBalance && nativeBalance.lamports > 0) {
    const solAmount = nativeBalance.lamports / 1e9;
    const solPrice = nativeBalance.price_per_sol || 0;
    const solValue = nativeBalance.total_price || (solAmount * solPrice);

    tokens.push({
      tokenAddress: NATIVE_SOL_MINT,
      symbol: 'SOL',
      name: 'Solana',
      logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      amount: solAmount,
      price: solPrice,
      value: solValue,
      priceChange24h: 0
    });
  }

  // Process fungible tokens
  for (const asset of assets) {
    // Skip NFTs, only process fungible tokens
    if (asset.interface !== 'FungibleToken' && asset.interface !== 'FungibleAsset') {
      continue;
    }

    const tokenInfo = asset.token_info || {};
    const amount = tokenInfo.balance ? tokenInfo.balance / Math.pow(10, tokenInfo.decimals || 0) : 0;
    const price = tokenInfo.price_info?.price_per_token || 0;
    const value = tokenInfo.price_info?.total_price || (amount * price);

    // Skip tokens with value < $0.01 (dust)
    if (value < 0.01) continue;

    tokens.push({
      tokenAddress: asset.id,
      symbol: tokenInfo.symbol || asset.content?.metadata?.symbol || 'UNKNOWN',
      name: asset.content?.metadata?.name || tokenInfo.symbol || 'Unknown Token',
      logoUrl: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
      amount: amount,
      price: price,
      value: value,
      priceChange24h: 0  // Will be populated by DexScreener batch call
    });
  }

  // Sort by value (descending)
  tokens.sort((a, b) => b.value - a.value);

  // Fetch 24h price changes and social links from DexScreener (batch API call)
  // Only fetch for top tokens to minimize API usage
  const topTokenAddresses = tokens.slice(0, 10).map(t => t.tokenAddress);
  const dexData = await getPriceChanges(topTokenAddresses);

  // Apply DexScreener data to tokens
  for (const token of tokens) {
    const data = dexData.get(token.tokenAddress);
    if (data) {
      token.priceChange24h = data.priceChange24h;
      token.socials = data.socials;
      token.websites = data.websites;
      token.dexscreenerUrl = data.dexscreenerUrl;
    }
  }

  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);

  return {
    tokens,
    totalValue
  };
}

/**
 * Fallback method using basic RPC + DexScreener
 * Slower but works without Helius API key
 */
async function getPortfolioFallback(walletAddress) {
  const { Connection, PublicKey } = await import('@solana/web3.js');
  const { getMultipleTokenInfo } = await import('./priceService.js');

  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const publicKey = new PublicKey(walletAddress);

  // Get SOL balance
  const solBalance = await connection.getBalance(publicKey);
  const solAmount = solBalance / 1e9;

  // Get all SPL token accounts
  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
    publicKey,
    { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
  );

  const holdings = [];

  // Add SOL
  if (solAmount > 0) {
    holdings.push({
      tokenAddress: NATIVE_SOL_MINT,
      amount: solAmount
    });
  }

  // Process SPL tokens
  for (const account of tokenAccounts.value) {
    const info = account.account.data.parsed.info;
    const amount = parseFloat(info.tokenAmount.uiAmount || 0);

    if (amount > 0) {
      holdings.push({
        tokenAddress: info.mint,
        amount: amount
      });
    }
  }

  // Get prices (this is the slow part)
  const tokenAddresses = holdings.map(h => h.tokenAddress);
  const priceInfo = await getMultipleTokenInfo(tokenAddresses);

  // Calculate values
  const tokens = holdings.map(holding => {
    const info = priceInfo.get(holding.tokenAddress) || { price: 0, logoUrl: null, symbol: 'UNKNOWN' };
    const value = holding.amount * info.price;

    return {
      tokenAddress: holding.tokenAddress,
      symbol: info.symbol,
      name: info.name,
      logoUrl: info.logoUrl,
      amount: holding.amount,
      price: info.price,
      value: value,
      priceChange24h: info.priceChange24h || 0
    };
  }).filter(t => t.value >= 0.01); // Filter dust

  tokens.sort((a, b) => b.value - a.value);
  const totalValue = tokens.reduce((sum, t) => sum + t.value, 0);

  return { tokens, totalValue };
}

/**
 * Get top N tokens by value
 * @param {string} walletAddress
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function getTopTokens(walletAddress, limit = 10) {
  const portfolio = await getWalletPortfolio(walletAddress);
  return portfolio.tokens.slice(0, limit);
}

/**
 * Check if wallet holds specific token
 * @param {string} walletAddress
 * @param {string} tokenAddress
 * @returns {Promise<number>} Token balance
 */
export async function getTokenBalance(walletAddress, tokenAddress) {
  const portfolio = await getWalletPortfolio(walletAddress);
  const token = portfolio.tokens.find(t => t.tokenAddress === tokenAddress);
  return token ? token.amount : 0;
}
