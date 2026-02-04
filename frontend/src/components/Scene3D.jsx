/**
 * Scene3D - React wrapper for Three.js FarmScene
 * Low-poly farm visualization for token partners
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FarmScene } from '../scene/FarmScene';
import { FeatureMenu } from './FeatureMenu';
import './Scene3D.css';

/**
 * Check if WebGL is available
 */
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

export function Scene3D({ partners, isExploreMode = false, onPartnerClick, currentView, onViewChange, idleBalance }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const onPartnerClickRef = useRef(onPartnerClick);
  const { t, i18n } = useTranslation();
  const [webglSupported, setWebglSupported] = useState(true);
  const [sceneError, setSceneError] = useState(null);
  const [loadingAsset, setLoadingAsset] = useState('Initializing...');
  const [isLoading, setIsLoading] = useState(true);

  // Track if scene has been initialized to prevent re-creation
  const sceneInitializedRef = useRef(false);

  // Keep callback ref up to date
  useEffect(() => {
    onPartnerClickRef.current = onPartnerClick;
  }, [onPartnerClick]);

  // Stable callback using ref pattern - never changes reference
  const handlePartnerClickRef = useRef((partner) => {
    if (onPartnerClickRef.current) {
      onPartnerClickRef.current(partner);
    }
  });

  // Loading progress callback using ref pattern - never changes reference
  const handleLoadingProgressRef = useRef(({ assetName, isComplete }) => {
    if (isComplete) {
      setIsLoading(false);
      setLoadingAsset(null);
    } else if (assetName) {
      setLoadingAsset(assetName);
    }
  });

  // Check WebGL support on mount
  useEffect(() => {
    const supported = checkWebGLSupport();
    setWebglSupported(supported);
    if (!supported) {
      console.warn('WebGL is not supported on this device');
    }
  }, []);

  // Initialize Three.js scene (only once)
  useEffect(() => {
    // Skip if container not ready, WebGL not supported, or scene already initialized
    if (!containerRef.current || !webglSupported) return;
    if (sceneInitializedRef.current && sceneRef.current) {
      console.log('[Scene3D] Scene already initialized, skipping re-creation');
      return;
    }

    setIsLoading(true);
    setLoadingAsset('Initializing...');

    try {
      sceneRef.current = new FarmScene(
        containerRef.current,
        handlePartnerClickRef.current,
        t,
        handleLoadingProgressRef.current
      );
      sceneInitializedRef.current = true;
      console.log('[Scene3D] Scene initialized successfully');
    } catch (error) {
      console.error('Failed to initialize 3D scene:', error);
      setSceneError(error.message);
      setIsLoading(false);
    }

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
        sceneInitializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglSupported]); // Only re-run if WebGL support changes (shouldn't happen)

  // Update translation function when language changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setTranslation(t);
    }
  }, [t, i18n.language]);

  // Update partners when data changes
  useEffect(() => {
    if (sceneRef.current && partners) {
      sceneRef.current.updatePartners(partners);
    }
  }, [partners]);

  // Show WebGL error or scene error
  const showError = !webglSupported || sceneError;

  return (
    <div className="scene-container" ref={containerRef}>
      {/* WebGL / Scene error fallback */}
      {showError && (
        <div className="webgl-error">
          <div className="webgl-error-content">
            <span className="placeholder-icon">⚠️</span>
            <h2>{!webglSupported ? 'WebGL Not Supported' : '3D Scene Error'}</h2>
            <p>
              {!webglSupported
                ? 'Your browser or device does not support WebGL. Please try a different browser or device.'
                : `Failed to load 3D scene: ${sceneError}`
              }
            </p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {!showError && isLoading && partners && partners.length > 0 && (
        <div className="scene-loading">
          <div className="loading-content">
            <div className="loading-spinner">
              <span className="spinner-sword">⚔️</span>
            </div>
            <div className="loading-text">
              <span className="loading-label">Loading</span>
              <span className="loading-asset">{loadingAsset || '...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Placeholder when no partners */}
      {!showError && (!partners || partners.length === 0) && (
        <div className="scene-placeholder">
          <div className="placeholder-content">
            <span className="placeholder-icon">{isExploreMode ? '🔍' : '🌾'}</span>
            <h2>{isExploreMode ? t('scene.emptyVillage') : t('scene.welcome')}</h2>
            <p>{isExploreMode
              ? t('scene.noPartners')
              : t('scene.connectPrompt')
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
