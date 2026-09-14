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
  { id: 'alhilal', name: 'Al Hilal', shortName: 'HIL', color: '#0058A3', emoji: '💙', rating: 88 },
  { id: 'alnassr', name: 'Al Nassr', shortName: 'NSR', color: '#FEDC00', emoji: '💛', rating: 87 },
  { id: 'alahly', name: 'Al Ahly', shortName: 'AHL', color: '#C8102E', emoji: '🔴', rating: 89 },
  { id: 'zamalek', name: 'Zamalek', shortName: 'ZAM', color: '#009639', emoji: '🦅', rating: 85 },
  { id: 'alittihad', name: 'Al Ittihad', shortName: 'ITH', color: '#FFD700', emoji: '⚫', rating: 86 },
  { id: 'alain', name: 'Al Ain', shortName: 'AIN', color: '#6B0018', emoji: '🐎', rating: 84 },
  { id: 'raja', name: 'Raja CA', shortName: 'RAJ', color: '#009E60', emoji: '🟢', rating: 83 },
  { id: 'sadd', name: 'Al Sadd', shortName: 'SAD', color: '#8A1538', emoji: '🟣', rating: 84 },
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
  teams: FOOTBALL_TEAMS,
};
