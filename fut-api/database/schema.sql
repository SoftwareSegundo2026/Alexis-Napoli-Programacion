-- ============================================================
-- SCHEMA: Fut-API
-- Convención: todas las tablas en snake_case, igual que los JSON.
-- Orden de creación: padres antes que hijos (respeta FKs).
-- ============================================================

PRAGMA foreign_keys = ON;  -- SQLite ignora las FKs si no se activa esto explícitamente

-- ---------- 1. GEOGRAFÍA ----------

CREATE TABLE IF NOT EXISTS paises (
    id          INTEGER PRIMARY KEY,   -- usamos el mismo id que trae el JSON, no autoincrement
    nombre      TEXT NOT NULL,
    codigo_iso  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provincias (
    id        INTEGER PRIMARY KEY,
    nombre    TEXT NOT NULL,
    pais_id   INTEGER NOT NULL,
    FOREIGN KEY (pais_id) REFERENCES paises(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ciudades (
    id            INTEGER PRIMARY KEY,
    nombre        TEXT NOT NULL,
    provincia_id  INTEGER NOT NULL,
    FOREIGN KEY (provincia_id) REFERENCES provincias(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS clubes (
    id         INTEGER PRIMARY KEY,
    nombre     TEXT NOT NULL,
    ciudad_id  INTEGER NOT NULL,
    fundacion  INTEGER,                -- año, ej: 1905
    estadio    TEXT,
    capacidad  INTEGER,
    FOREIGN KEY (ciudad_id) REFERENCES ciudades(id) ON DELETE RESTRICT
);

-- ---------- 2. COMPETENCIA ----------

CREATE TABLE IF NOT EXISTS ligas (
    id         INTEGER PRIMARY KEY,
    nombre     TEXT NOT NULL,
    pais_id    INTEGER NOT NULL,
    categoria  INTEGER NOT NULL,       -- 0 = copa, 1 = primera, 2 = segunda (ver 'tipo')
    tipo       TEXT NOT NULL CHECK (tipo IN ('liga', 'copa')),
    FOREIGN KEY (pais_id) REFERENCES paises(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS temporadas (
    id      INTEGER PRIMARY KEY,
    nombre  TEXT NOT NULL              -- ej: "2024"
);

CREATE TABLE IF NOT EXISTS torneos (
    id             INTEGER PRIMARY KEY,
    nombre         TEXT NOT NULL,
    liga_id        INTEGER NOT NULL,
    temporada_id   INTEGER NOT NULL,
    fecha_inicio   TEXT NOT NULL,      -- ISO 'YYYY-MM-DD'
    fecha_fin      TEXT,               -- NULL = torneo todavía en curso
    FOREIGN KEY (liga_id)      REFERENCES ligas(id)      ON DELETE RESTRICT,
    FOREIGN KEY (temporada_id) REFERENCES temporadas(id) ON DELETE RESTRICT
);

-- ---------- 3. NÚCLEO: PARTICIPACIÓN CLUB-TORNEO ----------

-- 'equipos' resuelve la relación N:M entre clubes y torneos.
-- Partidos, contratos y campeonatos_ganados referencian a 'equipos', no a 'clubes'.
CREATE TABLE IF NOT EXISTS equipos (
    id          INTEGER PRIMARY KEY,
    club_id     INTEGER NOT NULL,
    torneo_id   INTEGER NOT NULL,
    grupo       TEXT,                 
    FOREIGN KEY (club_id)   REFERENCES clubes(id)  ON DELETE RESTRICT,
    FOREIGN KEY (torneo_id) REFERENCES torneos(id) ON DELETE RESTRICT
);

-- ---------- 4. JUGADORES Y CONTRATOS ----------

CREATE TABLE IF NOT EXISTS jugadores (
    id                INTEGER PRIMARY KEY,
    nombre            TEXT NOT NULL,
    apellido          TEXT NOT NULL,
    fecha_nacimiento  TEXT NOT NULL,   -- ISO 'YYYY-MM-DD'
    nacionalidad_id   INTEGER NOT NULL,
    posicion          TEXT NOT NULL CHECK (posicion IN ('ARQ', 'DEF', 'MED', 'DEL')),
    FOREIGN KEY (nacionalidad_id) REFERENCES paises(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS contratos (
    id               INTEGER PRIMARY KEY,
    jugador_id       INTEGER NOT NULL,
    equipo_id        INTEGER NOT NULL,
    fecha_inicio     TEXT NOT NULL,
    fecha_fin        TEXT,             -- NULL = jugador activo en ese equipo
    precio_traspaso  INTEGER,          -- NULL = sin traspaso (ej: jugador formado en el club)
    FOREIGN KEY (jugador_id) REFERENCES jugadores(id) ON DELETE RESTRICT,
    FOREIGN KEY (equipo_id)  REFERENCES equipos(id)   ON DELETE RESTRICT
);

-- ---------- 5. PARTIDOS ----------

CREATE TABLE IF NOT EXISTS partidos (
    id                    INTEGER PRIMARY KEY,
    torneo_id             INTEGER NOT NULL,
    equipo_local_id       INTEGER NOT NULL,
    equipo_visitante_id   INTEGER NOT NULL,
    fecha                 TEXT NOT NULL,
    goles_local           INTEGER NOT NULL,
    goles_visitante       INTEGER NOT NULL,
    FOREIGN KEY (torneo_id)           REFERENCES torneos(id) ON DELETE RESTRICT,
    FOREIGN KEY (equipo_local_id)     REFERENCES equipos(id) ON DELETE RESTRICT,
    FOREIGN KEY (equipo_visitante_id) REFERENCES equipos(id) ON DELETE RESTRICT
);

-- ---------- 6. CAMPEONATOS GANADOS ----------

CREATE TABLE IF NOT EXISTS campeonatos_ganados (
    id          INTEGER PRIMARY KEY,
    equipo_id   INTEGER NOT NULL,
    torneo_id   INTEGER NOT NULL,
    posicion    TEXT NOT NULL CHECK (posicion IN ('CAMPEON', 'SUBCAMPEON', 'TERCERO')),
    FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE RESTRICT,
    FOREIGN KEY (torneo_id) REFERENCES torneos(id) ON DELETE RESTRICT
);

-- ---------- ÍNDICES para los filtros más usados por la API ----------

CREATE INDEX IF NOT EXISTS idx_provincias_pais        ON provincias(pais_id);
CREATE INDEX IF NOT EXISTS idx_ciudades_provincia      ON ciudades(provincia_id);
CREATE INDEX IF NOT EXISTS idx_clubes_ciudad           ON clubes(ciudad_id);
CREATE INDEX IF NOT EXISTS idx_ligas_pais              ON ligas(pais_id);
CREATE INDEX IF NOT EXISTS idx_torneos_liga            ON torneos(liga_id);
CREATE INDEX IF NOT EXISTS idx_torneos_temporada       ON torneos(temporada_id);
CREATE INDEX IF NOT EXISTS idx_equipos_club            ON equipos(club_id);
CREATE INDEX IF NOT EXISTS idx_equipos_torneo          ON equipos(torneo_id);
CREATE INDEX IF NOT EXISTS idx_jugadores_nacionalidad  ON jugadores(nacionalidad_id);
CREATE INDEX IF NOT EXISTS idx_jugadores_posicion      ON jugadores(posicion);
CREATE INDEX IF NOT EXISTS idx_contratos_jugador       ON contratos(jugador_id);
CREATE INDEX IF NOT EXISTS idx_contratos_equipo        ON contratos(equipo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_torneo         ON partidos(torneo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_local          ON partidos(equipo_local_id);
CREATE INDEX IF NOT EXISTS idx_partidos_visitante      ON partidos(equipo_visitante_id);
CREATE INDEX IF NOT EXISTS idx_campeonatos_equipo      ON campeonatos_ganados(equipo_id);
CREATE INDEX IF NOT EXISTS idx_campeonatos_torneo      ON campeonatos_ganados(torneo_id);
