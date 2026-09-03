import { Application, Graphics, Text } from 'pixi.js';
import './style.css';

const app = new Application();
const root = document.querySelector('#app');

async function bootstrap() {
  await app.init({
    background: '#080b18',
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    resizeTo: root,
  });

  root.appendChild(app.canvas);

  const stage = new Graphics();
  stage.roundRect(24, 24, 320, 480, 18).fill({ color: 0x131a35 });
  app.stage.addChild(stage);

  const title = new Text({
    text: 'Visual prototype',
    style: { fill: 0xf4d27a, fontFamily: 'Georgia, serif', fontSize: 24 },
  });
  title.position.set(52, 58);
  app.stage.addChild(title);

  const centerStage = () => {
    stage.x = Math.max(0, (app.screen.width - 368) / 2);
  };

  window.addEventListener('resize', centerStage);
  centerStage();
}

bootstrap();
