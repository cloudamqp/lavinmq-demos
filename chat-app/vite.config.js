import { defineConfig } from 'vite';

export default defineConfig({
  root: './src',
  publicDir: '../public',
  envDir: '../', // Look for .env files in the project root
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    open: true,
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    }
  },
  define: {
    'global': 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
});
