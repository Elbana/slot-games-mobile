/**
 * Registered games available on the platform.
 */

import { GREEDY_GAME } from '../games/greedy/config.mjs';
import { PETS_BEASTS_GAME } from '../games/pets-beasts/config.mjs';

/** @typedef {'slot' | 'lottery'} GameType */

/** @typedef {object} GameDefinition
 * @property {string} slug
 * @property {string} name
 * @property {GameType} type
 * @property {string} playPath
 * @property {string} [typCode]
 * @property {string} [lotteryCode]
 */

/** @type {GameDefinition[]} */
export const GAMES = [
  {
    slug: 'rise-of-olympus',
    name: 'Rise of Olympus',
    type: 'slot',
    playPath: '/play/rise-of-olympus',
  },
  {
    slug: GREEDY_GAME.id,
    name: GREEDY_GAME.name,
    type: 'lottery',
    playPath: `/play/${GREEDY_GAME.id}`,
    typCode: GREEDY_GAME.typCode,
    lotteryCode: GREEDY_GAME.lotteryCode,
  },
  {
    slug: PETS_BEASTS_GAME.id,
    name: PETS_BEASTS_GAME.name,
    type: 'lottery',
    playPath: `/play/${PETS_BEASTS_GAME.id}`,
    typCode: PETS_BEASTS_GAME.typCode,
    lotteryCode: PETS_BEASTS_GAME.lotteryCode,
  },
];

/** @type {Map<string, GameDefinition>} */
const bySlug = new Map(GAMES.map((g) => [g.slug, g]));

/** @type {Map<string, GameDefinition>} */
const byTypCode = new Map(GAMES.filter((g) => g.typCode).map((g) => [g.typCode, g]));

export function getGame(slug) {
  return bySlug.get(slug) ?? null;
}

export function getGameByTypCode(typCode) {
  return byTypCode.get(typCode) ?? null;
}

export function listGames() {
  return GAMES;
}

export function catalogEntry(game) {
  return {
    slug: game.slug,
    name: game.name,
    type: game.type,
    playUrl: game.playPath,
  };
}
