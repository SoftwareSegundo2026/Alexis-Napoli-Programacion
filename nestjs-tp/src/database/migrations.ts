/**
 * Migración en código de la spec 004 (RNF-4): crea las tablas de conciertos,
 * reservas y pagos al abrir la base. Es idempotente (`IF NOT EXISTS`): correrla
 * en una base que ya las tiene no cambia nada. La base template versionada no se
 * modifica; el esquema nuevo queda a la vista en este archivo (y en su diff).
 */
export const MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS Concert (
  ConcertId INTEGER PRIMARY KEY AUTOINCREMENT,
  ArtistId  INTEGER NOT NULL REFERENCES Artist (ArtistId),
  Title     NVARCHAR(160) NOT NULL,
  StartsAt  TEXT NOT NULL,                 -- ISO 8601 en UTC
  Capacity  INTEGER NOT NULL CHECK (Capacity > 0),
  Price     NUMERIC(10, 2) NOT NULL CHECK (Price >= 0)
);
CREATE INDEX IF NOT EXISTS IFK_ConcertArtistId ON Concert (ArtistId);

CREATE TABLE IF NOT EXISTS Reservation (
  ReservationId  INTEGER PRIMARY KEY AUTOINCREMENT,
  ConcertId      INTEGER NOT NULL REFERENCES Concert (ConcertId),
  UserId         INTEGER NOT NULL REFERENCES User (UserId),
  Quantity       INTEGER NOT NULL CHECK (Quantity > 0),
  Amount         NUMERIC(10, 2) NOT NULL,
  Status         TEXT NOT NULL CHECK (Status IN ('PENDING', 'PAID', 'CANCELLED', 'COMPLETED')),
  IdempotencyKey TEXT NOT NULL,
  CreatedAt      TEXT NOT NULL
);
-- RF-6: la clave de idempotencia es única POR USUARIO.
CREATE UNIQUE INDEX IF NOT EXISTS UX_ReservationUserKey ON Reservation (UserId, IdempotencyKey);
-- RF-2: la disponibilidad suma las reservas de un concierto según su estado.
CREATE INDEX IF NOT EXISTS IX_ReservationConcertStatus ON Reservation (ConcertId, Status);

CREATE TABLE IF NOT EXISTS Payment (
  PaymentId     INTEGER PRIMARY KEY AUTOINCREMENT,
  ReservationId INTEGER NOT NULL UNIQUE REFERENCES Reservation (ReservationId),
  Amount        NUMERIC(10, 2) NOT NULL,
  Status        TEXT NOT NULL CHECK (Status IN ('APPROVED', 'REFUNDED')),
  CreatedAt     TEXT NOT NULL
);
`;

/** Lo único que se usa de la conexión de better-sqlite3 para migrar. */
export interface SqlExecutor {
  exec(sql: string): unknown;
}

export function runMigrations(database: SqlExecutor): void {
  database.exec(MIGRATIONS_SQL);
}
