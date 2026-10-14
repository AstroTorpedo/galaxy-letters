import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: ['index.html', 'explore.html', 'legacy.html'], output: { manualChunks: (id) => id.includes('node_modules/phaser') ? 'phaser' : undefined } },
  },
});
