// Aqui la db. creo que es obvio no?

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './env.js';

const dbDir = path.dirname(config.DB_FILE);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(config.DB_FILE);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS alumno (
    dni INTEGER PRIMARY KEY NOT NULL UNIQUE,
    nombre_completo TEXT NOT NULL,
    pin TEXT NOT NULL DEFAULT '0000',
    fecha_registro DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cuenta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dni_alumno INTEGER NOT NULL,
    saldo REAL NOT NULL DEFAULT 0.0,
    fecha_registro DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (dni_alumno) REFERENCES alumno(dni) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tarjeta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL UNIQUE,
    uid_hardware TEXT,
    cuenta_id INTEGER NOT NULL,
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado INTEGER NOT NULL DEFAULT 0,
    activa INTEGER NOT NULL DEFAULT 1,
    fecha_registro DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (cuenta_id) REFERENCES cuenta(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transacciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER,
    tarjeta_uid TEXT,
    monto REAL NOT NULL,
    estado TEXT NOT NULL,
    saldo_restante REAL,
    fecha_registro DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (cuenta_id) REFERENCES cuenta(id) ON DELETE SET NULL
  );
`);