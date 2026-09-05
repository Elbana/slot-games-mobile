import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/play/rise-of-olympus/',
  assetsInclude: ['**/*.skel'],
  server: {
    port: 5180,
  },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
  },
});
