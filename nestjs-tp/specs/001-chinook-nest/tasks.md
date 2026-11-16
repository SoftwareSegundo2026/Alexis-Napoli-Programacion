# Tareas 001 — Catálogo Chinook en NestJS (TP-1)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/001-chinook-nest/plan.md` (aprobado el 15/11)

Reglas: una tarea por vez, tests primero (en rojo), gates
`pnpm lint && pnpm build && pnpm test && pnpm test:e2e` en verde, un commit
`001-Tn: …`, `[x]` acá y `MEMORY.md` actualizado. Después, **PARA**.

- [x] **T1. Base de datos y configuración.** RNF-3, RNF-4
      Dependencias del plan, `allowBuilds` para `better-sqlite3`, template
      `data/chinook.template.db`, validación de entorno (`WRITE_API_KEY` obligatoria),
      módulo de base (`synchronize: false`, copia del template si falta) y helper de
      test que levanta la app sobre una copia temporal.
      Hecho cuando: `pnpm test` pasa los tests de validación de entorno (sin clave → error
      con mensaje claro) y `pnpm test:e2e` levanta la app sobre una copia temporal y verifica
      que el template no cambió.
      Estimación: 30 min · depende de: —

- [x] **T2. Núcleo HTTP común.** RF-2, RF-10, contrato `{"detail"}`
      `configureApp` (prefijo `/api/v1`, `ValidationPipe`, filtro de errores), DTO de
      paginación y helpers de validación (trim, primer error → `detail`).
      Hecho cuando: `pnpm test` pasa los tests del filtro (`HttpException` → `{"detail"}`,
      JSON malformado → 400, error no previsto → 500 genérico) y del DTO de paginación
      (`limit` 0/101/abc y `skip` -1 → error; defaults 0/100).
      Estimación: 30 min · depende de: T1

- [x] **T3. Clave de escritura global.** RF-11
      Middleware global (antes del lector del cuerpo; ver decisión 5 del plan, cambio del 16/11)
      que exige `X-API-Key` en POST/PATCH/PUT/DELETE, comparación en tiempo constante.
      Hecho cuando: `pnpm test` pasa los tests del middleware (sin clave, vacía o incorrecta → 401;
      GET sin clave pasa; clave correcta pasa) y `pnpm test:e2e` comprueba que un JSON
      malformado sin clave responde 401.
      Estimación: 20 min · depende de: T2

- [x] **T4. Géneros: CRUD completo.** RF-1, RF-2, RF-3, RF-6, RF-7, RF-8, RF-9, RF-10, RF-12, RF-13
      Entidad, repository, service, controller y DTOs de `genres` (incluye el 409 por
      pistas que lo usan y por nombre repetido).
      Hecho cuando: `pnpm test` pasa los tests del service (mock) y del repository
      (paginado con `skip`/`take`), y `pnpm test:e2e` pasa `test/genres.e2e-spec.ts`.
      Estimación: 30 min · depende de: T3

- [x] **T5. Artistas: CRUD completo.** RF-1, RF-2, RF-3, RF-6, RF-7, RF-8, RF-9, RF-12, RF-13
      Igual que T4 para `artists` (409 si tiene álbumes o el nombre ya existe).
      Hecho cuando: `pnpm test` pasa los tests del service y `pnpm test:e2e` pasa
      `test/artists.e2e-spec.ts`.
      Estimación: 25 min · depende de: T4

- [ ] **T6. Álbumes: CRUD completo con `ArtistName`.** RF-1, RF-2, RF-3, RF-4, RF-6, RF-7, RF-8, RF-9, RF-12
      Reemplaza el andamio `albums` de la base (los tests "should be defined" se
      convierten en tests reales). `ArtistId` inexistente → 400; 409 si tiene pistas.
      Hecho cuando: `pnpm test` pasa los tests del service y `pnpm test:e2e` pasa
      `test/albums.e2e-spec.ts` (incluido `ArtistName` y la validación de `ArtistId`).
      Estimación: 30 min · depende de: T5

- [ ] **T7. Pistas: CRUD completo con datos enriquecidos.** RF-1, RF-2, RF-3, RF-5, RF-6, RF-7, RF-8, RF-9, RF-12
      Entidades de solo lectura `MediaType`, `InvoiceLine`, `PlaylistTrack`. Validación de
      la tabla de la spec, ids relacionados inexistentes → 400, 409 si está en facturas o
      playlists, `UnitPrice` numérico.
      Hecho cuando: `pnpm test` pasa los tests del service y `pnpm test:e2e` pasa
      `test/tracks.e2e-spec.ts` (incluidos `AlbumTitle`, `GenreName`, `MediaTypeName` y el
      borrado 204 de una pista recién creada).
      Estimación: 30 min · depende de: T6

- [ ] **T8. Documentación interactiva.** RF-14
      Swagger en `/docs` (JSON en `/docs-json`), `@ApiProperty` en los DTOs y esquema de la
      clave de escritura.
      Hecho cuando: `pnpm test:e2e` pasa `test/docs.e2e-spec.ts`, que verifica que el JSON
      lista las 20 rutas de los 4 recursos y declara `X-API-Key`.
      Estimación: 20 min · depende de: T7

- [ ] **T9. Seguridad transversal y cierre.** RF-11, RNF-2, RNF-4
      e2e de seguridad (401 en las 12 rutas de escritura; sin clave y con cuerpo inválido
      → 401), verificación de claves exactas del JSON por recurso, `.env.example` y README
      de puesta en marcha, `MEMORY.md`.
      Hecho cuando: `pnpm test:e2e` pasa `test/security.e2e-spec.ts` y
      `pnpm lint && pnpm build && pnpm test && pnpm test:e2e` quedan todos en verde.
      Estimación: 25 min · depende de: T8

---

Después de T9: `/sdd-validate 001-chinook-nest` (tabla RF → test → resultado + veredicto).
