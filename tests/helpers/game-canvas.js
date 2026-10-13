export async function greenResourcePixels(page) {
  return page.locator('.game-effects').evaluate(canvas => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] === 120 && data[i + 1] === 244 && data[i + 2] === 196) count++;
    return count;
  });
}

export async function forwardFanLanes(page) {
  return page.locator('.game-effects').evaluate(canvas => {
    const ship = document.querySelector('.game-ship').getBoundingClientRect();
    const cx = ship.x + 13.2, cy = ship.y + 16.5;
    const ratio = canvas.width / innerWidth;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const lanes = new Set();
    for (let y = Math.ceil((cy - 210) * ratio); y < (cy - 40) * ratio; y++) {
      for (let x = Math.ceil((cx - 24) * ratio); x < (cx + 24) * ratio; x++) {
        const i = (y * canvas.width + x) * 4;
        if (data[i] !== 201 || data[i + 1] !== 245 || data[i + 2] !== 250) continue;
        const dx = x / ratio - cx;
        if (dx < -4) lanes.add('left'); else if (dx > 4) lanes.add('right'); else if (Math.abs(dx) < 3) lanes.add('center');
      }
    }
    return [...lanes].sort();
  });
}

// Count rendered colors without exposing or mutating simulation state.
export async function canvasColorPixels(page, color) {
  return page.locator('.game-effects').evaluate((canvas, rgb) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === rgb[0] && pixels[i + 1] === rgb[1] && pixels[i + 2] === rgb[2]) count++;
    return count;
  }, color);
}

// Retain evidence from completed canvas frames before they are cleared. This
// observes real pixels, so a short-lived marker need not survive a later input.
export async function observeCanvasColors(page, colors) {
  await page.addInitScript(colors => {
    const expected = new Map(colors.map(rgb => ['#' + rgb.map(n => n.toString(16).padStart(2, '0')).join(''), rgb]));
    window.canvasColorHistory = {};
    const pending = new WeakMap();
    const { stroke, clearRect } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      const result = stroke.apply(this, args);
      if (this.canvas.classList.contains('game-effects') && expected.has(this.strokeStyle) && !window.canvasColorHistory[this.strokeStyle]) {
        if (!pending.has(this)) pending.set(this, new Set());
        pending.get(this).add(this.strokeStyle);
      }
      return result;
    };
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      const candidates = pending.get(this);
      if (candidates?.size) {
        const pixels = this.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
        for (const color of candidates) {
          const rgb = expected.get(color);
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] === rgb[0] && pixels[i + 1] === rgb[1] && pixels[i + 2] === rgb[2] && ++count > 10) {
              window.canvasColorHistory[color] = true;
              break;
            }
          }
        }
        candidates.clear();
      }
      return clearRect.apply(this, args);
    };
  }, colors);
}
