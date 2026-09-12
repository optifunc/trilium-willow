import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    lib: { entry: 'src/spike.ts', formats: ['es'], fileName: () => 'willow-spike.js' },
    rollupOptions: { external: ['trilium:preact'] },
    minify: false,
  },
});
