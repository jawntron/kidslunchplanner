import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/kidslunchplanner/ in production,
// from / during local dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/kidslunchplanner/' : '/',
  plugins: [react()],
}));
