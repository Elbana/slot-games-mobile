/** Football Clash — bet home, away, or draw. */

export const FOOTBALL_TEAMS = [
  { id: 'mancity', name: 'Man City', shortName: 'MCI', color: '#6CABDD', emoji: '🔵', rating: 92 },
  { id: 'liverpool', name: 'Liverpool', shortName: 'LIV', color: '#E31B23', emoji: '🔴', rating: 91 },
  { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', emoji: '🔫', rating: 88 },
  { id: 'chelsea', name: 'Chelsea', shortName: 'CHE', color: '#034694', emoji: '🦁', rating: 87 },
  { id: 'manutd', name: 'Man United', shortName: 'MUN', color: '#DA291C', emoji: '👹', rating: 85 },
  { id: 'barcelona', name: 'Barcelona', shortName: 'BAR', color: '#A50044', emoji: '🔵', rating: 89 },
  { id: 'realmadrid', name: 'Real Madrid', shortName: 'RMA', color: '#FBBE23', emoji: '👑', rating: 91 },
  { id: 'bayern', name: 'Bayern', shortName: 'BAY', color: '#DC052D', emoji: '⭐', rating: 90 },
  { id: 'psg', name: 'PSG', shortName: 'PSG', color: '#004170', emoji: '🗼', rating: 87 },
  { id: 'juventus', name: 'Juventus', shortName: 'JUV', color: '#000000', emoji: '⚪', rating: 87 },
];

export const FOOTBALL_CLASH_GAME = {
  id: 'football-clash',
  name: 'Football Clash',
  bettingSeconds: 15,
  matchSeconds: 10,
  resultSeconds: 3,
  winMultiplier: 1.92,
  drawMultiplier: 3.5,
  homeWinProbability: 0.42,
  awayWinProbability: 0.38,
  drawProbability: 0.20,
  chipPresets: [5000, 25000, 50000, 250000],
  defaultChip: 5000,
  teams: FOOTBALL_TEAMS,
};
