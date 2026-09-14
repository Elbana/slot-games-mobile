/**
 * Canonical display names and slugs — original branding (no third-party trademarks).
 */

export const SLOT_SLUG = 'throne-rush';
export const SLOT_NAME = 'Throne Rush';

/** @type {Record<string, { name: string, tagline: string, badge: string, theme: string, icon: string }>} */
export const GAME_DISPLAY = {
  [SLOT_SLUG]: {
    name: SLOT_NAME,
    tagline: 'Divine cascades, rising multipliers & free spins',
    badge: 'Video Slot',
    theme: 'throne-rush',
    icon: '⚡',
  },
  'feast-spin': {
    name: 'Feast Spin',
    tagline: 'Bet on the feast wheel — live 30s rounds',
    badge: 'Lottery',
    theme: 'feast-spin',
    icon: '🍕',
  },
  'triple-harvest': {
    name: 'Triple Harvest',
    tagline: 'Pick lemon, watermelon, or golden trio on the live wheel',
    badge: 'Wheel',
    theme: 'triple-harvest',
    icon: '🎡',
  },
  'dice-arena': {
    name: 'Dice Arena',
    tagline: 'Red vs blue — roll the dice, pick your champion',
    badge: 'Dice',
    theme: 'dice-arena',
    icon: '🎲',
  },
  'goal-showdown': {
    name: 'Goal Showdown',
    tagline: 'Predict home, draw, or away in live match rounds',
    badge: 'Sports',
    theme: 'goal-showdown',
    icon: '⚽',
  },
  'sky-streak': {
    name: 'Sky Streak',
    tagline: 'Ride the streak — cash out before the fall',
    badge: 'Crash',
    theme: 'sky-streak',
    icon: '🚀',
  },
};
