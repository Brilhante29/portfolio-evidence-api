import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    env: { LOG_LEVEL: 'silent' },
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/modules/evidence/application/**/*.ts',
        'src/modules/evidence/infrastructure/http/**/*.ts',
        'src/modules/evidence/infrastructure/persistence/**/*.ts',
        'src/modules/evidence/infrastructure/validation/**/*.ts',
        'src/modules/evidence/infrastructure/graphql/depth-limit.rule.ts',
      ],
      exclude: ['src/modules/evidence/application/ports/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
