import { defineConfig } from 'vite';
import deezer from './api/deezer.js';
import credits from './api/credits.js';
import pool from './api/pool.js';

// Lets `npm run dev` serve the same /api routes Vercel runs in production.
const apiRoutes = { '/api/deezer': deezer, '/api/credits': credits, '/api/pool': pool };

export default defineConfig({
  plugins: [
    {
      name: 'local-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const route = Object.keys(apiRoutes).find((p) => req.url.startsWith(p));
          if (!route) return next();
          apiRoutes[route](req, res);
        });
      },
    },
  ],
});
