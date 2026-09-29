import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js alone is ~540 kB minified; warn only if the bundle grows well past that.
    chunkSizeWarningLimit: 800,
  },
});
