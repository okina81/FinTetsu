import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // ストア・経路探索は純粋ロジックなので Node 環境で十分（Phaser 非依存）。
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
