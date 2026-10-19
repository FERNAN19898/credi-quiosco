import { db } from '../config/database.js';
import { TarjetaConCuenta, TarjetaResumen } from '../types/index.js';

export const cardRepository = {
  findByUid(uid: string): TarjetaConCuenta | undefined {
    const cleanUid = uid.trim().toUpperCase();
    const stmt = db.prepare(`
      SELECT t.id, t.uid, t.cuenta_id, t.intentos_fallidos, t.bloqueado, t.activa,
             c.saldo, c.dni_alumno,
             a.nombre_completo, a.dni, a.pin
      FROM tarjeta t
      JOIN cuenta c ON c.id = t.cuenta_id
      JOIN alumno a ON a.dni = c.dni_alumno
      WHERE UPPER(t.uid) = ?
    `);
    const result = stmt.get(cleanUid);
    return result as TarjetaConCuenta | undefined;
  },

  create({ uid, cuenta_id }: { uid: string; cuenta_id: number }) {
    const cleanUid = uid.trim().toUpperCase();

    db.prepare('DELETE FROM tarjeta WHERE UPPER(uid) = ?').run(cleanUid);

    const stmt = db.prepare(`
      INSERT INTO tarjeta (uid, cuenta_id, activa, bloqueado, intentos_fallidos)
      VALUES (?, ?, 1, 0, 0)
    `);
    const result = stmt.run(cleanUid, cuenta_id);
    return {
      id: Number(result.lastInsertRowid),
      uid: cleanUid,
      cuenta_id
    };
  },

  incrementFailedAttempts(uid: string): void {
    const cleanUid = uid.trim().toUpperCase();
    const stmt = db.prepare('UPDATE tarjeta SET intentos_fallidos = intentos_fallidos + 1 WHERE UPPER(uid) = ?');
    stmt.run(cleanUid);
  },

  lockCard(uid: string): void {
    const cleanUid = uid.trim().toUpperCase();
    const stmt = db.prepare('UPDATE tarjeta SET bloqueado = 1 WHERE UPPER(uid) = ?');
    stmt.run(cleanUid);
  },

  resetAttempts(uid: string): void {
    const cleanUid = uid.trim().toUpperCase();
    const stmt = db.prepare('UPDATE tarjeta SET intentos_fallidos = 0 WHERE UPPER(uid) = ?');
    stmt.run(cleanUid);
  },

  unlockAll(): void {
    const stmt = db.prepare('UPDATE tarjeta SET bloqueado = 0, intentos_fallidos = 0');
    stmt.run();
  },

  listAll(): TarjetaResumen[] {
    const stmt = db.prepare(`
      SELECT t.id, t.uid, t.cuenta_id, t.intentos_fallidos, t.bloqueado, t.activa,
             a.nombre_completo, c.saldo
      FROM tarjeta t
      JOIN cuenta c ON c.id = t.cuenta_id
      JOIN alumno a ON a.dni = c.dni_alumno
    `);
    return stmt.all() as unknown as TarjetaResumen[];
  }
};
