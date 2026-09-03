/**
 * Football Gold — code-only stadium FX (floodlights, pitch shimmer).
 */

import { Container, Graphics } from 'pixi.js';

/**
 * @param {{ width: number, height: number, ticker: import('pixi.js').Ticker }} opts
 */
export function createStadiumEffects(opts) {
  const { width, height, ticker } = opts;
  const root = new Container();

  const lights = new Graphics();
  root.addChild(lights);

  const shimmer = new Graphics();
  shimmer.alpha = 0.08;
  root.addChild(shimmer);

  let t = 0;
  const tick = () => {
    t += 0.02;
    lights.clear();
    const pulse = 0.55 + Math.sin(t) * 0.15;
    lights.circle(-width * 0.42, -height * 0.35, 90);
    lights.fill({ color: 0xfff176, alpha: pulse * 0.18 });
    lights.circle(width * 0.42, -height * 0.35, 90);
    lights.fill({ color: 0xfff176, alpha: pulse * 0.18 });

    shimmer.clear();
    shimmer.rect(-width / 2, height * 0.15, width, height * 0.35);
    shimmer.fill({ color: 0x69f0ae, alpha: 0.15 + Math.sin(t * 1.4) * 0.05 });
  };
  ticker.add(tick);
  tick();

  return {
    view: root,
    destroy() {
      ticker.remove(tick);
      root.destroy({ children: true });
    },
  };
}
