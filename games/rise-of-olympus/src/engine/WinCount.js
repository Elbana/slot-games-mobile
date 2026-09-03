/**
 * Smooth win value tick for HUD display.
 */

/**
 * @param {number} from
 * @param {number} to
 * @param {number} durationMs
 * @param {(value: number) => void} onFrame
 */
export function animateWinCount(from, to, durationMs, onFrame) {
  if (to <= from) {
    onFrame(to);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      onFrame(Math.round(from + (to - from) * eased));
      if (t >= 1) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
