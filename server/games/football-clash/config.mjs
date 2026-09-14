/** Football Clash — bet home, away, or draw. */

const API_LOGO = (teamId) => `https://media.api-sports.io/football/teams/${teamId}.png`;

export const FOOTBALL_TEAMS = [
  { id: 'mancity', name: 'Man City', shortName: 'MCI', color: '#6CABDD', emoji: '🔵', rating: 92, logo: API_LOGO(50) },
  { id: 'liverpool', name: 'Liverpool', shortName: 'LIV', color: '#E31B23', emoji: '🔴', rating: 91, logo: API_LOGO(40) },
  { id: 'arsenal', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', emoji: '🔫', rating: 88, logo: API_LOGO(42) },
  { id: 'chelsea', name: 'Chelsea', shortName: 'CHE', color: '#034694', emoji: '🦁', rating: 87, logo: API_LOGO(49) },
  { id: 'manutd', name: 'Man United', shortName: 'MUN', color: '#DA291C', emoji: '👹', rating: 85, logo: API_LOGO(33) },
  { id: 'barcelona', name: 'Barcelona', shortName: 'BAR', color: '#A50044', emoji: '🔵', rating: 89, logo: API_LOGO(529) },
  { id: 'realmadrid', name: 'Real Madrid', shortName: 'RMA', color: '#FBBE23', emoji: '👑', rating: 91, logo: API_LOGO(541) },
  { id: 'bayern', name: 'Bayern', shortName: 'BAY', color: '#DC052D', emoji: '⭐', rating: 90, logo: API_LOGO(157) },
  { id: 'psg', name: 'PSG', shortName: 'PSG', color: '#004170', emoji: '🗼', rating: 87, logo: API_LOGO(85) },
  { id: 'juventus', name: 'Juventus', shortName: 'JUV', color: '#000000', emoji: '⚪', rating: 87, logo: API_LOGO(496) },
  { id: 'alhilal', name: 'Al Hilal', shortName: 'HIL', color: '#0058A3', emoji: '💙', rating: 88, logo: API_LOGO(2939) },
  { id: 'alnassr', name: 'Al Nassr', shortName: 'NSR', color: '#FEDC00', emoji: '💛', rating: 87, logo: API_LOGO(2932) },
  { id: 'alahly', name: 'Al Ahly', shortName: 'AHL', color: '#C8102E', emoji: '🔴', rating: 89, logo: API_LOGO(1577) },
  { id: 'zamalek', name: 'Zamalek', shortName: 'ZAM', color: '#009639', emoji: '🦅', rating: 85, logo: API_LOGO(1578) },
  { id: 'alittihad', name: 'Al Ittihad', shortName: 'ITH', color: '#FFD700', emoji: '⚫', rating: 86, logo: API_LOGO(2938) },
  { id: 'alain', name: 'Al Ain', shortName: 'AIN', color: '#6B0018', emoji: '🐎', rating: 84, logo: API_LOGO(2875) },
  { id: 'raja', name: 'Raja CA', shortName: 'RAJ', color: '#009E60', emoji: '🟢', rating: 83, logo: API_LOGO(968) },
  { id: 'sadd', name: 'Al Sadd', shortName: 'SAD', color: '#8A1538', emoji: '🟣', rating: 84, logo: API_LOGO(2913) },
];

export const FOOTBALL_CLASH_GAME = {
  id: 'goal-clash',
  name: 'Goal Clash',
  bettingSeconds: 15,
  matchSeconds: 10,
  resultSeconds: 3,
  winMultiplier: 2.05,
  drawMultiplier: 3.2,
  homeWinProbability: 0.42,
  awayWinProbability: 0.38,
  drawProbability: 0.20,
  teams: FOOTBALL_TEAMS,
};
