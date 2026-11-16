# Clarify 002 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 002-auth-roles`).
> Revisión contra `spec.md` (borrador del 16/11), `docs/constitution.md` y los 10 casos
> límite obligatorios de `consignas/TP2-autenticacion-y-roles.md`.

## Ronda 1 — 16/11

### Casos límite obligatorios de la consigna

| # consigna | Situación | ¿Está en la spec? |
|---|---|---|
| 1 | Contraseña incorrecta → 401 genérico | Sí: RF-2 + caso 1 |
| 2 | Usuario inexistente → mismo 401 | Sí: RF-2 + caso 2 |
| 3 | Deshabilitado con credencial válida → 401/403 | Sí: RF-4 + caso 3 |
| 4 | Credencial vencida → 401 | Sí: RF-3 + caso 4 |
| 5 | Firma inválida / editada → 401 | Sí: RF-3 + caso 5 |
| 6 | Sin `Authorization` → 401 | Sí: RF-3 + caso 6 |
| 7 | Rol insuficiente → 403 | Sí: RF-6 + caso 7 |
| 8 | Username o email repetido → 409 | Sí: RF-9 + caso 8 |
| 9 | Sin hash ni `iat`/`exp` en respuestas | Sí: RNF-1 + caso 9 |
| 10 | Dos logins simultáneos | Sí: caso 10 |

Los 10 están cubiertos. Detecciones adicionales:

### 1. Ambigüedades

- **A1.** RF-9 compara `username` y `email` sin distinguir mayúsculas para detectar
  duplicados, pero RF-1 no dice si el **login** distingue mayúsculas en el `username`
  (¿`Admin` puede iniciar sesión como `admin`?), ni cómo se guardan (tal como vienen o
  normalizados).
- **A2.** RF-11: no dice qué pasa si un admin envía para sí mismo **el valor que ya
  tiene** (`is_admin: true` siendo admin, o `disabled: false` estando habilitado).
  Leído literal, "intenta cambiar su propio rol" podría dar 403 aunque no cambie nada.
- **A3.** RF-3 y RF-4 fijan el código (401) pero no el **mensaje**, y no aclaran si una
  credencial vencida, una alterada y la de un usuario deshabilitado se distinguen en
  la respuesta. Tampoco se dice si la respuesta 401 anuncia el esquema esperado.
- **A4.** Caso límite 12: no se define si el prefijo `Bearer` del header distingue
  mayúsculas (`bearer <credencial>`).

### 2. Contradicciones

- **K1.** El caso límite 15 ("sin credencial y con JSON malformado en una escritura →
  401") choca con RF-5 para el **login**, que es una escritura pública: aplicado
  literal, un login con JSON malformado daría 401 en lugar de 400 (RF-2).

### 3. Casos límite no cubiertos

- **C1.** Credencial **inválida o vencida enviada a un endpoint público** (por ejemplo,
  `GET /artists` con un token alterado): no se define si se ignora o si da 401.
- **C2.** **Dos altas simultáneas** con el mismo `username` (o `email`): no se define
  el resultado (¿pueden quedar dos usuarios iguales?, ¿un 500?).

### 4. Conflictos con la constitution / reglas no comprobables

- **T1.** RNF-4 ("la comparación no revela por el tiempo de respuesta si el usuario
  existe") no se puede comprobar con un test automatizado tal como está escrito:
  medir tiempos es no determinista.
- Principio 5 (contraseña nunca en respuestas, hash, escritura protegida por defecto):
  cubierto por RNF-1, RF-9 y RF-5/RF-6. Sin conflictos.

### 5. RF sin criterio de aceptación / dudas abiertas

- **R1.** RF-12 (reemplazo de la clave fija) y RF-13 (documentación con `Bearer`) no
  aparecen en ninguna historia de usuario con criterio de aceptación.
- No quedan `[NECESITA ACLARACIÓN]`.

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A4, K1, C1–C2, T1, R1)

## Ronda 2 — 16/11

El usuario aprobó las resoluciones propuestas y se incorporaron a `spec.md`:

| Detección | Dónde quedó resuelta |
|---|---|
| A1 | RF-1 (login sin distinguir mayúsculas ni espacios en el `username`) + RF-9 (se guarda recortado) + caso 21 |
| A2 | RF-11 (reenviar el valor propio → 200) + caso 14 |
| A3 | RF-3 (`Could not validate credentials`), RF-4 (`Inactive user`), contrato (`WWW-Authenticate: Bearer`) + caso 24. Por coherencia también se fijaron los mensajes 403 (RF-6, RF-11). |
| A4 | Contrato (`Bearer` sin distinguir mayúsculas) + caso 12 |
| K1 | RF-2 (JSON malformado en el login → 400) + caso 15 acotado a escrituras protegidas + caso 20 |
| C1 | Contrato (en lo público la credencial se ignora) + caso 22 |
| C2 | RF-9 (altas simultáneas → una 201 y otra 409) + caso 23 |
| T1 | RNF-4 reescrito como comportamiento comprobable (se verifica contra un hash de referencia) |
| R1 | HU-3 (la clave fija ya no da acceso) y HU-8 (documentación) + caso 25 |

Revisión completa de la spec modificada: los 10 casos de la consigna siguen cubiertos;
sin nuevas ambigüedades, contradicciones ni conflictos con la constitution; todos los
RF tienen criterio de aceptación en alguna HU; no quedan `[NECESITA ACLARACIÓN]`.

**VEREDICTO: APROBADA**
