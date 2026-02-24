import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium'; 

export default defineConfig({
  base: '/worldview-client/',
  plugins: [react(), cesium()],
  server: {
    proxy: {
      '/api/opensky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensky/, '/api/states/all'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Forward auth header if present
            const auth = proxyReq.getHeader('authorization');
            if (auth) proxyReq.setHeader('Authorization', auth);
          });
        }
      }
    }
  }
});