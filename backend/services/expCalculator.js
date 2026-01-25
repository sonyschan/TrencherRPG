/**
 * Experience & Level Calculator
 * Calculates EXP based on holding days and Level based on EXP
 */

/**
 * Level formula: Level = min(60, floor(sqrt(Exp * 10)))
 *
 * Level milestones:
 * - Lv10: 10 days
 * - Lv20: 40 days
 * - Lv30: 90 days (~3 months)
 * - Lv40: 160 days (~5 months)
 * - Lv50: 250 days (~8 months)
 * - Lv60: 360 days (~1 year) - MAX
 */

const MAX_LEVEL = 60;

/**
 * Calculate level from experience points
 * @param {number} exp - Experience points (= days held in top 10)
 * @returns {number} Level (1-60)
 */
export function calculateLevel(exp) {
  if (exp <= 0) return 1;
  const level = Math.floor(Math.sqrt(exp * 10));
  return Math.min(MAX_LEVEL, Math.max(1, level));
}

/**
 * Calculate days required to reach a specific level
 * @param {number} level - Target level (1-60)
 * @returns {number} Days required
 */
export function daysRequiredForLevel(level) {
  if (level <= 1) return 0;
  return Math.ceil((level * level) / 10);
}

/**
 * Get level progress info with optional hourly granularity
 * @param {number} exp - Current experience (integer days)
 * @param {string|null} lastExpUpdate - ISO timestamp of last EXP increment
 * @returns {object} Level info with progress
 */
export function getLevelInfo(exp, lastExpUpdate = null) {
  const currentLevel = calculateLevel(exp);
  const nextLevel = Math.min(MAX_LEVEL, currentLevel + 1);

  const currentLevelExp = daysRequiredForLevel(currentLevel);
  const nextLevelExp = daysRequiredForLevel(nextLevel);

  // Calculate fractional day progress based on hours elapsed since last EXP update
  let fractionalDay = 0;
  if (lastExpUpdate) {
    const lastUpdate = new Date(lastExpUpdate);
    const now = new Date();
    const hoursElapsed = (now - lastUpdate) / (1000 * 60 * 60);
    // Cap at 1 day (24 hours) - the daily job should increment before this
    fractionalDay = Math.min(hoursElapsed / 24, 1);
  }

  // Effective EXP includes fractional progress toward next day
  const effectiveExp = exp + fractionalDay;
  const expInCurrentLevel = effectiveExp - currentLevelExp;
  const expNeededForNext = nextLevelExp - currentLevelExp;

  const progress = currentLevel >= MAX_LEVEL
    ? 100
    : Math.min(100, Math.round((expInCurrentLevel / expNeededForNext) * 100));

  return {
    level: currentLevel,
    exp: exp,
    nextLevel: nextLevel,
    expForNextLevel: nextLevelExp,
    progress: progress,
    isMaxLevel: currentLevel >= MAX_LEVEL,
    title: getLevelTitle(currentLevel)
  };
}

/**
 * Get title based on level
 * @param {number} level
 * @returns {string}
 */
export function getLevelTitle(level) {
  if (level >= 60) return 'Legendary Partner';
  if (level >= 50) return 'Elite Partner';
  if (level >= 40) return 'Veteran Partner';
  if (level >= 30) return 'Senior Partner';
  if (level >= 20) return 'Intermediate Partner';
  if (level >= 10) return 'Junior Partner';
  return 'Novice Partner';
}

/**
 * Calculate EXP gain for daily update
 * Returns 1 if token is still in top 10, 0 otherwise
 * @param {boolean} isInTop10 - Whether token is in top 10
 * @returns {number} EXP to add
 */
export function calculateDailyExpGain(isInTop10) {
  return isInTop10 ? 1 : 0;
}
