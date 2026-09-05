/**
 * Pets & Beasts — inspired by https://121233.com/#/pets-beasts
 */

export const PETS_BEASTS_TYP = 'PETS_BEASTS';
export const PETS_BEASTS_LOTTERY = 'PETS_BEASTS_001';

/** @type {import('../lottery/engine.mjs').LotterySymbol[]} */
export const PETS_BEASTS_SYMBOLS = [
  { playCode: 'PETS_BEASTS_BEAR', label: 'Bear', emoji: '🐻', odd: 8 },
  { playCode: 'PETS_BEASTS_CAT', label: 'Cat', emoji: '🐱', odd: 8 },
  { playCode: 'PETS_BEASTS_DOG', label: 'Dog', emoji: '🐶', odd: 10 },
  { playCode: 'PETS_BEASTS_RABBIT', label: 'Rabbit', emoji: '🐰', odd: 10 },
  { playCode: 'PETS_BEASTS_EAGLE', label: 'Eagle', emoji: '🦅', odd: 15 },
  { playCode: 'PETS_BEASTS_LION', label: 'Lion', emoji: '🦁', odd: 20 },
  { playCode: 'PETS_BEASTS_TIGER', label: 'Tiger', emoji: '🐯', odd: 25 },
  { playCode: 'PETS_BEASTS_UNICORN', label: 'Unicorn', emoji: '🦄', odd: 40 },
  {
    playCode: 'PETS_BEASTS_PETS',
    label: 'Pets',
    emoji: '🐾',
    odd: 2,
    group: ['PETS_BEASTS_CAT', 'PETS_BEASTS_DOG', 'PETS_BEASTS_RABBIT'],
  },
  {
    playCode: 'PETS_BEASTS_BEASTS',
    label: 'Beasts',
    emoji: '🦁',
    odd: 2,
    group: [
      'PETS_BEASTS_BEAR',
      'PETS_BEASTS_EAGLE',
      'PETS_BEASTS_LION',
      'PETS_BEASTS_TIGER',
      'PETS_BEASTS_UNICORN',
    ],
  },
];

export const PETS_BEASTS_GAME = {
  id: 'pets-beasts',
  name: 'Pets & Beasts',
  typCode: PETS_BEASTS_TYP,
  lotteryCode: PETS_BEASTS_LOTTERY,
  bettingSeconds: 30,
  spinSeconds: 4,
  resultSeconds: 4,
  symbols: PETS_BEASTS_SYMBOLS,
};
