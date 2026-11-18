import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Nest 데코레이터 메타데이터가 필요하므로 테스트 코드는 SWC 로 변환함
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/unit/**/*.{spec,test}.ts'],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      include: ['src/**/*.{ts,js}'],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
      reportsDirectory: './coverage',
    },
  },
});
