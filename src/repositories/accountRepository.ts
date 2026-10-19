import { db } from '../config/database.js';
import { CuentaDetallada } from '../types/index.js';

export const accountRepository = {
  findById(id: number): CuentaDetallada | undefined {
    const stmt = db.prepare(`
      SELECT c.id, c.dni_alumno as alumno_id, c.saldo, c.fecha_registro as created_at,
             a.nombre_completo, a.dni, a.pin
      FROM cuenta c
      JOIN alumno a ON a.dni = c.dni_alumno
      WHERE c.id = ?
    `);
    const result = stmt.get(id);
    return result as CuentaDetallada | undefined;
  },

  findByDni(dni: string | number): CuentaDetallada | undefined {
    const stmt = db.prepare(`
      SELECT c.id, c.dni_alumno as alumno_id, c.saldo, c.fecha_registro as created_at,
             a.nombre_completo, a.dni, a.pin
      FROM cuenta c
      JOIN alumno a ON a.dni = c.dni_alumno
      WHERE a.dni = ?
    `);
    const result = stmt.get(Number(dni));
    return result as CuentaDetallada | undefined;
  },

  updatePin(dni: string | number, pin: string): void {
    const stmt = db.prepare('UPDATE alumno SET pin = ? WHERE dni = ?');
    stmt.run(pin.trim(), Number(dni));
  },

  createWithAccount({ dni, nombre_completo, pin }: { dni: string | number; nombre_completo?: string; pin?: string }): CuentaDetallada {
    const cleanDni = Number(dni);
    const nombre = nombre_completo ? nombre_completo.trim() : `Alumno ${cleanDni}`;
    const clave = pin ? pin.trim() : '0000';

    db.prepare('INSERT OR IGNORE INTO alumno (dni, nombre_completo, pin) VALUES (?, ?, ?)').run(cleanDni, nombre, clave);
    const existing = this.findByDni(cleanDni);
    if (existing) {
      if (pin) this.updatePin(cleanDni, clave);
      return this.findByDni(cleanDni)!;
    }

    const res = db.prepare('INSERT INTO cuenta (dni_alumno, saldo) VALUES (?, 0.0)').run(cleanDni);
    return {
      id: Number(res.lastInsertRowid),
      dni_alumno: cleanDni,
      alumno_id: cleanDni,
      saldo: 0.0,
      dni: String(cleanDni),
      nombre_completo: nombre,
      pin: clave
    };
  },

  updateBalance(id: number, newBalance: number): void {
    const stmt = db.prepare('UPDATE cuenta SET saldo = ? WHERE id = ?');
    stmt.run(newBalance, id);
  },

  rechargeBalance(id: number, amount: number): void {
    const stmt = db.prepare('UPDATE cuenta SET saldo = saldo + ? WHERE id = ?');
    stmt.run(amount, id);
  },

  listAll(): Omit<CuentaDetallada, 'pin'>[] {
    const stmt = db.prepare(`
      SELECT c.id, c.dni_alumno as alumno_id, c.saldo, c.fecha_registro as created_at,
             a.nombre_completo, a.dni
      FROM cuenta c
      JOIN alumno a ON a.dni = c.dni_alumno
    `);
    return stmt.all() as unknown as Omit<CuentaDetallada, 'pin'>[];
  }
};
