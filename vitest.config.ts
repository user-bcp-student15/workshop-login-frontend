import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/app/login/login.component.ts',
        'src/app/dashboard/dashboard.component.ts',
        'src/app/services/**/*.ts',
        'src/app/utils/**/*.ts',
        'src/environments/**/*.ts'
      ],
      thresholds: {
        perFile: true,
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85
      }
    }
  }
});
