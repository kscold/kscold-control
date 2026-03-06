import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-xterm': ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-unicode11'],
          'vendor-reactflow': ['@xyflow/react'],
          'vendor-socket': ['socket.io-client'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
});
