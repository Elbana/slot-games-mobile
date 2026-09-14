import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'games/football-clash/assets/flags');
fs.mkdirSync(root, { recursive: true });

const teams = [
  ['mancity', '#6CABDD', '#ffffff'], ['liverpool', '#E31B23', '#ffffff'], ['arsenal', '#EF0107', '#ffffff'],
  ['chelsea', '#034694', '#ffffff'], ['manutd', '#DA291C', '#fde047'], ['barcelona', '#A50044', '#004D98'],
  ['realmadrid', '#FBBE23', '#ffffff'], ['bayern', '#DC052D', '#0066B2'], ['psg', '#004170', '#DA291C'],
  ['juventus', '#111111', '#ffffff'], ['alhilal', '#0058A3', '#ffffff'], ['alnassr', '#FEDC00', '#0058A3'],
  ['alahly', '#C8102E', '#FEDD00'], ['zamalek', '#FFFFFF', '#009639'], ['alittihad', '#FFD700', '#111111'],
  ['alain', '#6B0018', '#ffffff'], ['raja', '#009E60', '#ffffff'], ['sadd', '#8A1538', '#ffffff'],
];

const tpl = (c, a) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="8" y="6" width="2.5" height="22" rx="1" fill="#94a3b8"/><path d="M10.5 8h14c1.5 0 2.5 1.2 2.2 2.5l-1.2 6c-.3 1.3-1.8 2.5-3.3 2.5h-11.7V8z" fill="${c}"/><path d="M10.5 8h14c1.5 0 2.5 1.2 2.2 2.5l-.8 4.5H10.5V8z" fill="${a}" opacity="0.5"/></svg>`;

for (const [id, c, a] of teams) {
  fs.writeFileSync(path.join(root, `${id}.svg`), tpl(c, a));
}

fs.copyFileSync(
  path.join(process.cwd(), 'games/dice-dual/assets/flag-draw.svg'),
  path.join(process.cwd(), 'games/football-clash/assets/flag-draw.svg'),
);

console.log(`Generated ${teams.length} flags`);
