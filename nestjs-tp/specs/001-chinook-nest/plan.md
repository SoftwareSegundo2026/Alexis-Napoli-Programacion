# Plan 001 — Catálogo Chinook en NestJS (TP-1)

Estado: **aprobado** (15/11, Alexis Napoli — incluye las 4 dependencias nuevas) · Spec: `specs/001-chinook-nest/spec.md` (aprobada el 15/11)

## Dependencias nuevas (requieren aprobación — AGENTS.md)

| Paquete | Para qué | RF |
|---|---|---|
| `typeorm` ^1.1 + `@nestjs/typeorm` ^12 | ORM con patrón Repository (equivalente a SQLAlchemy del original) | RF-1…RF-8, RNF-1 |
| `better-sqlite3` ^12 | Driver SQLite que soporta TypeORM 1.x (la 13 no es compatible) | — |
| `class-validator` + `class-transformer` | Validación declarativa de DTOs | RF-9, RF-10 |
| `@nestjs/swagger` ^12 | Documentación interactiva generada desde el código | RF-14 |

`better-sqlite3` es nativo: pnpm bloquea su script de instalación por defecto, así que
se habilita en `pnpm-workspace.yaml` (`allowBuilds`). Verificado con una prueba aislada
el 15/11: instala en Windows y lee `Chinook.db` (3503 pistas, `UnitPrice` numérico).

## Estructura de módulos

```
data/
├── chinook.template.db          ← copia versionada de la Chinook del docente (no se escribe nunca)
└── chinook.db                   ← base de trabajo (gitignored), se crea desde el template al arrancar
src/
├── main.ts                      ← crea la app, llama a configureApp, escucha en PORT
├── app.setup.ts                 ← configureApp(app): prefijo /api/v1, ValidationPipe, filtro, Swagger
├── app.module.ts                ← ConfigModule (con validación) + TypeORM + módulos del dominio
├── config/env.validation.ts     ← exige WRITE_API_KEY; DATABASE_PATH y PORT con default
├── database/database.module.ts  ← TypeORM con better-sqlite3, synchronize: false, prepara la base
├── common/
│   ├── dto/pagination-query.dto.ts       ← skip/limit validados (RF-2, RF-10)
│   ├── filters/detail-exception.filter.ts ← todo error → {"detail": ...} (contrato)
│   ├── middleware/write-key.middleware.ts ← clave de escritura global (RF-11) — ver decisión 5
│   └── validation/                        ← helpers: trim, "no null en update", primer error → detail
├── genres/ artists/ albums/ tracks/
│   ├── <recurso>.module.ts
│   ├── <recurso>.controller.ts  ← Facade: solo HTTP (rutas, pipes, códigos 201/204)
│   ├── <recurso>.service.ts     ← reglas de negocio: 404, 409, existencia de relacionados
│   ├── <recurso>.repository.ts  ← DAO: único lugar que usa TypeORM
│   ├── dto/create-*.dto.ts, update-*.dto.ts, *-response.dto.ts
│   └── entities/*.entity.ts
└── tracks/entities/             ← además MediaType, InvoiceLine y PlaylistTrack (solo lectura,
                                    para validar MediaTypeId y la integridad de RF-12)
test/
├── helpers/test-app.ts          ← copia temporal de la base + app con configureApp
├── genres|artists|albums|tracks.e2e-spec.ts
├── security.e2e-spec.ts         ← 401 en las 12 rutas de escritura, prioridad 401 → 400
└── docs.e2e-spec.ts             ← RF-14
```

El `AppController` de la base (`GET /` → "Hello World!") se conserva, excluido del
prefijo, para no romper su test existente.

## Archivos y responsabilidad

| Archivo | Qué hace | RF / RNF |
|---|---|---|
| `src/config/env.validation.ts` | Falla al arrancar si falta `WRITE_API_KEY`, con mensaje claro | RNF-3 |
| `src/database/database.module.ts` | Conexión, `synchronize: false`, copia del template si falta la base | RNF-4 |
| `src/app.setup.ts` | Prefijo, `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })`, filtro, Swagger | RF-9, RF-10, RF-14 |
| `src/common/filters/detail-exception.filter.ts` | `{"detail"}` para todo error; JSON malformado → 400; error no previsto → 500 genérico | contrato, RF-10 |
| `src/common/middleware/write-key.middleware.ts` | POST/PATCH/PUT/DELETE exigen `X-API-Key`; GET libre | RF-11 |
| `src/common/dto/pagination-query.dto.ts` | `skip` ≥ 0, 1 ≤ `limit` ≤ 100, defaults 0/100 | RF-2, RF-10 |
| `*.controller.ts` | Rutas, `ParseIntPipe` en `{id}`, `@HttpCode(204)` en DELETE | RF-1, RF-3, RF-6…RF-8 |
| `*.service.ts` | 404, 409 por referencias (RF-12) y por nombre repetido (RF-13), 400 por id relacionado inexistente | RF-3, RF-7…RF-9, RF-12, RF-13 |
| `*.repository.ts` | `find({ skip, take, order: { id: 'ASC' } })`, búsquedas, conteo de referencias | RF-1, RF-2, RNF-1 |
| `*-response.dto.ts` | `fromEntity()`: arma el contrato (`ArtistName`, `AlbumTitle`, …) y nada más | RF-4, RF-5, RNF-2 |
| `create-*.dto.ts` / `update-*.dto.ts` | Reglas de la tabla de la spec con decoradores + `@ApiProperty` | RF-9 |

## Decisiones (y por qué), contra la constitution

1. **TypeORM + SQLite sobre una copia de Chinook.** Es lo que recomienda el plan de
   migración del docente y no requiere instalar un servidor de base. `synchronize: false`:
   la base ya existe y el servicio no debe alterar su esquema.
2. **Template versionado + base de trabajo ignorada.** El template es la fuente
   reproducible (sirve también para CI); la base de trabajo y las de test se descartan
   (RNF-4). Cada archivo e2e crea su propia copia temporal fuera de OneDrive (`os.tmpdir()`).
3. **Entidad ≠ contrato** (principio 3). Las entidades usan propiedades en camelCase
   mapeadas a las columnas PascalCase de Chinook; los DTOs de salida exponen los nombres
   del contrato original. Así la base y la API pueden cambiar por separado.
4. **Repository propio por recurso** (patrón DAO). El service no conoce TypeORM y en
   los tests unitarios se reemplaza por un mock.
5. **Clave de escritura como middleware global** (principio 5: "protegido por defecto").
   Si mañana alguien agrega un POST y se olvida de protegerlo, queda protegido igual.
   Comparación en tiempo constante (`timingSafeEqual`) para no filtrar la clave por
   tiempos de respuesta. En el TP-2 se reemplaza por el login con JWT.
   *Cambio aprobado el 16/11 (Alexis Napoli), durante T2:* el plan original decía
   "guard global", pero el lector del cuerpo de Express corre **antes** que los guards,
   así que un JSON malformado sin clave daba 400 en vez de 401 (la spec pide 401). Un
   middleware registrado en `configureApp` antes del lector del cuerpo lo resuelve.
6. **El orden 401 → 400 → 404 → 409 sale del ciclo de la petición**: el middleware de la
   clave corre antes que el lector del cuerpo y que los pipes (validación), y estos antes
   que el service (404/409). No hace falta código extra para respetar la prioridad.
7. **Validación**: el primer error se devuelve como `detail` nombrando el campo. Los
   textos se recortan (trim) antes de validar, así "solo espacios" falla como vacío. En
   los DTOs de modificación, los campos obligatorios usan "validar si viene" en lugar de
   "opcional", porque el opcional de class-validator también deja pasar `null`.
8. **Las reglas 409 viven en el service**, no en la base: son reglas de negocio y se
   testean con el repository mockeado. Las claves foráneas de SQLite quedan como red de
   seguridad adicional.
9. **`configureApp` compartido** entre `main.ts` y los tests e2e: lo que se testea es
   exactamente lo que corre en producción (evita el clásico "en el e2e no había
   `ValidationPipe`").
10. **Swagger con `@ApiProperty` explícito** (no el plugin del CLI), porque Vitest no
    ejecuta el plugin y los tests de RF-14 verían una documentación distinta.

## Estrategia de tests

| Tanda | Tipo | Qué cubre |
|---|---|---|
| A | unit — services con repository mockeado | RF-3, RF-7, RF-8, RF-9 (ids relacionados), RF-12, RF-13 |
| B | unit — piezas comunes (middleware de la clave, filtro, paginación, validación de entorno) | RF-10, RF-11, RNF-3, formato `{"detail"}` |
| C | unit — repositories con el `Repository` de TypeORM mockeado | RNF-1 (paginado en la base: `skip`/`take`) |
| D | e2e por recurso sobre copia temporal de la base | RF-1…RF-10, RF-12, RF-13, RNF-2 (claves exactas del JSON) |
| E | e2e de seguridad | RF-11 en las 12 rutas de escritura, prioridad 401 → 400, RNF-4 (template intacto) |
| F | e2e de documentación | RF-14 |

- Unit: `Test.createTestingModule` con `{ provide: XRepository, useValue: mock }`.
- e2e: `supertest` contra la app armada con `configureApp`.
- **Ningún RF queda sin tanda.**

## Riesgos y casos a tener presentes

- Imports locales sin `.js` → build verde y e2e roto.
- `@IsOptional` acepta `null` → un PATCH con `{"Title": null}` rompería el NOT NULL (decisión 7).
- `LOWER()` de SQLite solo normaliza ASCII: "Ópera" y "ópera" no se detectan como
  repetidos. Se acepta y se documenta (la base no tiene nombres así hoy).
- Las 3503 pistas originales están referenciadas: los tests de borrado 204 tienen que
  crear su propia pista primero.
- `better-sqlite3` necesita `allowBuilds` en `pnpm-workspace.yaml` (también en CI/Docker).
- Dos archivos e2e escribiendo la misma base en paralelo → cada uno con su copia.

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

Estimación: 9 tareas, en este orden: base de datos y configuración → núcleo HTTP común →
clave de escritura → géneros → artistas → álbumes → pistas → documentación → cierre.
