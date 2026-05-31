import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync } from 'node:fs';

export default defineConfig({
  plugins: [
    {
      name: 'copy-market-json',
      closeBundle() {
        mkdirSync('dist/data', { recursive: true });
        copyFileSync('data/market.json', 'dist/data/market.json');
      },
    },
  ],
});
