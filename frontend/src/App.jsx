/**
 * idleTrencher - Main App Component
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Header } from './components/Header';
import { Scene3D } from './components/Scene3D';
import { PartnerList } from './components/PartnerList';
import { TokenDetailModal } from './components/TokenDetailModal';
import { ExploreDialog } from './components/ExploreDialog';
import { ExploreView } from './components/ExploreView';
import { useWalletData } from './hooks/useWalletData';
import { useSkinAssignment } from './hooks/useSkinAssignment';
import { updateDesignatedValue, updateSkin, exploreWallet } from './services/api';
import './App.css';

// Constants
const IDLE_CA = '9jwHJHSD7geYvTy6WUtoDVuuvuoJiWH2XHWMggPUpump';
const OKX_DEX_URL = 'https://web3.okx.com/ul/GkvfeR3?ref=H2CRYTO5';

function App() {
  const { ready, authenticated, user } = usePrivy();
  const { walletAddress, wallet, partners, access, loading, isLoading, isUpdating, error, refresh, lastUpdated, isConnected, isDemo } = useWalletData();

  // Skin assignment management
  const { getSkinForToken, getExplicitSkinForToken, assignSkin, getTokenUsingSkin } = useSkinAssignment(walletAddress);

  // Handle skin change - save to localStorage and persist to backend
  const handleSkinChange = useCallback(async (tokenAddress, skinId) => {
    const partner = partners.find(p => p.tokenAddress === tokenAddress);
    if (partner) {
      // Save to localStorage (immediate UI update)
      assignSkin(tokenAddress, skinId, partner.level);

      // Persist to backend (async, don't block UI)
      try {
        await updateSkin(walletAddress, tokenAddress, skinId);
        console.log('[Skin] Saved to backend:', tokenAddress, skinId);
      } catch (error) {
        console.warn('[Skin] Failed to save to backend:', error.message);
        // localStorage still has it, so UI is consistent
      }
    }
  }, [partners, assignSkin, walletAddress]);

  // Merge skin info into partners for 3D rendering
  // Priority: localStorage assignment > backend skin > default skin
  const partnersWithSkins = useMemo(() => {
    const result = partners.map(partner => {
      const explicitSkin = getExplicitSkinForToken(partner.tokenAddress);
      const finalSkin = explicitSkin || partner.skin || 'villager';
      console.log(`[App] partnersWithSkins - ${partner.tokenSymbol}: explicit=${explicitSkin}, backend=${partner.skin}, final=${finalSkin}`);
      return {
        ...partner,
        skin: finalSkin,
      };
    });
    return result;
  }, [partners, getExplicitSkinForToken]);

  // Debug: Log Privy state changes
  useEffect(() => {
    console.log('[Privy Debug] State:', { ready, authenticated, user: user?.id });
    if (user) {
      console.log('[Privy Debug] User linked accounts:', user.linkedAccounts);
    }
  }, [ready, authenticated, user]);

  // Modal state
  const [selectedPartner, setSelectedPartner] = useState(null);

  // View state: 'home' | 'explore'
  const [currentView, setCurrentView] = useState('home');
  const [showExploreDialog, setShowExploreDialog] = useState(false);
  const [exploreData, setExploreData] = useState(null);
  const [exploreAddress, setExploreAddress] = useState(null);

  // Detect /explore/:address URL on page load
  useEffect(() => {
    const path = window.location.pathname;
    const exploreMatch = path.match(/^\/explore\/([A-Za-z0-9]+)$/);
    if (exploreMatch) {
      const address = exploreMatch[1];
      console.log('[App] Detected explore URL:', address);
      // Load explore data for this address
      exploreWallet(address).then(data => {
        setExploreData(data);
        setExploreAddress(address);
        setCurrentView('explore');
      }).catch(err => {
        console.error('[App] Failed to load explore data:', err);
        // Navigate to home on error
        window.history.replaceState({}, '', '/');
      });
    }
  }, []);

  // Copy CA state
  const [caCopied, setCaCopied] = useState(false);

  // Handle CA copy
  const handleCopyCA = useCallback(() => {
    navigator.clipboard.writeText(IDLE_CA);
    setCaCopied(true);
    setTimeout(() => setCaCopied(false), 2000);
  }, []);

  // Handle partner card click
  const handlePartnerClick = useCallback((partner) => {
    console.log('[App] Partner clicked:', partner.tokenSymbol, 'skin:', partner.skin);
    setSelectedPartner(partner);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setSelectedPartner(null);
  }, []);

  // Handle designated value update
  const handleUpdateDesignatedValue = useCallback(async (tokenAddress, newValue) => {
    await updateDesignatedValue(walletAddress, tokenAddress, newValue);
    // Refresh data after update
    await refresh();
    // Update selected partner with new data
    const updatedPartner = partners.find(p => p.tokenAddress === tokenAddress);
    if (updatedPartner) {
      setSelectedPartner({ ...updatedPartner, designatedValue: newValue });
    }
  }, [walletAddress, refresh, partners]);

  // Handle view change from feature menu
  const handleViewChange = useCallback((view) => {
    if (view === 'explore') {
      setShowExploreDialog(true);
    } else if (view === 'home') {
      setCurrentView('home');
      setExploreData(null);
      setExploreAddress(null);
    }
    // 'wardrobe' is disabled, do nothing
  }, []);

  // Handle explore wallet
  const handleExplore = useCallback(async (address) => {
    const data = await exploreWallet(address);
    setExploreData(data);
    setExploreAddress(address);
    setCurrentView('explore');
  }, []);

  // Handle return from explore view
  const handleBackFromExplore = useCallback(() => {
    setCurrentView('home');
    setExploreData(null);
    setExploreAddress(null);
    // Navigate URL to home
    window.history.pushState({}, '', '/');
  }, []);

  if (!ready) {
    return (
      <div className="app loading">
        <div className="loader">
          <span className="loader-icon">⚔️</span>
          <p>Loading idleTrencher...</p>
        </div>
      </div>
    );
  }

  // Render explore view
  if (currentView === 'explore' && exploreData) {
    return (
      <div className="app">
        <ExploreView
          walletAddress={exploreAddress}
          data={exploreData}
          onBack={handleBackFromExplore}
        />
      </div>
    );
  }

  // Render home view
  return (
    <div className="app">
      <Header
        wallet={wallet}
        onRefresh={refresh}
        loading={loading}
        isLoading={isLoading}
        isUpdating={isUpdating}
        lastUpdated={lastUpdated}
        access={access}
        isConnected={isConnected}
      />

      <main className="main-content">
        <Scene3D
          partners={partnersWithSkins}
          onPartnerClick={handlePartnerClick}
          currentView="home"
          onViewChange={handleViewChange}
          idleBalance={access?.idleBalance || 0}
        />
        <PartnerList
          partners={partnersWithSkins}
          access={access}
          loading={loading}
          onPartnerClick={handlePartnerClick}
        />
      </main>

      {/* Bottom-left: OKX DEX Logo */}
      <a
        href={OKX_DEX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="okx-logo-link"
        title="Trade on OKX DEX"
      >
        <img src="/assets/idleTrencherLogo-trans.png" alt="IdleTrencher" className="okx-logo" />
      </a>

      {/* Bottom-right: $IDLE Token Info */}
      <div className="token-info-badge">
        <span className="token-symbol">$IDLE</span>
        <span className="token-ca">{IDLE_CA.slice(0, 4)}...{IDLE_CA.slice(-4)}</span>
        <button
          className="copy-ca-btn"
          onClick={handleCopyCA}
          title={caCopied ? 'Copied!' : 'Copy CA'}
        >
          {caCopied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          )}
        </button>
      </div>

      {/* Explore Dialog */}
      <ExploreDialog
        isOpen={showExploreDialog}
        onClose={() => setShowExploreDialog(false)}
        onExplore={handleExplore}
      />

      {/* Token Detail Modal */}
      {selectedPartner && (
        <TokenDetailModal
          partner={selectedPartner}
          walletAddress={walletAddress}
          onClose={handleModalClose}
          onUpdateDesignatedValue={handleUpdateDesignatedValue}
          currentSkin={selectedPartner.skin || getSkinForToken(selectedPartner.tokenAddress)}
          onSkinChange={handleSkinChange}
          getTokenUsingSkin={getTokenUsingSkin}
          partners={partners}
        />
      )}

      {error && (
        <div className="error-toast">
          <span>Error: {error}</span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {isConnected && access && access.idleBalance === 0 && (
        <div className="access-warning">
          <p>
            Hold {access.requiredForNext?.toLocaleString()} $IDLE tokens
            to unlock more partner slots
          </p>
        </div>
      )}

      {isDemo && (
        <div className="demo-banner">
          <span>Visiting Village <span className="village-address">{wallet?.address ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}` : ''}</span> - Connect to see your own</span>
        </div>
      )}
    </div>
  );
}

export default App;
