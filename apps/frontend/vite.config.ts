import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget =
  process.env.VITE_PROXY_API_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiProxyTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'vendor-xterm',
              test: /[\\/]node_modules[\\/]@xterm[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-reactflow',
              test: /[\\/]node_modules[\\/]@xyflow[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-socket',
              test: /[\\/]node_modules[\\/]socket.io-client[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-markdown',
              test: /[\\/]node_modules[\\/](react-markdown|remark-gfm)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
