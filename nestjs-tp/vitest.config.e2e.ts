import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Base temporal y variables de entorno propias de cada archivo e2e (RNF-4).
    setupFiles: ['./test/setup-e2e.ts'],
  },
});
