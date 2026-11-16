import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`.
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Gate de cobertura de `pnpm test:cov` (spec 005, RF-1 y RF-2).
    coverage: {
      provider: 'v8',
      // Todo `src/`, también lo que ningún test importa (cuenta con 0%). Sin
      // esto Vitest solo mide los archivos que algún test carga.
      include: ['src/**/*.ts'],
      // Los tests no son código a cubrir. Se excluyen explícitamente: la
      // exclusión automática de Vitest depende de la configuración que corre.
      exclude: ['src/**/*.spec.ts'],
      // Umbral declarado en specs/005-calidad/spec.md (RF-1): si baja, el
      // proceso termina con error aunque todos los tests pasen.
      thresholds: { lines: 75, branches: 75 },
      // `json-summary` deja coverage/coverage-summary.json con las cantidades
      // (total y cubiertas) para comparar lo sin cubrir entre tareas (RNF-1).
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
