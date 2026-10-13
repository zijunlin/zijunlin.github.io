import { canvasColorPixels } from './game-canvas.js';

// Playwright's assertion polling cannot advance a paused game clock. Drive that
// public clock in bounded steps, observing the DOM/canvas after every step.
export async function advanceUntil(page, observe, { description, timeout = 8000, step = 100 } = {}) {
  if (!(timeout >= 0) || !(step > 0)) throw new Error('Scenario timeout must be nonnegative and step positive');
  let elapsed = 0;
  while (true) {
    if (await observe()) return elapsed;
    if (elapsed >= timeout) throw new Error(`Timed out after ${elapsed} game ms waiting for ${description || 'scenario condition'}`);
    const amount = Math.min(step, timeout - elapsed);
    await page.clock.runFor(amount);
    elapsed += amount;
  }
}

export function waitForCanvasColor(page, color, options = {}) {
  return advanceUntil(page, async () => await canvasColorPixels(page, color) > 10,
    { description: `canvas color ${color.join(',')}`, ...options });
}

export async function moveUntilFeedback(page, key, feedback, options = {}) {
  await page.keyboard.down(key);
  try {
    return await advanceUntil(page, async () => (await page.locator('.game-pickup').textContent()).includes(feedback),
      { description: `pickup feedback ${feedback}`, ...options });
  } finally { await page.keyboard.up(key); }
}
