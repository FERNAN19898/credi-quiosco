import { db } from '../config/database.js';
import { AlumnoConTarjetas, CuentaDetallada, RegisterStudentRequest } from '../types/index.js';

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

  updateStudent(dni: string | number, data: { nombre_completo?: string; pin?: string }): void {
    const cleanDni = Number(dni);
    if (data.nombre_completo && data.pin) {
      db.prepare('UPDATE alumno SET nombre_completo = ?, pin = ? WHERE dni = ?')
        .run(data.nombre_completo.trim(), data.pin.trim(), cleanDni);
    } else if (data.nombre_completo) {
      db.prepare('UPDATE alumno SET nombre_completo = ? WHERE dni = ?')
        .run(data.nombre_completo.trim(), cleanDni);
    } else if (data.pin) {
      db.prepare('UPDATE alumno SET pin = ? WHERE dni = ?')
        .run(data.pin.trim(), cleanDni);
    }
  },

  deleteStudent(dni: string | number): boolean {
    const cleanDni = Number(dni);
    const res = db.prepare('DELETE FROM alumno WHERE dni = ?').run(cleanDni);
    return Number(res.changes) > 0;
  },

  createStudent(data: RegisterStudentRequest): CuentaDetallada {
    const cleanDni = Number(data.dni);
    const nombre = data.nombre_completo.trim();
    const pin = data.pin && data.pin.trim() ? data.pin.trim() : '1234';
    const saldoInicial = Number(data.saldo_inicial) || 0.0;

    db.prepare('INSERT INTO alumno (dni, nombre_completo, pin) VALUES (?, ?, ?)')
      .run(cleanDni, nombre, pin);

    const res = db.prepare('INSERT INTO cuenta (dni_alumno, saldo) VALUES (?, ?)')
      .run(cleanDni, saldoInicial);

    return {
      id: Number(res.lastInsertRowid),
      dni_alumno: cleanDni,
      alumno_id: cleanDni,
      saldo: saldoInicial,
      dni: String(cleanDni),
      nombre_completo: nombre,
      pin
    };
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
      ORDER BY a.nombre_completo ASC
    `);
    return stmt.all() as unknown as Omit<CuentaDetallada, 'pin'>[];
  },

  listAllDetailed(): AlumnoConTarjetas[] {
    const stmt = db.prepare(`
      SELECT a.dni, a.nombre_completo, a.fecha_registro,
             c.id as cuenta_id, c.saldo,
             t.uid as tarjeta_uid, t.bloqueado as tarjeta_bloqueada,
             t.activa as tarjeta_activa, t.intentos_fallidos as tarjeta_intentos
      FROM alumno a
      JOIN cuenta c ON c.dni_alumno = a.dni
      LEFT JOIN tarjeta t ON t.cuenta_id = c.id
      ORDER BY a.nombre_completo ASC
    `);
    const rows = stmt.all() as Array<{
      dni: number;
      nombre_completo: string;
      fecha_registro: string;
      cuenta_id: number;
      saldo: number;
      tarjeta_uid: string | null;
      tarjeta_bloqueada: number | null;
      tarjeta_activa: number | null;
      tarjeta_intentos: number | null;
    }>;

    const map = new Map<number, AlumnoConTarjetas>();

    for (const row of rows) {
      if (!map.has(row.dni)) {
        map.set(row.dni, {
          dni: String(row.dni),
          nombre_completo: row.nombre_completo,
          saldo: Number(row.saldo),
          cuenta_id: row.cuenta_id,
          fecha_registro: row.fecha_registro,
          tarjetas: []
        });
      }

      if (row.tarjeta_uid) {
        map.get(row.dni)!.tarjetas.push({
          uid: row.tarjeta_uid,
          bloqueado: row.tarjeta_bloqueada ?? 0,
          activa: row.tarjeta_activa ?? 1,
          intentos_fallidos: row.tarjeta_intentos ?? 0
        });
      }
    }

    return Array.from(map.values());
  }
};
