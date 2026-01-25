/**
 * Scene3D - React wrapper for Three.js FarmScene
 * Low-poly farm visualization for token partners
 */

import { useEffect, useRef, useCallback } from 'react';
import { FarmScene } from '../scene/FarmScene';
import { FeatureMenu } from './FeatureMenu';
import './Scene3D.css';

export function Scene3D({ partners, isExploreMode = false, onPartnerClick, currentView, onViewChange, idleBalance }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const onPartnerClickRef = useRef(onPartnerClick);

  // Keep callback ref up to date
  useEffect(() => {
    onPartnerClickRef.current = onPartnerClick;
  }, [onPartnerClick]);

  // Stable callback that uses ref
  const handlePartnerClick = useCallback((partner) => {
    if (onPartnerClickRef.current) {
      onPartnerClickRef.current(partner);
    }
  }, []);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    sceneRef.current = new FarmScene(containerRef.current, handlePartnerClick);

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, [handlePartnerClick]);

  // Update partners when data changes
  useEffect(() => {
    if (sceneRef.current && partners) {
      sceneRef.current.updatePartners(partners);
    }
  }, [partners]);

  return (
    <div className="scene-container" ref={containerRef}>
      {(!partners || partners.length === 0) && (
        <div className="scene-placeholder">
          <div className="placeholder-content">
            <span className="placeholder-icon">{isExploreMode ? '🔍' : '🌾'}</span>
            <h2>{isExploreMode ? 'Empty Village' : 'Welcome to idleTrencher'}</h2>
            <p>{isExploreMode
              ? 'This wallet has no token partners yet'
              : 'Connect your wallet to see your token partners on the farm'
            }</p>
          </div>
        </div>
      )}

      {/* Feature Menu inside scene container */}
      {!isExploreMode && onViewChange && (
        <FeatureMenu
          currentView={currentView}
          onViewChange={onViewChange}
          idleBalance={idleBalance}
        />
      )}
    </div>
  );
}
