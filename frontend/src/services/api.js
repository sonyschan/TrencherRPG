/**
 * API Service - Communication with backend
 */

// Use proxy in development, full URL in production
const API_BASE = '/api';

/**
 * Get Privy auth token from the Privy SDK
 * This function should be called with the Privy hook's getAccessToken function
 */
let getPrivyToken = null;

/**
 * Initialize the API service with Privy's getAccessToken function
 * Call this from App.jsx after Privy is ready
 */
export function initApiAuth(getAccessTokenFn) {
  getPrivyToken = getAccessTokenFn;
}

/**
 * Build headers for API requests
 * Includes Authorization header for authenticated requests
 */
async function buildHeaders(requireAuth = false) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (requireAuth && getPrivyToken) {
    try {
      const token = await getPrivyToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get Privy token:', error.message);
    }
  }

  return headers;
}

/**
 * Fetch wallet data with partners
 * @param {string} address - Wallet address
 * @param {boolean} refresh - Force refresh from blockchain
 */
export async function getWalletData(address, refresh = false) {
  const url = `${API_BASE}/wallet/${address}${refresh ? '?refresh=true' : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch wallet data');
  }

  return response.json();
}

/**
 * Force refresh wallet data
 * Requires authentication
 * @param {string} address
 */
export async function refreshWalletData(address) {
  const headers = await buildHeaders(true);
  const response = await fetch(`${API_BASE}/wallet/${address}/refresh`, {
    method: 'POST',
    headers
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to refresh wallet data');
  }

  return response.json();
}

/**
 * Get partners list
 * @param {string} address
 */
export async function getPartners(address) {
  const response = await fetch(`${API_BASE}/wallet/${address}/partners`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch partners');
  }

  return response.json();
}

/**
 * Check access level based on $IDLE holdings
 * @param {string} address
 */
export async function checkAccess(address) {
  const response = await fetch(`${API_BASE}/access/${address}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check access');
  }

  return response.json();
}

/**
 * Trigger daily EXP increment (for testing)
 * @param {string} address
 */
export async function triggerDailyExp(address) {
  const response = await fetch(`${API_BASE}/wallet/${address}/daily-exp`, {
    method: 'POST'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to trigger daily EXP');
  }

  return response.json();
}

/**
 * Update designated value for a partner token
 * Requires authentication
 * @param {string} walletAddress
 * @param {string} tokenAddress
 * @param {number} designatedValue
 */
export async function updateDesignatedValue(walletAddress, tokenAddress, designatedValue) {
  const headers = await buildHeaders(true);
  const response = await fetch(
    `${API_BASE}/wallet/${walletAddress}/partner/${tokenAddress}/designated-value`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ designatedValue })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update designated value');
  }

  return response.json();
}

/**
 * Get single partner details
 * @param {string} walletAddress
 * @param {string} tokenAddress
 */
export async function getPartnerDetails(walletAddress, tokenAddress) {
  const response = await fetch(
    `${API_BASE}/wallet/${walletAddress}/partner/${tokenAddress}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch partner details');
  }

  return response.json();
}

/**
 * Explore another wallet (public view with 24-hour cache)
 * @param {string} address - Wallet address to explore
 */
export async function exploreWallet(address) {
  const response = await fetch(`${API_BASE}/explore/${address}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to explore wallet');
  }

  return response.json();
}
