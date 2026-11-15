---
name: nestjs-esm
description: Trampas del stack NestJS 12 + TypeScript ESM + Vitest de este TP. Usala al escribir o revisar cualquier archivo de src/ o test/.
---

# NestJS + ESM — trampas conocidas

## Imports ESM

- El proyecto es `"type": "module"` con `module: nodenext`: **todo import local
  lleva `.js`** aunque el archivo sea `.ts` → `import { X } from './x.service.js'`.
- Sin `.js` puede compilar y aun así fallar al arrancar o en el e2e.

## Configuración y `.env`

- `nest start` **no** carga `.env`: lo hace `ConfigModule.forRoot()`.
- No leer `process.env` antes de esa línea; dentro de la app usar `ConfigService`.
- `.env` nunca se commitea; `.env.example` sí, con valores de ejemplo.

## HTTP y validación

- `ValidationPipe` global en `main.ts` **y** en el `app` de los tests e2e
  (si el e2e no lo registra, la validación "no existe" en el test).
- Un DTO sin decoradores de `class-validator` no valida nada.
- `whitelist: true` + `forbidNonWhitelisted: true` para rechazar campos de más.
- `id` llega como string: `ParseIntPipe`. Id inexistente → `NotFoundException` (404),
  **nunca** `null` con 200.
- Excepciones nativas: `BadRequestException` 400, `NotFoundException` 404,
  `ConflictException` 409, `UnauthorizedException` 401, `ForbiddenException` 403.
- `@HttpCode(204)` en los DELETE; los POST devuelven 201 por defecto.

## Capas

- Controller: solo HTTP (rutas, pipes, códigos). Sin lógica ni acceso a datos.
- Service: reglas de negocio. Recibe el repository por inyección.
- Repository: único lugar que habla con la base.
- Entrada y salida por DTOs: nunca devolver la entidad cruda si tiene datos internos.

## Tests con Vitest

- Unit: `Test.createTestingModule({ providers: [Service, { provide: Repo, useValue: mock }] })`
  con `vi.fn()` para los métodos del mock.
- e2e: `supertest` contra `app.getHttpServer()`; replicar en el test la misma
  configuración global que `main.ts` (pipes, filtros, prefijo).
- Los tests no deben depender de la base real de desarrollo: usar una copia propia.
- `globals: true`: `describe/it/expect/vi` están disponibles sin importar.

## TypeScript estricto

- Sin `any`, sin `@ts-ignore` (el lint lo rechaza). Si el tipo no cierra, se corrige el modelo.
- Promesas siempre con `await` (`no-floating-promises` está en error).
