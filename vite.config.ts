import { defineConfig } from 'vite';

export default defineConfig({
  // The desktop copy's dev server uses 5173; this one runs alongside it.
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  build: {
    // three.js alone is ~540 kB minified; warn only if the bundle grows well past that.
    chunkSizeWarningLimit: 800,
  },
});
