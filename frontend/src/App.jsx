/**
 * idleTrencher - Main App Component
 */

import { useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Header } from './components/Header';
import { Scene3D } from './components/Scene3D';
import { PartnerList } from './components/PartnerList';
import { TokenDetailModal } from './components/TokenDetailModal';
import { ExploreDialog } from './components/ExploreDialog';
import { ExploreView } from './components/ExploreView';
import { useWalletData } from './hooks/useWalletData';
import { updateDesignatedValue, exploreWallet } from './services/api';
import './App.css';

function App() {
  const { ready } = usePrivy();
  const { walletAddress, wallet, partners, access, loading, isLoading, isUpdating, error, refresh, lastUpdated, isConnected, isDemo } = useWalletData();

  // Modal state
  const [selectedPartner, setSelectedPartner] = useState(null);

  // View state: 'home' | 'explore'
  const [currentView, setCurrentView] = useState('home');
  const [showExploreDialog, setShowExploreDialog] = useState(false);
  const [exploreData, setExploreData] = useState(null);
  const [exploreAddress, setExploreAddress] = useState(null);

  // Handle partner card click
  const handlePartnerClick = useCallback((partner) => {
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
          partners={partners}
          onPartnerClick={handlePartnerClick}
          currentView="home"
          onViewChange={handleViewChange}
          idleBalance={access?.idleBalance || 0}
        />
        <PartnerList
          partners={partners}
          access={access}
          loading={loading}
          onPartnerClick={handlePartnerClick}
        />
      </main>

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
            Hold {access.requiredForNext?.toLocaleString()} $idle tokens
            to unlock more partner slots
          </p>
        </div>
      )}

      {isDemo && (
        <div className="demo-banner">
          <span>Demo Mode - Connect your Solana wallet to see your own partners</span>
        </div>
      )}
    </div>
  );
}

export default App;
