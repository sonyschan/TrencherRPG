/**
 * FeatureMenu - Bottom-right navigation menu with pixel art icons
 */

import { useState } from 'react';
import './FeatureMenu.css';

export function FeatureMenu({ currentView, onViewChange }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const menuItems = [
    {
      id: 'home',
      label: 'Home',
      icon: <CampfireIcon />,
      enabled: true,
    },
    {
      id: 'explore',
      label: 'Explore',
      icon: <GateIcon />,
      enabled: true,
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      tooltip: 'Leaderboard(TODO)',
      icon: <TrophyIcon />,
      enabled: false,
      showDisabledStyle: false,
    },
  ];

  return (
    <div className="feature-menu">
      {menuItems.map((item) => (
        <div
          key={item.id}
          className={`menu-item ${currentView === item.id ? 'active' : ''} ${!item.enabled && item.showDisabledStyle !== false ? 'disabled' : ''}`}
          onClick={() => item.enabled && onViewChange(item.id)}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
          role="button"
          tabIndex={item.enabled ? 0 : -1}
        >
          {item.icon}
          {hoveredItem === item.id && (
            <span className="menu-tooltip">{item.tooltip || item.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Pixel Art Campfire Icon
function CampfireIcon() {
  return (
    <svg className="pixel-icon campfire" viewBox="0 0 32 32" width="72" height="72">
      {/* Wood logs */}
      <rect x="4" y="24" width="10" height="4" fill="#8B4513" />
      <rect x="18" y="24" width="10" height="4" fill="#8B4513" />
      <rect x="8" y="26" width="16" height="4" fill="#A0522D" />
      <rect x="6" y="28" width="6" height="2" fill="#654321" />
      <rect x="20" y="28" width="6" height="2" fill="#654321" />

      {/* Fire base - red/orange */}
      <rect x="10" y="20" width="12" height="4" fill="#FF4500" />
      <rect x="8" y="16" width="16" height="6" fill="#FF6347" />

      {/* Fire middle - orange */}
      <rect x="10" y="10" width="12" height="8" fill="#FFA500" />
      <rect x="12" y="6" width="8" height="6" fill="#FFD700" />

      {/* Fire top - yellow */}
      <rect x="14" y="2" width="4" height="6" fill="#FFFF00" />
      <rect x="15" y="0" width="2" height="3" fill="#FFFACD" />

      {/* Sparks */}
      <rect x="6" y="8" width="2" height="2" fill="#FFD700" className="spark spark-1" />
      <rect x="24" y="6" width="2" height="2" fill="#FFA500" className="spark spark-2" />
      <rect x="4" y="14" width="2" height="2" fill="#FF6347" className="spark spark-3" />
    </svg>
  );
}

// Pixel Art Stone Arch Gate Icon (RPG style)
function GateIcon() {
  return (
    <svg className="pixel-icon gate" viewBox="0 0 32 32" width="72" height="72">
      {/* Sky visible through arch */}
      <rect x="8" y="4" width="16" height="12" fill="#87CEEB" />
      <rect x="10" y="2" width="12" height="4" fill="#87CEEB" />

      {/* Grass/ground visible through arch */}
      <rect x="8" y="16" width="16" height="12" fill="#4ADE80" />
      <rect x="8" y="16" width="16" height="2" fill="#22C55E" />

      {/* Path through gate */}
      <rect x="12" y="20" width="8" height="8" fill="#D4A574" />
      <rect x="14" y="22" width="4" height="6" fill="#E5C9A8" />

      {/* Stone arch - left pillar */}
      <rect x="2" y="8" width="6" height="22" fill="#6B7280" />
      <rect x="2" y="8" width="2" height="22" fill="#9CA3AF" />
      <rect x="6" y="8" width="2" height="22" fill="#4B5563" />

      {/* Stone arch - right pillar */}
      <rect x="24" y="8" width="6" height="22" fill="#6B7280" />
      <rect x="24" y="8" width="2" height="22" fill="#9CA3AF" />
      <rect x="28" y="8" width="2" height="22" fill="#4B5563" />

      {/* Arch top - curved stones */}
      <rect x="8" y="0" width="16" height="4" fill="#6B7280" />
      <rect x="8" y="0" width="16" height="2" fill="#9CA3AF" />
      <rect x="6" y="2" width="4" height="4" fill="#6B7280" />
      <rect x="22" y="2" width="4" height="4" fill="#6B7280" />
      <rect x="4" y="4" width="4" height="4" fill="#6B7280" />
      <rect x="24" y="4" width="4" height="4" fill="#6B7280" />

      {/* Arch keystone */}
      <rect x="14" y="0" width="4" height="3" fill="#9CA3AF" />
      <rect x="15" y="0" width="2" height="2" fill="#D1D5DB" />

      {/* Stone texture details */}
      <rect x="3" y="12" width="4" height="2" fill="#4B5563" />
      <rect x="3" y="18" width="4" height="2" fill="#4B5563" />
      <rect x="3" y="24" width="4" height="2" fill="#4B5563" />
      <rect x="25" y="14" width="4" height="2" fill="#4B5563" />
      <rect x="25" y="20" width="4" height="2" fill="#4B5563" />
      <rect x="25" y="26" width="4" height="2" fill="#4B5563" />

      {/* Ground base */}
      <rect x="0" y="28" width="32" height="4" fill="#78716C" />
      <rect x="0" y="28" width="32" height="2" fill="#A8A29E" />
    </svg>
  );
}

// Pixel Art Trophy Icon (scaled to match other icons height)
function TrophyIcon() {
  return (
    <svg className="pixel-icon trophy" viewBox="0 0 32 32" width="72" height="72">
      {/* Trophy cup - main body */}
      <rect x="8" y="2" width="16" height="14" fill="#FFD700" />
      <rect x="10" y="4" width="12" height="10" fill="#FFF8DC" />
      <rect x="8" y="2" width="2" height="14" fill="#DAA520" />
      <rect x="22" y="2" width="2" height="14" fill="#B8860B" />

      {/* Trophy cup - top rim */}
      <rect x="6" y="0" width="20" height="4" fill="#FFD700" />
      <rect x="6" y="0" width="20" height="2" fill="#FFF8DC" />

      {/* Left handle */}
      <rect x="2" y="2" width="6" height="2" fill="#FFD700" />
      <rect x="2" y="2" width="4" height="10" fill="#FFD700" />
      <rect x="2" y="10" width="6" height="2" fill="#FFD700" />
      <rect x="4" y="4" width="2" height="6" fill="#FFF8DC" />

      {/* Right handle */}
      <rect x="24" y="2" width="6" height="2" fill="#FFD700" />
      <rect x="26" y="2" width="4" height="10" fill="#FFD700" />
      <rect x="24" y="10" width="6" height="2" fill="#FFD700" />
      <rect x="26" y="4" width="2" height="6" fill="#B8860B" />

      {/* Stem */}
      <rect x="13" y="16" width="6" height="6" fill="#DAA520" />
      <rect x="13" y="16" width="3" height="6" fill="#FFD700" />

      {/* Base */}
      <rect x="10" y="22" width="12" height="2" fill="#DAA520" />
      <rect x="6" y="24" width="20" height="8" fill="#FFD700" />
      <rect x="6" y="24" width="20" height="2" fill="#FFF8DC" />
      <rect x="6" y="30" width="2" height="2" fill="#DAA520" />
      <rect x="24" y="30" width="2" height="2" fill="#B8860B" />

      {/* Star decoration on cup */}
      <rect x="14" y="6" width="4" height="4" fill="#FFD700" />
      <rect x="15" y="5" width="2" height="1" fill="#FFD700" />
      <rect x="15" y="10" width="2" height="1" fill="#FFD700" />
      <rect x="13" y="7" width="1" height="2" fill="#FFD700" />
      <rect x="18" y="7" width="1" height="2" fill="#FFD700" />

      {/* Shine effect */}
      <rect x="10" y="2" width="2" height="2" fill="#FFFACD" opacity="0.8" />
    </svg>
  );
}

export default FeatureMenu;
