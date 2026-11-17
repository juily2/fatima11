import { defineConfig } from 'vite';
export default defineConfig({ base: '/wind-island/', build: { target: 'es2022', rollupOptions: { output: { manualChunks: { three: ['three'] } } } } });
