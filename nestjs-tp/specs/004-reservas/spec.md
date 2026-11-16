# Spec 004 — Reservas de entradas con pago y transacciones (TP-4)

Estado: **aprobada** (16/11, Alexis Napoli) · Se apoya en las specs 001, 002, 003, 005 y 006 (aprobadas y validadas)

## Contexto y objetivo

El catálogo tiene artistas, pero nada que se pueda reservar. Este cambio agrega
**conciertos** con capacidad limitada y **reservas de entradas con pago simulado**. El
foco no es el pago sino la **atomicidad y la concurrencia**: una reserva y su pago se
registran juntos o no se registra nada, y dos personas que compiten por la última entrada
nunca pueden quedarse las dos con ella. La disponibilidad se **calcula** a partir de las
reservas, nunca se lleva en un contador que se suma y se resta a mano.

## Usuarios

| Rol | Qué hace |
|---|---|
| Visitante (sin cuenta) | Consulta conciertos y su disponibilidad |
| Usuario autenticado (viewer o admin) | Reserva entradas pagándolas en el acto, consulta y cancela **sus** reservas |
| Admin | Crea conciertos y marca reservas como completadas después del concierto |

## Historias de usuario

- **HU-1.** Como visitante, quiero ver los conciertos con las entradas que quedan, para saber
  si puedo ir. *Aceptación:* cada concierto informa su disponibilidad calculada y confirmada,
  nunca la de una reserva a medio hacer (RF-2, RF-13).
- **HU-2.** Como usuario, quiero reservar y pagar entradas en un solo paso, sin quedar con una
  reserva a medias si el pago falla. *Aceptación:* pago aprobado → 201 PAID; pago rechazado →
  402 y no queda ni reserva ni pago (RF-4, RF-5).
- **HU-3.** Como usuario con mala conexión, quiero reintentar una reserva sin que me cobren
  dos veces. *Aceptación:* misma clave de idempotencia → misma respuesta, un solo cobro (RF-6).
- **HU-4.** Como usuario, quiero cancelar una reserva y que se liberen las entradas, aunque
  apriete el botón dos veces. *Aceptación:* 200 las dos veces, el cupo se libera una vez (RF-9).
- **HU-5.** Como dueño del sistema, quiero que la última entrada no se venda dos veces aunque
  lleguen dos pedidos al mismo tiempo. *Aceptación:* una 201 y la otra 409, nunca ambas (RF-7).
- **HU-6.** Como admin, quiero crear conciertos y cerrar las reservas de los que ya pasaron.
  *Aceptación:* alta 201; completar después de la fecha → 200 COMPLETED (RF-1, RF-10).
- **HU-7.** Como usuario, quiero que nadie más pueda ver ni cancelar mis reservas.
  *Aceptación:* la reserva de otro usuario responde 404 (RF-12).

## Modelo y estados

- **Concierto:** artista del catálogo, título, fecha y hora, capacidad (entradas) y precio
  por entrada. La **disponibilidad** = capacidad − entradas de reservas `PAID` o `COMPLETED`.
- **Reserva:** concierto, usuario dueño, cantidad, importe (cantidad × precio), estado.
- **Pago:** uno por reserva, con su importe y estado (`APPROVED`, `REFUNDED`).
- **Estados de la reserva** (los de la consigna, en inglés como el resto de la API):
  `PENDING` (PENDIENTE) → `PAID` (PAGADA) → `CANCELLED` (CANCELADA) | `COMPLETED` (COMPLETADA).
  `PENDING` existe **solo dentro de la transacción** de alta: hacia afuera una reserva nace
  `PAID` o no existe (decisión 3). Ninguna otra transición es válida.

## Contrato

Todas bajo `/api/v1`; errores `{"detail": "..."}` (spec 001 RF-9); credencial Bearer (spec 002).

| Operación | Quién | Éxito | Errores propios |
|---|---|---|---|
| `GET /concerts` | Público | 200 lista (paginada con `skip`/`limit`, como el catálogo), ordenada por fecha | 400 |
| `GET /concerts/{id}` | Público | 200 | 400, 404 |
| `POST /concerts` | Admin | 201 | 400 (fecha pasada, artista inexistente, campos), 401, 403 |
| `POST /reservations` | Autenticado | 201 | 400, 401, 402 (pago rechazado), 404 (concierto), 409 (sin cupo; clave reusada con otro cuerpo) |
| `GET /reservations` | Autenticado | 200 sus reservas (admin: todas), paginadas | 400, 401 |
| `GET /reservations/{id}` | Dueño o admin | 200 | 400, 401, 404 (también si es de otro: no se revela que existe) |
| `POST /reservations/{id}/cancel` | Dueño | 200 | 400, 401, 404, 409 (estado o fecha no lo permiten) |
| `POST /reservations/{id}/complete` | Admin | 200 | 400, 401, 403, 404, 409 |

- **Concierto (respuesta):** `ConcertId`, `ArtistId`, `ArtistName`, `Title`, `StartsAt` (fecha y
  hora ISO 8601 en UTC), `Capacity`, `Price`, `Available`.
- **Concierto (alta):** `ArtistId` (debe existir), `Title` (1–160), `StartsAt` (futuro; ISO 8601
  **con zona explícita**, `Z` o `±hh:mm`: sin zona → 400),
  `Capacity` (entero 1–100000), `Price` (número ≥ 0 con hasta 2 decimales).
- **Reserva (respuesta):** `ReservationId`, `ConcertId`, `Quantity`, `Amount`, `Status`,
  `CreatedAt`. Nunca expone el usuario dueño de otra persona ni datos del pago interno.
- **Reserva (alta):** cuerpo `{ "ConcertId", "Quantity" }` (1–10) y header **`Idempotency-Key`**
  obligatorio (8 a 100 caracteres). Cualquier otro campo del cuerpo → 400 (incluido `Status`:
  el estado **nunca** lo manda el cliente).

## Requisitos funcionales (en EARS)

**Conciertos y disponibilidad**

- **RF-1:** CUANDO un admin da de alta un concierto válido, EL SISTEMA responde 201; SI la fecha
  no es futura o el artista no existe, ENTONCES 400 que nombra el campo.
- **RF-2:** EL SISTEMA calcula la disponibilidad de un concierto como su capacidad menos las
  entradas de sus reservas `PAID` y `COMPLETED`, en el momento de la consulta; ningún campo
  guarda la disponibilidad.

**Reserva y pago**

- **RF-3:** SI el concierto ya empezó (su `StartsAt` no es futuro), ENTONCES EL SISTEMA rechaza
  la reserva con 400 y no cobra nada.
- **RF-4:** CUANDO un usuario autenticado reserva `Quantity` entradas de un concierto con
  disponibilidad suficiente, EL SISTEMA, **en una sola transacción**, crea la reserva, cobra
  `Quantity × Price` al pago simulado, registra el pago y deja la reserva `PAID`; responde 201.
- **RF-5:** SI el pago es rechazado o falla en cualquier punto de la transacción, ENTONCES EL
  SISTEMA deshace todo (rollback): no queda reserva ni pago, la disponibilidad no cambia, y
  responde 402 (pago rechazado) o 500 (error inesperado).
- **RF-6:** CUANDO llega una reserva con un `Idempotency-Key` que **ese usuario** ya usó con el
  mismo cuerpo (mismo `ConcertId` y `Quantity`), EL SISTEMA responde 201 con **esa misma
  reserva en su estado actual** (mismo `ReservationId`), sin crear otra ni cobrar de nuevo; SI
  la clave ya se usó con **otro** cuerpo, ENTONCES 409. Esto vale también para pedidos
  **simultáneos** con la misma clave: exactamente uno crea y cobra, el otro recibe la misma
  reserva. La clave se guarda con la reserva, única por usuario y sin vencimiento. Un intento
  cuyo pago fue rechazado no "gasta" la clave: no quedó nada registrado (RF-5).
- **RF-7:** CUANDO dos o más reservas compiten por las mismas entradas, EL SISTEMA nunca vende
  más entradas que la capacidad: si no alcanzan para todas, las que no entran reciben 409 y no
  se cobran. Una reserva solo usa el cupo de una cancelación ya confirmada.
- **RF-8:** SI `Quantity` supera la disponibilidad, ENTONCES EL SISTEMA responde 409 con un
  `detail` que informa cuántas entradas quedan, y no cobra nada.

**Ciclo de vida**

- **RF-9:** CUANDO el dueño cancela una reserva `PAID` de un concierto que todavía no empezó,
  EL SISTEMA, en una transacción, la pasa a `CANCELLED`, registra el reembolso del pago
  (`REFUNDED`) y libera sus entradas (por RF-2); responde 200 con la reserva. CUANDO se cancela
  una reserva que ya está `CANCELLED`, EL SISTEMA responde 200 con la misma reserva sin cambiar
  nada (idempotente). SI está `COMPLETED` o el concierto ya empezó, ENTONCES 409.
- **RF-10:** CUANDO un admin completa una reserva `PAID` de un concierto que ya empezó, EL
  SISTEMA la pasa a `COMPLETED` (200). CUANDO la reserva ya está `COMPLETED`, responde 200 sin
  cambios (idempotente, como cancelar: repetir una acción ya hecha no es una transición nueva).
  SI la reserva está `CANCELLED`, o el concierto no empezó, ENTONCES 409.
- **RF-11:** EL SISTEMA solo admite las transiciones `PENDING → PAID`, `PAID → CANCELLED` y
  `PAID → COMPLETED`; cualquier otra (p. ej. `PAID → PENDING`, `CANCELLED → PAID`,
  `COMPLETED → CANCELLED`) se rechaza con 409. El estado cambia **solo** por estas acciones del
  servidor, nunca por un valor enviado por el cliente. La máquina de estados es una función pura
  que se prueba con **todos** los pares inválidos (incluido `PAID → PENDING`, que ninguna
  operación de la API pide); por HTTP se prueban los alcanzables.
- **RF-12:** CUANDO un usuario consulta reservas, EL SISTEMA le muestra solo las suyas (el admin
  ve todas); la reserva de otro usuario responde 404.
- **RF-13:** CUANDO se consulta la disponibilidad mientras una reserva está en curso (su
  transacción abierta), EL SISTEMA responde con el estado **confirmado**: no ve la reserva a
  medio hacer. El test lo verifica deteniendo el pago simulado en una barrera que controla el
  propio test (sin `sleep`).

**Integridad con el catálogo y pendiente del TP-1**

- **RF-14:** SI se intenta borrar un artista que tiene conciertos, ENTONCES EL SISTEMA responde
  409 y no borra nada (extiende la regla de la spec 001 RF-12, que solo contaba álbumes).
- **RF-15:** CUANDO llegan dos modificaciones simultáneas del mismo recurso del catálogo, EL
  SISTEMA responde 200 a las dos y el recurso queda con los valores de **una** de ellas completa
  (nunca una mezcla de campos ni un 500). Cubre el pendiente de `001/validate.md`.

## Requisitos no funcionales

- **RNF-1:** La reserva, el cobro y el registro del pago ocurren en la **misma** transacción de
  base de datos; la cancelación y el reembolso, también.
- **RNF-2:** El control de concurrencia no depende de tiempos (`sleep`) ni de la suerte: el
  test de concurrencia lanza los pedidos a la vez y verifica el invariante (vendidas ≤ capacidad).
- **RNF-3:** El pago simulado es una dependencia **inyectable**: los tests reemplazan su
  implementación para forzar un rechazo o un error; no hay un flag de "fallar" en producción.
- **RNF-4:** Las tablas nuevas se crean con una **migración versionada en código** que corre al
  abrir la base, idempotente (`IF NOT EXISTS`); la base template versionada no se modifica.
- **RNF-5:** Todo valor viaja como parámetro (como la spec 003 RNF-3).
- **RNF-6:** El contrato del TP-5 cubre las operaciones nuevas; cobertura ≥ 75/75; gates (y
  `gates` en CI) en verde; el trabajo entra por la rama `tp-4-reservas` y un PR.

## Casos límite

| # | Situación | Esperado |
|---|---|---|
| 1 | Dos reservas simultáneas por la última entrada | Una 201 y la otra 409; nunca ambas |
| 2 | El pago falla a mitad de la transacción | Rollback: sin reserva y sin pago; disponibilidad igual |
| 3 | Reintento con la misma `Idempotency-Key` y el mismo cuerpo | Misma respuesta (201, misma reserva); un solo cobro |
| 4 | Cancelar dos veces | 200 las dos; el cupo se libera una sola vez |
| 5 | Reserva para un concierto que ya empezó | 400 |
| 6 | Más entradas que las disponibles | 409 con las que quedan en el `detail` |
| 7 | Transición inválida (`PAID → PENDING`, completar una cancelada, cancelar una completada) | 409 |
| 8 | Disponibilidad consultada durante una reserva en curso | Responde el estado confirmado |
| 9 | `Status` en el cuerpo de la reserva | 400 (campo desconocido) |
| 10 | Sin `Idempotency-Key` o con menos de 8 caracteres | 400 |
| 11 | Misma clave, otro cuerpo | 409 |
| 12 | Misma clave usada por **otro** usuario | Son reservas independientes (la clave es por usuario) |
| 13 | Muchas reservas simultáneas (más pedidos que entradas) | Vendidas = capacidad exacta; el resto 409 |
| 14 | Ver o cancelar la reserva de otro usuario | 404 |
| 15 | Cancelar después de que empezó el concierto | 409 |
| 16 | Completar antes de que empiece el concierto | 409 |
| 17 | Viewer intenta crear un concierto o completar una reserva | 403 |
| 18 | Concierto inexistente al reservar | 404 |
| 19 | `Quantity` 0, 11 o no entero | 400 |
| 20 | Pago con error inesperado (no un rechazo) | 500 y rollback igual que el caso 2 |
| 21 | Dos pedidos **simultáneos** con la misma `Idempotency-Key` | Una reserva y un cobro; los dos reciben la misma |
| 22 | Reintento de una reserva ya cancelada (misma clave y cuerpo) | 201 con la reserva en estado `CANCELLED`; sin cobro nuevo |
| 23 | Completar dos veces | 200 las dos, sin cambios la segunda |
| 24 | `StartsAt` sin zona horaria | 400 |
| 25 | Concierto con `Price` 0 | Reserva `PAID` con `Amount` 0 y un pago de 0 |
| 26 | Borrar un artista con conciertos (y sin álbumes) | 409 |
| 27 | Dos `PATCH` simultáneos al mismo artista | 200 y 200; queda uno de los dos entero |

## Fuera de alcance

- Pasarela de pago real; reservas recurrentes; notificaciones.
- Modificar o borrar conciertos; elegir butacas numeradas; vencimiento de reservas pendientes
  (no existen: decisión 3).
- Completar reservas automáticamente al pasar la fecha (lo hace un admin).

## Criterios de finalización

- Cada RF y cada caso límite con test automatizado; el de concurrencia sin `sleep`.
- Gates locales y `gates` del PR en verde; PR mergeado por el usuario.

## Decisiones de la entrevista (16/11)

1. **Recurso:** entradas para conciertos de artistas del catálogo.
2. **Tablas:** migración versionada en código al abrir la base (`IF NOT EXISTS`); template intacto.
3. **Flujo:** una operación atómica (reservar = pagar) con `Idempotency-Key` para reintentos.
4. **Roles:** el usuario reserva, ve y cancela lo suyo; el admin crea conciertos y completa.
5. Por defecto (avisado en la entrevista): precio por entrada en el concierto; 1–10 entradas
   por reserva; `Idempotency-Key` obligatoria y por usuario; reembolso simulado al cancelar;
   402 para pago rechazado; nombres de campos en PascalCase como el catálogo y estados en
   inglés como el resto de la API; la reserva de otro usuario responde 404 (no 403) para no
   revelar que existe.

Correcciones aprobadas tras clarify ronda 1 (A1–A4, K1–K2, C1–C2, T1–T2, R1): `StartsAt` con
zona explícita; reintento = misma reserva en su estado actual; clave única por usuario también
ante pedidos simultáneos; precio 0 con pago de 0; artista con conciertos no se borra (RF-14);
pendiente del TP-1 cubierto (RF-15); completar idempotente; cupo liberado solo tras confirmar la
cancelación; máquina de estados como función pura con todos los pares; barrera determinista
para RF-13; HU-1 y HU-7 cubren RF-12 y RF-13.

## Dudas abiertas

- Ninguna.
