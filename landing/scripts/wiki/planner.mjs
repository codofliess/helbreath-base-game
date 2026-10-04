/**
 * Stat planner math. Mirrors multiplayer/server/Helpers/Progression.cs
 * (GetLuPoints, CalcMaxHp, CalcMaxMp, CalcMaxSp, MaxStat) and the
 * base stat of 10 on GameWorldPlayer. Gear and angelic bonuses are omitted.
 */

export const BASE_STAT = 10;
export const MAX_STAT = 200;
export const STAT_KEYS = ['str', 'vit', 'dex', 'int', 'mag', 'chr'];

export function pointBudget(level, rebirth, rebirthLuPoints) {
  const baseSum = BASE_STAT * 6;
  const rebirthLu = Math.max(0, rebirthLuPoints) * Math.max(0, rebirth);
  return Math.max(0, level * 3 - (baseSum - 70) - 3 + rebirthLu);
}

export function luPoints(level, rebirth, stats, rebirthLuPoints) {
  const sum = STAT_KEYS.reduce((total, key) => total + stats[key], 0);
  const rebirthLu = Math.max(0, rebirthLuPoints) * Math.max(0, rebirth);
  return Math.max(0, level * 3 - (sum - 70) - 3 + rebirthLu);
}

export function maxHp(vit, level, str) {
  return vit * 3 + level * 2 + Math.floor(str / 2);
}

export function maxMp(mag, level, intel) {
  return 2 * mag + 2 * level + Math.floor(intel / 2);
}

export function maxSp(level, str) {
  return 2 * str + 2 * level;
}

function configError(config) {
  if (!config || !Number.isInteger(config.maxLevel) || config.maxLevel < 1) {
    return 'Planner config is missing maxLevel.';
  }
  if (!Number.isInteger(config.maxRebirth) || config.maxRebirth < 0) {
    return 'Planner config is missing maxRebirth.';
  }
  if (!Number.isInteger(config.rebirthLuPoints) || config.rebirthLuPoints < 0) {
    return 'Planner config is missing rebirthLuPoints.';
  }
  return null;
}

/** @returns {{ ok: boolean, error: string | null, points?: number, hp?: number, mp?: number, sp?: number }} */
export function evaluate(config, input) {
  const broken = configError(config);
  if (broken) {
    return { ok: false, error: broken };
  }
  const level = input.level;
  const rebirth = input.rebirth;
  if (!Number.isInteger(level) || level < 1 || level > config.maxLevel) {
    return { ok: false, error: `Level must be a whole number from 1 to ${config.maxLevel}.` };
  }
  if (!Number.isInteger(rebirth) || rebirth < 0 || rebirth > config.maxRebirth) {
    return { ok: false, error: `Rebirth must be a whole number from 0 to ${config.maxRebirth}.` };
  }
  const stats = {};
  for (const key of STAT_KEYS) {
    const value = input[key];
    if (!Number.isInteger(value)) {
      return { ok: false, error: 'Enter a whole number for every stat.' };
    }
    if (value < BASE_STAT) {
      return { ok: false, error: `Cannot reduce a stat below ${BASE_STAT}.` };
    }
    if (value > MAX_STAT) {
      return { ok: false, error: `Stat cannot exceed ${MAX_STAT}.` };
    }
    stats[key] = value;
  }
  const sum = STAT_KEYS.reduce((total, key) => total + stats[key], 0);
  const spent = sum - BASE_STAT * 6;
  const budget = pointBudget(level, rebirth, config.rebirthLuPoints);
  if (spent > budget) {
    return { ok: false, error: 'Not enough level-up points.' };
  }
  return {
    ok: true,
    error: null,
    points: luPoints(level, rebirth, stats, config.rebirthLuPoints),
    hp: maxHp(stats.vit, level, stats.str),
    mp: maxMp(stats.mag, level, stats.int),
    sp: maxSp(level, stats.str),
  };
}
