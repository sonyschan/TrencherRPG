/**
 * Scene3D - React wrapper for Three.js FarmScene
 * Low-poly farm visualization for token partners
 */

import { useEffect, useRef, useCallback, useState } from 'react';
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
    if (!containerRef.current || !webglSupported) return;

    try {
      sceneRef.current = new FarmScene(containerRef.current, handlePartnerClick, t);
    } catch (error) {
      console.error('Failed to initialize 3D scene:', error);
      setSceneError(error.message);
    }

    return () => {
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handlePartnerClick, webglSupported]); // Don't include t - use setTranslation instead

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
