import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/',
  assetsInclude: ['**/*.skel'],
  server: {
    port: 5182,
  },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
  },
});
