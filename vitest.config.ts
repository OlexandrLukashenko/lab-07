import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node', include: ['**/*.test.ts'], exclude: ['e2e/**', 'node_modules/**', 'dist/**'], coverage: { provider: 'v8', include: ['shared/**/*.ts'], thresholds: { lines: 85, statements: 85 } } } });
