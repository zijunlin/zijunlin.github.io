import { fileURLToPath } from 'node:url';

// Emit the game as a separate entry with an explicit URL, never an eager import.
export function gameEntry() {
  let command;
  return {
    name: 'space-game-entry',
    configResolved(config) { command = config.command; },
    resolveId(id) { if (id === 'virtual:space-game-url') return '\0space-game-url'; },
    load(id) {
      if (id !== '\0space-game-url') return;
      if (command === 'serve') return 'export default "/work-games/space-game.js"';
      const reference = this.emitFile({ type: 'chunk', preserveSignature: 'strict', id: fileURLToPath(new URL('./space-game.js', import.meta.url)), name: 'space-game' });
      return `export default import.meta.ROLLUP_FILE_URL_${reference}`;
    },
  };
}
