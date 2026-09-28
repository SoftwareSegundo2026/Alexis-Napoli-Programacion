# Cuestionario múltiple choice — Backend
## Napoli

Cada pregunta vale 1 punto (total 10).
Al finalizar, se realizarán preguntas orales sobre lo respondido.
En algunas preguntas ninguna opción es correcta: marcá 'Ninguna de las anteriores' y justificá.

**1.** ¿Qué es el "activity logging" (tabla `Activity`) y para qué sirve registrar cada operación?

[ ] A) Es la tabla donde se guardan las imágenes.
[ ] B) Guarda solo los errores que tira el servidor.
[ ] C) Es una bitácora o auditoría que guarda quién hizo qué y cuándo; sirve para rastrear cambios y detectar errores.
[ ] D) Borra el historial para que nadie vea qué pasó.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**2.** ¿Por qué la tabla de posiciones de un torneo debe CALCULARSE a partir de los partidos y no guardarse "a mano"? ¿Qué reglas usa?

[ ] A) Se calcula sumando 1 punto por partido jugado, ganado o perdido.
[ ] B) La define el club más grande del torneo.
[ ] C) Se guarda a mano una sola vez y nunca cambia.
[ ] D) Se calcula desde los partidos (3 puntos por victoria, 1 por empate) para no quedar desactualizada.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**3.** ¿Por qué el token JWT tiene una fecha de expiración y qué riesgo se reduce con una expiración corta?

[ ] A) Aumenta el riesgo de robo.
[ ] B) Para que un token robado no pueda usarse indefinidamente; una vida corta limita la ventana de riesgo.
[ ] C) Hace que el token sea válido para siempre.
[ ] D) Es solo estética, no afecta la seguridad.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**4.** ¿Qué hace `get_current_active_user` que no hace `get_current_user`, y por qué existen ambos?

[ ] A) Crea un usuario nuevo en cada petición.
[ ] B) Es igual que get_current_user, no agrega nada.
[ ] C) Bloquea a los administradores para que no puedan entrar.
[ ] D) Es una función que genera un token nuevo en cada petición que recibe.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**5.** ¿Por qué las contraseñas se guardan "hasheadas" (bcrypt) y nunca en texto plano?

[ ] A) Se guardan en texto plano para poder recuperarlas.
[ ] B) No hace falta protegerlas porque la base es privada.
[ ] C) Se encriptan con una clave que cualquiera puede leer.
[ ] D) Se guardan con un hash irreversible (bcrypt); al loguear se compara el hash, no se descifra.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**6.** ¿Qué es CORS y por qué el backend debe configurarlo?

[ ] A) Un tipo de base de datos.
[ ] B) Un virus que roba datos del navegador.
[ ] C) Es una librería que encripta las respuestas antes de enviarlas al navegador.
[ ] D) Permite que cualquier sitio acceda sin restricciones.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**7.** ¿Qué es una API REST y para qué sirve en un proyecto como la tienda de música (FastAPI Chinook)?

[ ] A) Un conjunto de endpoints que permiten a otras aplicaciones comunicarse con el servidor por HTTP e intercambiar datos (JSON), sin exponer la base directamente.
[ ] B) Una librería que encripta las contraseñas de los usuarios.
[ ] C) Un lenguaje de programación para escribir la interfaz de usuario.
[ ] D) Una base de datos relacional que guarda la información de la aplicación.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**8.** ¿Por qué SQLite está bien para desarrollo/ejemplos pero no se recomienda para alta concurrencia? ¿Qué alternativa se plantea?

[ ] A) SQLite es un archivo y no soporta bien alta concurrencia; para producción se migra a PostgreSQL.
[ ] B) SQLite es lo mejor para producción con muchos usuarios.
[ ] C) PostgreSQL es un archivo más simple que SQLite.
[ ] D) No hay diferencia entre ambos.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**9.** ¿Por qué se recomienda guardar el token del lado del cliente de forma segura y NO enviarlo a todos lados? ¿Dónde NO debe ir?

[ ] A) Se guarda en texto plano y se publica en el repositorio.
[ ] B) No importa dónde se guarde el token.
[ ] C) Debe ir en la URL para que sea fácil de compartir.
[ ] D) No debe ir en la URL, en logs ni en el código compartido; viaja solo en el header de las peticiones protegidas.
[ ] Ninguna de las anteriores — Justifique: _______________________________

**10.** ¿Por qué las fechas se guardan en formato ISO (YYYY-MM-DD) y por qué importa respetarlo en las respuestas?

[ ] A) Se guardan como texto libre para que cada uno elija.
[ ] B) Cada respuesta puede usar un formato distinto sin problema.
[ ] C) El formato ISO es igual que MM/DD/AAAA.
[ ] D) Se guardan como texto libre para respetar el formato de fecha de cada país.
[ ] Ninguna de las anteriores — Justifique: _______________________________
