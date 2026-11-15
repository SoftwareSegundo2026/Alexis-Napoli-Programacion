# Spec 001 — Catálogo Chinook: traducción del servicio FastAPI (TP-1)

Estado: **aprobada** (15/11, Alexis Napoli — tras clarify ronda 1)

## Contexto y objetivo

La cátedra tiene un servicio de catálogo musical (base Chinook: artistas, álbumes,
géneros y pistas) escrito en otro lenguaje. Se necesita una versión nueva del
servicio que ofrezca **el mismo contrato HTTP** (mismas rutas, mismos nombres de
campo, mismo formato de error), de forma que un cliente que consumía el servicio
original pueda usar el nuevo sin cambios. El objetivo didáctico es demostrar que
la arquitectura en capas y los patrones (Facade, DAO, DTO) no dependen del lenguaje.

El nuevo servicio trabaja sobre una copia propia de la base Chinook (277 artistas,
348 álbumes, 25 géneros, 5 tipos de medio y 3503 pistas).

## Usuarios

| Rol | Qué hace |
|---|---|
| Visitante | Consulta el catálogo sin credenciales |
| Editor | Crea, modifica y elimina recursos presentando la clave de escritura |

## Historias de usuario

- **HU-1.** Como visitante, quiero listar y consultar artistas, álbumes, géneros y
  pistas, para explorar el catálogo sin necesidad de cuenta.
  *Aceptación:* los listados y las consultas por id responden sin credenciales (RF-1, RF-2, RF-3).
- **HU-2.** Como editor, quiero crear, modificar y eliminar recursos, para mantener
  el catálogo actualizado.
  *Aceptación:* con la clave válida, las altas responden 201, las modificaciones 200 y
  las bajas 204 (RF-6, RF-7, RF-8).
- **HU-3.** Como visitante, quiero que un álbum traiga el nombre de su artista y una
  pista el título de su álbum, su género y su tipo de medio, para no hacer una
  petición por cada relación.
  *Aceptación:* esos campos vienen en la misma respuesta (RF-4, RF-5).
- **HU-4.** Como editor, quiero que el servicio me diga qué dato está mal cuando
  envío algo inválido, para corregirlo sin adivinar.
  *Aceptación:* la respuesta 400 nombra el campo con problemas (RF-9, RF-10).
- **HU-5.** Como responsable del catálogo, quiero que nadie sin la clave pueda
  modificar datos y que no se puedan borrar registros que otros usan, para no
  perder información ni dejar datos huérfanos.
  *Aceptación:* sin clave → 401; borrado de un recurso en uso → 409 (RF-11, RF-12).
- **HU-6.** Como desarrollador de un cliente, quiero documentación interactiva
  generada desde el propio servicio, para conocer las rutas reales sin leer el código.
  *Aceptación:* la documentación lista todas las rutas del servicio (RF-14).

## Contrato general

- Todas las rutas cuelgan del prefijo `/api/v1`. Recursos: `/artists`, `/albums`,
  `/genres`, `/tracks`. Cada recurso ofrece: listado (`GET /recurso`), consulta por
  id (`GET /recurso/{id}`), alta (`POST /recurso`), modificación parcial
  (`PATCH /recurso/{id}`) y baja (`DELETE /recurso/{id}`).
- Los nombres de campo son los del servicio original:
  - Artista: `ArtistId`, `Name`, `ImageUrl`.
  - Álbum: `AlbumId`, `Title`, `ArtistId`, `ImageUrl`, `ArtistName`.
  - Género: `GenreId`, `Name`.
  - Pista: `TrackId`, `Name`, `AlbumId`, `MediaTypeId`, `GenreId`, `Composer`,
    `Milliseconds`, `Bytes`, `UnitPrice`, `AlbumTitle`, `GenreName`, `MediaTypeName`.
- `UnitPrice` es un número JSON tanto en la entrada como en la respuesta (por ejemplo `0.99`).
- Todo error responde con el cuerpo `{"detail": "<mensaje>"}`.
- Si una petición tiene varios problemas a la vez, se informa uno solo, en este orden
  de prioridad: falta de clave (401) → datos o id con formato inválido (400) →
  recurso inexistente (404) → conflicto (409).

## Requisitos funcionales (en EARS)

**Lectura**

- **RF-1:** CUANDO se solicita el listado de un recurso, EL SISTEMA devuelve una
  lista JSON de elementos ordenada por su identificador ascendente.
- **RF-2:** CUANDO el listado recibe `skip` y `limit`, EL SISTEMA omite los primeros
  `skip` elementos y devuelve como máximo `limit`; SI no se envían, ENTONCES EL
  SISTEMA usa `skip=0` y `limit=100`.
- **RF-3:** CUANDO se solicita un recurso por un id existente, EL SISTEMA lo devuelve
  con 200; SI el id no existe, ENTONCES EL SISTEMA responde 404 con
  `{"detail": "<Recurso> not found"}` (por ejemplo `Album not found`).
- **RF-4:** CUANDO EL SISTEMA devuelve un álbum, incluye `ArtistName` con el nombre
  de su artista.
- **RF-5:** CUANDO EL SISTEMA devuelve una pista, incluye `AlbumTitle`, `GenreName`
  y `MediaTypeName`; SI la pista no tiene álbum o género, ENTONCES el campo
  correspondiente vale `null` y la pista igual se devuelve.

**Escritura**

- **RF-6:** CUANDO un editor envía un alta válida, EL SISTEMA persiste el recurso y
  responde 201 con el recurso creado (incluido su id y los campos derivados de RF-4/RF-5).
- **RF-7:** CUANDO un editor envía una modificación parcial, EL SISTEMA actualiza
  **solo** los campos enviados, conserva el resto y responde 200 con el recurso
  actualizado; SI el id no existe, ENTONCES responde 404.
- **RF-8:** CUANDO un editor elimina un recurso existente que nadie referencia,
  EL SISTEMA lo elimina y responde 204 sin cuerpo; SI el id no existe, ENTONCES responde 404.

**Validación**

- **RF-9:** SI un alta o una modificación incumple las reglas de datos (tabla de
  abajo), ENTONCES EL SISTEMA responde 400 con un `detail` que nombra el campo
  inválido y no persiste nada.
- **RF-10:** SI `skip` o `limit` no son enteros, `skip` es negativo, `limit` es
  menor que 1 o `limit` es mayor que 100, ENTONCES EL SISTEMA responde 400; SI el
  `{id}` de la ruta no es un entero, ENTONCES EL SISTEMA responde 400; SI el cuerpo
  de un alta o modificación no es JSON válido, ENTONCES EL SISTEMA responde 400.

| Recurso | Reglas de datos |
|---|---|
| Artista | `Name` obligatorio en el alta, texto no vacío de hasta 120 caracteres. `ImageUrl` opcional, hasta 500. |
| Género | `Name` obligatorio en el alta, texto no vacío de hasta 120 caracteres. |
| Álbum | `Title` obligatorio en el alta, no vacío, hasta 160. `ArtistId` obligatorio en el alta y debe existir. `ImageUrl` opcional, hasta 500. |
| Pista | `Name` obligatorio en el alta, no vacío, hasta 200. `MediaTypeId` obligatorio en el alta y debe existir. `AlbumId` y `GenreId` opcionales; si se envían, deben existir. `Composer` opcional, hasta 220. `Milliseconds` obligatorio en el alta, entero mayor que 0. `Bytes` opcional, entero mayor o igual a 0. `UnitPrice` obligatorio en el alta, número mayor o igual a 0 con hasta 2 decimales. |
| Todos | Campos desconocidos en el cuerpo → 400. Un campo obligatorio no puede enviarse en `null` en una modificación. Un texto formado solo por espacios cuenta como vacío; los espacios de los extremos no se guardan. Las reglas de existencia de ids relacionados se aplican tanto en el alta como en la modificación. |

**Seguridad e integridad**

- **RF-11:** MIENTRAS una petición de alta, modificación o baja no presente la clave
  de escritura válida, EL SISTEMA responde 401 y no modifica nada; las lecturas no
  requieren clave.
- **RF-12:** SI se intenta eliminar un recurso referenciado por otro (artista con
  álbumes, álbum con pistas, género con pistas, pista presente en facturas o
  playlists), ENTONCES EL SISTEMA responde 409 con un `detail` que explica la causa
  y no elimina nada.
- **RF-13:** SI se da de alta o se renombra un artista o un género con un nombre que
  ya tiene **otro** registro del mismo recurso (sin distinguir mayúsculas ni espacios
  en los extremos), ENTONCES EL SISTEMA responde 409 y no persiste nada; reenviar el
  nombre actual del propio registro no es un conflicto.

**Documentación**

- **RF-14:** CUANDO se solicita la documentación de la API, EL SISTEMA devuelve una
  documentación interactiva generada a partir de las rutas reales, que incluye
  todas las rutas de RF-1 a RF-8 y declara la clave de escritura.

## Requisitos no funcionales

- **RNF-1:** Los listados se paginan en la base: nunca se leen todas las filas de
  una tabla para devolver una página.
- **RNF-2:** Ninguna respuesta incluye datos internos que no estén en el contrato.
- **RNF-3:** La clave de escritura y cualquier otro secreto se configuran fuera del
  repositorio; SI la clave no está configurada, ENTONCES EL SISTEMA no arranca y
  muestra un mensaje claro.
- **RNF-4:** Las pruebas automáticas trabajan sobre una copia descartable de la base,
  nunca sobre la base de desarrollo.

## Casos límite

- Id inexistente → 404. Id no numérico (`/albums/abc`) → 400. Id entero negativo o
  cero (`/albums/-1`, `/albums/0`) → 404 (es un entero válido que no existe).
- Cuerpo con JSON malformado → 400.
- Texto formado solo por espacios en un campo obligatorio → 400.
- Modificación de un álbum o pista con un id relacionado inexistente → 400.
- Escritura sin clave y con cuerpo inválido → 401 (la clave se verifica primero).
- Renombrar un artista o género con su mismo nombre actual → 200.
- Listado con `skip` mayor que la cantidad de elementos → 200 con `[]`.
- `limit=0`, `limit=101`, `skip=-1`, `limit=abc` → 400.
- Alta de álbum con `ArtistId` inexistente → 400 (no 404: el recurso pedido es el álbum).
- Alta de pista con `MediaTypeId`, `AlbumId` o `GenreId` inexistentes → 400.
- Nombre de artista o género repetido, con otras mayúsculas o con espacios → 409.
- Títulos de álbum y nombres de pista repetidos → se permiten (la base original los tiene).
- Borrar una pista original de Chinook → 409 (las 3503 están en facturas o playlists);
  una pista recién creada y sin referencias sí se puede borrar → 204.
- Modificación con cuerpo vacío `{}` → 200 y el recurso queda igual.
- Alta sin clave, con clave incorrecta o con clave vacía → 401.
- Dos modificaciones simultáneas del mismo recurso → ambas responden y queda el valor
  de la última que se aplicó (no se detectan conflictos; ver fuera de alcance).

## Fuera de alcance

- Usuarios, login con token, roles y registro de actividad (TP-2).
- Filtros de búsqueda, ordenamiento elegido por el cliente y metadatos de paginación (TP-3).
- Endpoints de imágenes (subida, descarga y búsqueda externa de portadas) del servicio original.
- Tipos de medio, clientes, empleados, facturas y playlists como recursos propios
  (solo se consultan para validar referencias e integridad).
- Control de concurrencia sobre escrituras simultáneas (TP-4).

## Criterios de finalización

- Cada RF tiene al menos un test automatizado que lo comprueba y pasa.
- La documentación de la API refleja las rutas reales.
- `pnpm lint`, `pnpm build`, `pnpm test` y `pnpm test:e2e` en verde.

## Decisiones de la entrevista (15/11)

1. Escrituras en este TP: protegidas con una **clave de escritura fija** (401 sin ella);
   se reemplaza por login en el TP-2.
2. Contrato: **idéntico al servicio original** (nombres de campo y errores `{"detail"}`).
3. Listados: **lista simple**, como el original; los metadatos llegan en el TP-3 vía `/sdd-change`.
4. `limit`: por defecto 100, **máximo 100**; fuera de rango → **400**.
5. Borrar algo en uso: **409**, nunca en cascada.

Correcciones aprobadas tras clarify ronda 1 (A1–A5, C1–C2): nombre propio no es
conflicto; solo espacios = vacío; existencia de ids también al modificar; `UnitPrice`
numérico; prioridad 401 → 400 → 404 → 409; JSON malformado → 400; id ≤ 0 → 404.

## Dudas abiertas

- Ninguna.
