import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
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
    proxy: {
      // Proxy LavinMQ HTTP API requests to avoid CORS
      '/api': {
        target: `http://${process.env.VITE_AMQP_HOST || 'localhost'}:${process.env.VITE_AMQP_PORT || '15672'}`,
        changeOrigin: true,
        secure: false,
      },
    },
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
