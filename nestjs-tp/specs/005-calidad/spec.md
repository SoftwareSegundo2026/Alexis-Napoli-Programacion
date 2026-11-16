# Spec 005 — Suite de calidad: cobertura, TDD y contrato (TP-5)

Estado: **aprobada** (16/11, Alexis Napoli — tras clarify ronda 1) · Se apoya en `specs/001-chinook-nest/` y `specs/002-auth-roles/` (aprobadas y validadas)

## Contexto y objetivo

Este TP **no agrega funcionalidad**: endurece lo que ya existe. El objetivo es poder
cambiar el sistema sin miedo, y demostrarlo con tres cosas verificables:

1. **Cobertura medible con un piso**: si los tests dejan de ejecutar una parte
   significativa del código, el proceso falla solo, sin depender de que alguien mire
   un número.
2. **TDD sobre bugs reales**: tres defectos encontrados en el propio TP-1 (confirmados
   contra la aplicación corriendo el 16/11), cada uno con un test que lo reproduce
   **antes** del arreglo.
3. **Un contrato de la API** que se corre con un comando y detecta cuando un endpoint
   cambia lo que responde.

A diferencia de las specs anteriores, acá casi todos los requisitos son de **calidad**
(no funcionales), pero se escriben igual en EARS para que cada uno sea comprobable.

## Usuarios

| Rol | Qué necesita de este TP |
|---|---|
| Desarrollador (yo, y TP-3/TP-4 después) | Cambiar código sabiendo que, si rompe algo, un test o el gate lo avisan |
| Cliente de la API | Que las respuestas no cambien de forma sin aviso |
| Docente / corrector | Evidencia en el historial: test rojo antes del arreglo, umbral declarado, contrato ejecutable |

## Historias de usuario

- **HU-1.** Como desarrollador, quiero que el proceso de tests falle si la cobertura cae
  por debajo de un umbral declarado, para que el código nuevo no entre sin sus tests.
  *Aceptación:* `pnpm test:cov` termina con error si la cobertura baja (RF-1, RF-2).
- **HU-2.** Como cliente de la API, quiero que un cambio en la forma de una respuesta se
  detecte antes de publicarse, para que mi integración no se rompa sin aviso.
  *Aceptación:* cambiar un campo, su tipo o un código de estado hace fallar el contrato (RF-3 a RF-5).
- **HU-3.** Como visitante, quiero que un listado con un `skip` enorme me devuelva una
  lista vacía y no un error del servidor.
  *Aceptación:* 200 con `[]` en los 5 listados (RF-6).
- **HU-4.** Como admin, quiero que el catálogo no acepte dos artistas o géneros cuyo
  nombre difiere solo en mayúsculas, también con letras acentuadas o con ñ.
  *Aceptación:* 409 y nada guardado (RF-7).
- **HU-5.** Como admin, quiero que un campo opcional enviado vacío o con solo espacios
  quede sin valor (`null`) y no como texto vacío invisible.
  *Aceptación:* la respuesta y la base muestran `null` (RF-8).
- **HU-6.** Como desarrollador, quiero refactorizar lógica repetida apoyándome en los
  tests existentes, sin tocarlos y sin que baje la cobertura.
  *Aceptación:* el commit del refactor no modifica ningún archivo de test, los gates
  quedan en verde y las líneas y ramas sin cubrir no aumentan (RF-9).

## Requisitos (en EARS)

**Gate de cobertura**

- **RF-1:** SI la cobertura de **líneas** de los tests unitarios baja de **75%**, o la de
  **ramas** baja de **75%**, ENTONCES `pnpm test:cov` termina con código de salida
  distinto de 0 (el gate falla), aunque todos los tests pasen. SI algún test falla,
  ENTONCES `pnpm test:cov` también termina con error, sea cual sea la cobertura.
- **RF-2:** EL SISTEMA mide la cobertura sobre **todos** los archivos de `src/` (también
  los que ningún test importa), excluyendo solo los archivos de test. El umbral y el
  alcance de la medición se declaran en esta spec y en la configuración del gate, con
  los mismos valores.

**Contrato de la API**

- **RF-3:** CUANDO un endpoint cambia su respuesta (código de estado, un campo que
  aparece o desaparece, o el tipo de un campo), EL contrato lo detecta: `pnpm test:e2e`
  falla y el mensaje nombra la operación y el caso.
- **RF-4:** EL contrato cubre **todas** las operaciones documentadas de la API (hoy 25:
  20 del catálogo, el login y 4 de usuarios), y para cada una el caso exitoso y **cada
  código de error que la documentación declara** para esa operación. SI aparece una
  operación documentada sin casos en el contrato, ENTONCES el contrato falla. Los
  códigos que una operación puede devolver sin documentarlos (p. ej. 400 por JSON mal
  formado) no son obligatorios en el contrato: ya los cubren los e2e existentes, y que
  la documentación esté completa lo controla `docs.e2e`.
- **RF-5:** Para cada respuesta, el contrato verifica el código de estado, el conjunto
  **exacto** de campos (ni uno más, ni uno menos) y el tipo de cada campo (número,
  texto, booleano o `null` donde la spec lo admite). Toda respuesta de error tiene
  exactamente `{"detail": <texto>}`. Las formas esperadas se escriben **a mano** en el
  contrato, a partir de las specs 001 y 002: **no** se derivan de la documentación que
  genera la propia aplicación (si no, un cambio en el código que también cambie la
  documentación se aprobaría solo). La documentación se usa únicamente como inventario
  de operaciones y códigos (RF-4).

**Bugs del TP-1 (cada uno con su test rojo antes del arreglo)**

- **RF-6 (bug 1):** CUANDO un listado paginado (artistas, álbumes, géneros, pistas y
  usuarios) recibe un `skip` formado solo por dígitos, con **cualquier cantidad de
  dígitos**, EL SISTEMA responde 200; SI `skip` supera la cantidad de elementos,
  ENTONCES devuelve `[]`. El tamaño de `skip` nunca provoca un 400 ni un 500.
  *Hoy:* `?skip=99999999999999999999` → **500**, y un `skip` de cientos de dígitos → 400.
  Contradice el caso límite "skip mayor que la cantidad → 200 con `[]`" de la spec 001.
- **RF-7 (bug 2):** SI el alta o la modificación de un artista o un género usa un nombre
  que ya pertenece a otro, sin distinguir mayúsculas **en ninguna letra** (incluidas
  `Á É Í Ó Ú Ü Ñ` y demás letras no inglesas) ni los espacios de los extremos,
  ENTONCES EL SISTEMA responde 409 y no guarda nada. La comparación usa la conversión a
  minúsculas de Unicode, sin configuración regional (la misma en cualquier servidor):
  las letras sin equivalente uno a uno, como `ß` frente a `SS`, se consideran
  distintas. Los acentos sí distinguen (`Cancion` y `Canción` son nombres distintos).
  *Hoy:* `Canción Ñandú` y `CANCIÓN ÑANDÚ` se crean los dos (201). Contradice RF-13 de
  la spec 001. La base original tiene 31 artistas con letras no ASCII y ninguna colisión
  previa con esta regla (verificado el 16/11), así que el arreglo no deja datos
  existentes en conflicto.
- **RF-8 (bug 3):** CUANDO un campo de texto **opcional** llega vacío o con solo
  espacios, EL SISTEMA lo trata exactamente igual que si se enviara `null`: en
  `ImageUrl` de artista y de álbum y `Composer` de pista (alta y modificación) y en
  `full_name` de usuario (solo alta: la spec 002 no permite modificarlo).
  *Hoy:* se guarda `""`. Contradice la regla "un texto formado solo por espacios cuenta
  como vacío" de las specs 001 y 002.

**Refactor con red de seguridad**

- **RF-9:** La lógica de "aplicar al recurso solo los campos que vinieron en el PATCH",
  hoy repetida en los services de artistas, álbumes, géneros y pistas, se extrae a una
  pieza común. CUANDO se hace el refactor, los tests existentes **no se modifican**,
  siguen pasando y la cantidad de líneas y de ramas **sin cubrir** no aumenta respecto
  de la medida antes del refactor. (Se compara lo sin cubrir y no el porcentaje: al
  eliminar código duplicado que ya estaba cubierto, el porcentaje puede bajar sin que
  quede nada nuevo sin probar.)

**Relación con las specs anteriores**

- **RF-10:** Esta spec precisa y modifica reglas de las specs 001 y 002, que siguen
  vigentes en todo lo demás:
  - RF-6 precisa el caso límite de `skip` de la 001 y la paginación de usuarios (RF-8
    de la 002): el tamaño de `skip` no tiene límite.
  - RF-7 precisa RF-13 de la 001: "sin distinguir mayúsculas" incluye las letras no
    ASCII.
  - RF-8 precisa la fila "Todos" de las tablas de reglas de la 001 y la 002: en un campo
    opcional, el texto vacío o de solo espacios equivale a `null`.

## Requisitos no funcionales

- **RNF-1:** Ninguna tarea de este TP aumenta la cantidad de líneas ni de ramas **sin
  cubrir** respecto de la tarea anterior, y los porcentajes nunca bajan del umbral de
  RF-1. En cada tarea se registran los porcentajes y las cantidades sin cubrir.
  `pnpm test:cov` es un **5.º gate** en cada tarea de este TP, además de los 4 de la
  constitución.
- **RNF-2:** El contrato se corre en una máquina limpia con un solo comando
  (`pnpm install` y `pnpm test:e2e`), sin servicios externos ni pasos manuales, para
  que el CI del TP-6 lo use tal cual.
- **RNF-3:** No se borra ni se debilita ningún test existente. Los arreglos de bugs
  pueden **agregar** tests; si un test viejo afirmaba el comportamiento defectuoso, se
  migra y se documenta el mapeo.
- **RNF-4:** La evidencia de TDD está en el historial. Cada bug es una tarea con **dos
  commits**: primero `005-Tn (rojo)`, con **solo** el test nuevo, que falla de verdad
  (la tarea no se marca `[x]`); después `005-Tn`, con el arreglo, **sin modificar** ese
  test, con los gates en verde y la tarea marcada `[x]`. Es una excepción declarada a
  "un commit por tarea" que exige la propia consigna ("test que falla antes del fix y
  pasa después, verificable con `git log -p`"). Cada bug deja además su nota en
  `MEMORY.md` (síntoma, causa, arreglo, commits).
- **RNF-5:** Sin dependencias nuevas salvo que el plan las justifique y se aprueben.

## Casos límite

| # | Situación | Esperado |
|---|---|---|
| 1 | Cobertura de líneas o de ramas en 74,9% con todos los tests en verde | `pnpm test:cov` falla |
| 2 | Un archivo de `src/` que ningún test importa | cuenta en la cobertura (con 0%) |
| 3 | Se quita un campo de la respuesta de un endpoint, o se agrega uno | el contrato falla y nombra la operación |
| 4 | Un campo numérico pasa a viajar como texto (p. ej. `UnitPrice: "0.99"`) | el contrato falla |
| 5 | Un endpoint cambia su código de éxito (p. ej. 201 → 200) | el contrato falla |
| 6 | Se agrega una operación documentada sin casos de contrato | el contrato falla |
| 7 | `?skip=99999999999999999999` en cualquiera de los 5 listados | 200 con `[]` |
| 8 | `?skip=` entero enorme combinado con un `limit` inválido | 400 por `limit` (la validación no cambia) |
| 9 | Alta de género `CANCIÓN ÑANDÚ` existiendo `Canción Ñandú` | 409 |
| 10 | Modificación de un artista al nombre de otro con distinta capitalización acentuada | 409 |
| 11 | Alta de `Cancion` existiendo `Canción` | 201 (los acentos distinguen) |
| 12 | Alta de artista con `ImageUrl: "   "` o `ImageUrl: ""` | 201 con `ImageUrl: null` |
| 13 | `PATCH` de pista con `Composer: "  "` | 200 con `Composer: null` |
| 14 | Alta de usuario con `full_name: "   "` | 201 con `full_name: null` |
| 15 | Campo obligatorio (`Name`, `Title`) con solo espacios | sigue siendo 400 (no cambia) |
| 16 | Refactor del PATCH aplicado | mismos tests sin tocar, en verde; líneas y ramas sin cubrir ≤ las previas |
| 17 | `?skip=` con 400 dígitos | 200 con `[]` |
| 18 | `pnpm test:cov` con un test en rojo y cobertura alta | falla |
| 19 | Alta de género `STRASSE` existiendo `Straße` | 201 (`ß` y `SS` son distintas) |

## Fuera de alcance

- Tests de carga o rendimiento; tests E2E de frontend; testing de mutación (como
  herramienta: sí se usan mutaciones manuales para verificar que el gate y el contrato
  detectan cambios).
- Funcionalidad nueva (búsqueda: TP-3; reservas: TP-4).
- Otros defectos menores encontrados en el análisis y no elegidos (ver "Hallazgos
  anotados"): se registran, no se arreglan en este TP.
- Cambiar `docs/constitution.md` (prohibido por `AGENTS.md`): el umbral se declara acá.

## Criterios de finalización

- `pnpm test:cov` aplica el umbral de RF-1 y se demostró que falla al bajarlo (mutación).
- Los 3 bugs tienen su commit de test rojo seguido del commit del arreglo.
- El contrato cubre las 25 operaciones con éxito y errores documentados, y se demostró
  que detecta un cambio de respuesta (mutación).
- Cada RF y cada caso límite está verificado por un test automatizado **o**, cuando no
  se puede probar desde la propia suite (casos 1, 3, 4, 5, 6, 16 y 18: el gate y el
  contrato fallan ante un cambio; el refactor no tocó tests), por una **mutación o
  revisión del historial documentada en `validate.md`** con el comando y su salida.
- `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e` y `pnpm test:cov` en verde.

## Decisiones de la entrevista (16/11)

1. **Umbral:** líneas 75% y ramas 75%, medido con los tests unitarios sobre **todo**
   `src/`. Medición del 16/11: 76,5% líneas, 80,4% ramas. (Sin incluir todo `src/`,
   Vitest informa 89%, porque solo cuenta los archivos que algún test importa: ese
   número no se usa.)
2. **Bugs elegidos:** `skip` enorme → 500; nombres duplicados con mayúsculas acentuadas;
   opcional de solo espacios guardado como `""`.
3. **Opcional vacío o de solo espacios:** se guarda como `null` (no 400): "vacío" en un
   opcional significa "sin valor", igual que enviar `null`, y no rompe a clientes que hoy
   mandan `""`.
4. **Refactor:** la aplicación de cambios parciales del PATCH (repetida en 4 services).
5. Por defecto (avisado en la entrevista): el contrato se escribe como tests e2e con
   Vitest + supertest dentro de `pnpm test:e2e` (sin dependencias nuevas, corre en una
   máquina limpia y el CI del TP-6 lo invoca sin cambios).

Correcciones aprobadas tras clarify ronda 1 (A1–A4, K1–K2, C1–C3, T1–T2, R1–R2): `skip`
sin límite de dígitos; minúsculas de Unicode sin configuración regional; "no baja" =
líneas y ramas sin cubrir no aumentan; formas del contrato escritas a mano; dos commits
por bug (rojo real + arreglo); `full_name` solo en el alta; vacío = `null`; códigos no
documentados fuera del contrato; `test:cov` como 5.º gate; verificación por mutación
documentada; RF-10 declara qué reglas de 001/002 se precisan; aceptación de HU-6 y nota
por bug en `MEMORY.md`.

## Hallazgos anotados (no se arreglan en este TP)

- `Milliseconds` y `Bytes` aceptan enteros fuera del rango seguro de JavaScript
  (p. ej. `1e20`); `UnitPrice` acepta valores mayores que lo que admite `NUMERIC(10,2)`.
  La spec 001 no fija máximos.
- La comparación de `email` de usuarios tiene la misma limitación de mayúsculas no
  ASCII que RF-7 (los `username` no, porque solo admiten caracteres ASCII).
- La cobertura medida con los tests e2e informa un total de líneas distinto del de los
  unitarios (1548 contra 622): se investiga en el plan antes de decidir si se usa.

## Dudas abiertas

- Ninguna.
