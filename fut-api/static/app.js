/**
 * app.js — Mini web de consulta de Fut-API.
 */

// ---------- 1. Helpers ----------

/** Evita que un nombre con caracteres raros rompa el HTML al insertarlo. */
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

/** Formatea un número como moneda simple (sin decimales, con puntos de miles). */
function formatearMonto(valor) {
  if (valor === null || valor === undefined) return "—";
  return "$" + valor.toLocaleString("es-AR");
}

/** Las fechas ya vienen en formato ISO (YYYY-MM-DD) desde la API, se muestran tal cual. */
function formatearFecha(fecha) {
  return fecha || "—";
}

// ---------- 2. Configuración por recurso ----------

const CONFIG = {
  clubes: {
    titulo: "Clubes",
    endpointLista: "/clubes",
    endpointDetalle: (id) => `/clubes/${id}`,
    filtrar: (item, q) => item.nombre.toLowerCase().includes(q),
    itemLista: (item) => ({
      titulo: item.nombre,
      meta: item.estadio || "Sin estadio registrado",
    }),
    renderDetalle: renderDetalleClub,
  },

  jugadores: {
    titulo: "Jugadores",
    endpointLista: "/jugadores",
    endpointDetalle: (id) => `/jugadores/${id}`,
    filtrar: (item, q) =>
      `${item.nombre} ${item.apellido}`.toLowerCase().includes(q),
    itemLista: (item) => ({
      titulo: `${item.apellido}, ${item.nombre}`,
      meta: item.posicion,
    }),
    renderDetalle: renderDetalleJugador,
  },

  torneos: {
    titulo: "Torneos",
    endpointLista: "/torneos",
    endpointDetalle: (id) => `/torneos/${id}`,
    filtrar: (item, q) => item.nombre.toLowerCase().includes(q),
    itemLista: (item) => ({
      titulo: item.nombre,
      meta: formatearFecha(item.fecha_inicio),
    }),
    renderDetalle: renderDetalleTorneo,
  },
};

// ---------- 3. Estado de la pantalla ----------

const estado = {
  recursoActual: "clubes",
  itemsCargados: [], // la última lista que llegó de la API, sin filtrar
  idSeleccionado: null,
};

const elLista = document.getElementById("lista-resultados");
const elTituloLista = document.getElementById("titulo-lista");
const elBuscador = document.getElementById("buscador");
const elPanelDetalle = document.getElementById("panel-detalle");
const elPestanias = document.getElementById("pestanias");

/** Pide la lista completa del recurso actual a la API y la guarda en estado. */
async function cargarLista() {
  const config = CONFIG[estado.recursoActual];
  elLista.innerHTML = `<li class="estado-carga">Cargando…</li>`;

  try {
    const respuesta = await fetch(config.endpointLista);
    if (!respuesta.ok) {
      throw new Error(`La API respondió ${respuesta.status}`);
    }
    estado.itemsCargados = await respuesta.json();
    renderizarLista();
  } catch (error) {
    // Un error de red (servidor caído) o un status distinto de 2xx caen acá.
    // Mostramos el motivo en vez de dejar la lista vacía sin explicación.
    elLista.innerHTML = `<li class="lista__error">No se pudo cargar: ${escaparHtml(error.message)}</li>`;
  }
}

/** Vuelve a pintar la lista, aplicando el texto de búsqueda actual. */
function renderizarLista() {
  const config = CONFIG[estado.recursoActual];
  const textoBusqueda = elBuscador.value.trim().toLowerCase();

  const itemsFiltrados = textoBusqueda
    ? estado.itemsCargados.filter((item) => config.filtrar(item, textoBusqueda))
    : estado.itemsCargados;

  if (itemsFiltrados.length === 0) {
    elLista.innerHTML = `<li class="lista__vacio">Sin resultados.</li>`;
    return;
  }

  elLista.innerHTML = itemsFiltrados
    .map((item) => {
      const { titulo, meta } = config.itemLista(item);
      const activo = item.id === estado.idSeleccionado ? "lista__item--activo" : "";
      return `
        <li class="lista__item ${activo}" data-id="${item.id}" tabindex="0" role="button">
          <div class="lista__item-titulo">${escaparHtml(titulo)}</div>
          <div class="lista__item-meta">${escaparHtml(meta)}</div>
        </li>
      `;
    })
    .join("");
}

/** Pide el detalle de un item puntual y lo renderiza en el panel derecho. */
async function seleccionarItem(id) {
  estado.idSeleccionado = id;
  renderizarLista(); // para resaltar visualmente el item recién clickeado

  const config = CONFIG[estado.recursoActual];
  elPanelDetalle.innerHTML = `<div class="estado-carga">Cargando detalle…</div>`;

  try {
    const respuesta = await fetch(config.endpointDetalle(id));
    if (!respuesta.ok) {
      throw new Error(`La API respondió ${respuesta.status}`);
    }
    const detalle = await respuesta.json();
    elPanelDetalle.innerHTML = config.renderDetalle(detalle);
  } catch (error) {
    elPanelDetalle.innerHTML = `<div class="estado-error">No se pudo cargar el detalle: ${escaparHtml(error.message)}</div>`;
  }
}

/** Cambia de pestaña (clubes/jugadores/torneos): resetea todo y vuelve a cargar. */
function cambiarRecurso(nuevoRecurso) {
  estado.recursoActual = nuevoRecurso;
  estado.idSeleccionado = null;
  elBuscador.value = "";
  elTituloLista.textContent = CONFIG[nuevoRecurso].titulo;

  elPestanias.querySelectorAll(".pestania").forEach((boton) => {
    boton.classList.toggle("pestania--activa", boton.dataset.recurso === nuevoRecurso);
  });

  elPanelDetalle.innerHTML = `
    <div class="detalle-vacio">
      <span class="detalle-vacio__icono">📋</span>
      <p>Elegí un elemento de la lista para ver el detalle.</p>
    </div>
  `;

  cargarLista();
}

// ---------- Renderizado de detalle por recurso ----------

function renderDetalleClub(club) {
  const equiposHtml = club.equipos.length
    ? club.equipos
        .map(
          (eq) => `
        <li class="sublista__item">
          <div>
            <div class="sublista__item-principal">${escaparHtml(eq.torneo_nombre)}</div>
            <div class="sublista__item-secundario">${eq.grupo ? `Grupo ${escaparHtml(eq.grupo)}` : "Sin fase de grupos"}</div>
          </div>
        </li>
      `
        )
        .join("")
    : `<li class="sublista__item">Sin participaciones registradas.</li>`;

  return `
    <h2 class="detalle__titulo">${escaparHtml(club.nombre)}</h2>
    <p class="detalle__subtitulo">${escaparHtml(club.ciudad.nombre)}, ${escaparHtml(club.provincia.nombre)}, ${escaparHtml(club.pais.nombre)}</p>

    <div class="ficha">
      <div class="ficha__dato">
        <span class="ficha__dato-label">Fundación</span>
        <span class="ficha__dato-valor">${club.fundacion ?? "—"}</span>
      </div>
      <div class="ficha__dato">
        <span class="ficha__dato-label">Estadio</span>
        <span class="ficha__dato-valor">${escaparHtml(club.estadio) || "—"}</span>
      </div>
      <div class="ficha__dato">
        <span class="ficha__dato-label">Capacidad</span>
        <span class="ficha__dato-valor">${club.capacidad ? club.capacidad.toLocaleString("es-AR") : "—"}</span>
      </div>
    </div>

    <div class="seccion">
      <h3>Participaciones en torneos</h3>
      <ul class="sublista">${equiposHtml}</ul>
    </div>
  `;
}

function renderDetalleJugador(jugador) {
  const historialHtml = jugador.historial_contratos.length
    ? jugador.historial_contratos
        .map((c) => {
          const periodo = c.fecha_fin
            ? `${formatearFecha(c.fecha_inicio)} → ${formatearFecha(c.fecha_fin)}`
            : `${formatearFecha(c.fecha_inicio)} → Activo`;
          return `
            <li class="sublista__item">
              <div>
                <div class="sublista__item-principal">${escaparHtml(c.club.nombre)}</div>
                <div class="sublista__item-secundario">${escaparHtml(c.torneo.nombre)} · ${periodo}</div>
              </div>
              ${c.precio_traspaso ? `<span class="sublista__item-monto">${formatearMonto(c.precio_traspaso)}</span>` : ""}
            </li>
          `;
        })
        .join("")
    : `<li class="sublista__item">Sin contratos registrados.</li>`;

  return `
    <h2 class="detalle__titulo">${escaparHtml(jugador.nombre)} ${escaparHtml(jugador.apellido)}</h2>
    <p class="detalle__subtitulo">
      <span class="badge">${escaparHtml(jugador.posicion)}</span>
      &nbsp;${escaparHtml(jugador.nacionalidad.nombre)} · nacido el ${formatearFecha(jugador.fecha_nacimiento)}
    </p>

    <div class="seccion">
      <h3>Historial de contratos</h3>
      <ul class="sublista">${historialHtml}</ul>
    </div>
  `;
}

function renderDetalleTorneo(torneo) {
  const periodo = torneo.fecha_fin
    ? `${formatearFecha(torneo.fecha_inicio)} — ${formatearFecha(torneo.fecha_fin)}`
    : `Desde ${formatearFecha(torneo.fecha_inicio)} (en curso)`;

  const filasTabla = torneo.tabla_posiciones
    .map((fila, indice) => {
      const esPodio = indice < 3 ? "podio" : "";
      const nombreClub = fila.grupo
        ? `${escaparHtml(fila.club_nombre)} <span class="tabla-posiciones__grupo">(Grupo ${escaparHtml(fila.grupo)})</span>`
        : escaparHtml(fila.club_nombre);
      return `
        <tr class="${esPodio}">
          <td class="puesto">${indice + 1}</td>
          <td>${nombreClub}</td>
          <td class="pts">${fila.pts}</td>
          <td>${fila.pj}</td>
          <td>${fila.pg}</td>
          <td>${fila.pe}</td>
          <td>${fila.pp}</td>
          <td>${fila.gf}</td>
          <td>${fila.gc}</td>
          <td>${fila.dg > 0 ? "+" + fila.dg : fila.dg}</td>
        </tr>
      `;
    })
    .join("");

  const tablaHtml = torneo.tabla_posiciones.length
    ? `
      <div class="tabla-posiciones-wrap">
        <table class="tabla-posiciones">
          <thead>
            <tr>
              <th>#</th>
              <th>Club</th>
              <th>Pts</th>
              <th>PJ</th>
              <th>PG</th>
              <th>PE</th>
              <th>PP</th>
              <th>GF</th>
              <th>GC</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>${filasTabla}</tbody>
        </table>
      </div>
    `
    : `<p>Todavía no hay partidos jugados en este torneo.</p>`;

  return `
    <h2 class="detalle__titulo">${escaparHtml(torneo.nombre)}</h2>
    <p class="detalle__subtitulo">${escaparHtml(torneo.liga.nombre)} · ${escaparHtml(torneo.temporada.nombre)} · ${periodo}</p>

    <div class="seccion">
      <h3>Tabla de posiciones</h3>
      ${tablaHtml}
    </div>
  `;
}

// ---------- Eventos ----------

elPestanias.addEventListener("click", (evento) => {
  const boton = evento.target.closest(".pestania");
  if (boton) cambiarRecurso(boton.dataset.recurso);
});

elLista.addEventListener("click", (evento) => {
  const item = evento.target.closest(".lista__item");
  if (item) seleccionarItem(Number(item.dataset.id));
});

// Buscar con el teclado (Enter no hace falta, filtra en cada tecla).
elBuscador.addEventListener("input", renderizarLista);

// Primera carga al abrir la página.
cargarLista();