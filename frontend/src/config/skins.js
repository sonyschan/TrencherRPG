/**
 * Skin Configuration for IdleTrencher
 * Defines available skins, level requirements, and metadata
 */

export const SKIN_CATEGORIES = {
  VILLAGER: 'villager',  // Basic skins, no restriction
  PREMIUM: 'premium',    // 1:1 allocation, level gated
};

export const SKINS = {
  // === Villager (Basic) Skins - Available from Lv 1, no 1:1 restriction ===
  villager: {
    id: 'villager',
    name: 'Villager',
    category: SKIN_CATEGORIES.VILLAGER,
    levelRequired: 1,
    exclusive: false,
    description: 'A humble villager ready for adventure',
    glbPrefix: 'Villager',
    icon: '/assets/skin-icon/villager.png',
  },
  villager2: {
    id: 'villager2',
    name: 'Villager (Alt)',
    category: SKIN_CATEGORIES.VILLAGER,
    levelRequired: 1,
    exclusive: false,
    description: 'Another hardworking villager',
    glbPrefix: 'Villager2',
    icon: '/assets/skin-icon/villager2.png',
  },
  villagerGirl: {
    id: 'villagerGirl',
    name: 'Village Girl',
    category: SKIN_CATEGORIES.VILLAGER,
    levelRequired: 1,
    exclusive: false,
    description: 'A cheerful village girl',
    glbPrefix: 'VillagerGirl',
    icon: '/assets/skin-icon/villagerGirl.png',
  },
  villagerGirl2: {
    id: 'villagerGirl2',
    name: 'Village Girl (Alt)',
    category: SKIN_CATEGORIES.VILLAGER,
    levelRequired: 1,
    exclusive: false,
    description: 'Another spirited village girl',
    glbPrefix: 'VillagerGirl2',
    icon: '/assets/skin-icon/villagerGirl2.png',
  },

  // === Premium Skins - 1:1 allocation, level gated ===
  adventurer: {
    id: 'adventurer',
    name: 'Adventurer',
    category: SKIN_CATEGORIES.PREMIUM,
    levelRequired: 3,
    exclusive: true,
    description: 'A seasoned adventurer seeking treasure',
    glbPrefix: 'Adventurer',
    icon: '/assets/skin-icon/Adventurer.png',
  },
  lady: {
    id: 'lady',
    name: 'Lady',
    category: SKIN_CATEGORIES.PREMIUM,
    levelRequired: 5,
    exclusive: true,
    description: 'A noble lady of refined taste',
    glbPrefix: 'Lady',
    icon: '/assets/skin-icon/Lady.png',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    category: SKIN_CATEGORIES.PREMIUM,
    levelRequired: 7,
    exclusive: true,
    description: 'A powerful mage wielding arcane magic',
    glbPrefix: 'Mage',
    icon: '/assets/skin-icon/Mage.png',
  },
  knight: {
    id: 'knight',
    name: 'Knight',
    category: SKIN_CATEGORIES.PREMIUM,
    levelRequired: 10,
    exclusive: true,
    description: 'A valiant knight in shining armor',
    glbPrefix: 'Knight',
    icon: '/assets/skin-icon/Knight.png',
  },
};

// Get all villager skins
export const getVillagerSkins = () => {
  return Object.values(SKINS).filter(s => s.category === SKIN_CATEGORIES.VILLAGER);
};

// Get all premium skins
export const getPremiumSkins = () => {
  return Object.values(SKINS).filter(s => s.category === SKIN_CATEGORIES.PREMIUM);
};

// Get all skins sorted by level requirement
export const getAllSkins = () => {
  return Object.values(SKINS).sort((a, b) => a.levelRequired - b.levelRequired);
};

// Check if a skin is available for a given level
export const isSkinAvailable = (skinId, level) => {
  const skin = SKINS[skinId];
  if (!skin) return false;
  return level >= skin.levelRequired;
};

// Get skin by ID
export const getSkinById = (skinId) => {
  return SKINS[skinId] || SKINS.villager;
};

// Default skin
export const DEFAULT_SKIN = 'villager';
