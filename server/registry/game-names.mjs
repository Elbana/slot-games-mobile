/**
 * Public slugs + display names — close to familiar titles, unique to our platform.
 */

export const SLOT_SLUG = 'olympus-rise';
export const SLOT_NAME = 'Olympus Rise';

/** @type {Record<string, { name: string, tagline: string, badge: string, theme: string, icon: string }>} */
export const GAME_DISPLAY = {
  [SLOT_SLUG]: {
    name: SLOT_NAME,
    tagline: 'Cluster pays, god multipliers & free spins',
    badge: 'Video Slot',
    theme: 'olympus',
    icon: '⚡',
  },
  'greedy-feast': {
    name: 'Greedy Feast',
    tagline: 'Bet on the food wheel — 30s live rounds',
    badge: 'Lottery',
    theme: 'greedy',
    icon: '🍕',
  },
  'luck-77': {
    name: 'Luck 77',
    tagline: 'Bet Lemon, Watermelon or Luck 77 — live wheel',
    badge: 'Wheel',
    theme: 'lucky77',
    icon: '🎡',
  },
  'dice-duel': {
    name: 'Dice Duel',
    tagline: 'Red vs blue — roll 3 dice, pick the winning team',
    badge: 'Dice',
    theme: 'dice-dual',
    icon: '🎲',
  },
  'goal-clash': {
    name: 'Goal Clash',
    tagline: 'Bet home, draw, or away on live match rounds',
    badge: 'Sports',
    theme: 'football-clash',
    icon: '⚽',
  },
  'rocket-rush': {
    name: 'Rocket Rush',
    tagline: 'Ride the rocket — cash out before it crashes',
    badge: 'Crash',
    theme: 'rocket',
    icon: '🚀',
  },
};
