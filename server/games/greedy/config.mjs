/**
 * Greedy (BIGO_GREEDY) — food lottery inspired by https://121233.com/#/greedy
 */

export const GREEDY_TYP = 'BIGO_GREEDY';
export const GREEDY_LOTTERY = 'BIGO_GREEDY_001';

/** @type {import('../lottery/engine.mjs').LotterySymbol[]} */
export const GREEDY_SYMBOLS = [
  { playCode: 'BIGO_GREEDY_TOMATO', label: 'Tomato', emoji: '🍅', odd: 5 },
  { playCode: 'BIGO_GREEDY_CABBAGE', label: 'Cabbage', emoji: '🥬', odd: 5 },
  { playCode: 'BIGO_GREEDY_CORN', label: 'Corn', emoji: '🌽', odd: 8 },
  { playCode: 'BIGO_GREEDY_CARROTS', label: 'Carrots', emoji: '🥕', odd: 8 },
  { playCode: 'BIGO_GREEDY_SALAD', label: 'Salad', emoji: '🥗', odd: 10 },
  { playCode: 'BIGO_GREEDY_BEEF', label: 'Beef', emoji: '🥩', odd: 15 },
  { playCode: 'BIGO_GREEDY_CHICKEN_LEGS', label: 'Chicken', emoji: '🍗', odd: 15 },
  { playCode: 'BIGO_GREEDY_KEBABS', label: 'Kebabs', emoji: '🍢', odd: 20 },
  { playCode: 'BIGO_GREEDY_HOT_DOGS', label: 'Hot Dogs', emoji: '🌭', odd: 25 },
  { playCode: 'BIGO_GREEDY_PIZZA', label: 'Pizza', emoji: '🍕', odd: 30 },
  {
    playCode: 'BIGO_GREEDY_VEGETABLE_BASKET',
    label: 'Veg Basket',
    emoji: '🧺',
    odd: 2,
    group: [
      'BIGO_GREEDY_TOMATO',
      'BIGO_GREEDY_CABBAGE',
      'BIGO_GREEDY_CORN',
      'BIGO_GREEDY_CARROTS',
      'BIGO_GREEDY_SALAD',
    ],
  },
  {
    playCode: 'BIGO_GREEDY_MEAT_PLATES',
    label: 'Meat Plates',
    emoji: '🍽️',
    odd: 2,
    group: [
      'BIGO_GREEDY_BEEF',
      'BIGO_GREEDY_CHICKEN_LEGS',
      'BIGO_GREEDY_KEBABS',
      'BIGO_GREEDY_HOT_DOGS',
      'BIGO_GREEDY_PIZZA',
    ],
  },
];

export const GREEDY_GAME = {
  id: 'greedy',
  name: 'Greedy (Food Wheel)',
  typCode: GREEDY_TYP,
  lotteryCode: GREEDY_LOTTERY,
  bettingSeconds: 30,
  spinSeconds: 4,
  resultSeconds: 4,
  symbols: GREEDY_SYMBOLS,
};

export const GREEDY_API = {
  periodList: { method: 'POST', path: '/uapi/v2/period_list' },
  oddList: { method: 'POST', path: '/bigo/v1/odd_list', body: ['TypCode', 'LotteryCode'] },
  betState: { method: 'POST', path: '/bigo/v1/bet_state' },
  bet: { method: 'POST', path: '/bigo/v1/bet' },
};
