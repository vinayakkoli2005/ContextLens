import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import fs from 'node:fs';
import path from 'node:path';

const copyExtensionAssets = () => ({
  name: 'copy-extension-assets',
  closeBundle() {
    const sourceStyles = path.resolve(__dirname, 'src/content/styles.css');
    const targetStyles = path.resolve(__dirname, 'dist/src/content/styles.css');

    fs.mkdirSync(path.dirname(targetStyles), { recursive: true });
    fs.copyFileSync(sourceStyles, targetStyles);
  },
});

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyExtensionAssets(),
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
