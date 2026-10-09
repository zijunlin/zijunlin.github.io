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
