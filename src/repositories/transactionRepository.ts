import { db } from '../config/database.js';
import { SystemStats, Transaccion } from '../types/index.js';

interface CreateTransactionParams {
  cuenta_id: number;
  tarjeta_uid: string;
  monto: number;
  estado: string;
  saldo_restante: number;
}

export const transactionRepository = {
  create(data: CreateTransactionParams): Transaccion {
    const stmt = db.prepare(`
      INSERT INTO transacciones (cuenta_id, tarjeta_uid, monto, estado, saldo_restante)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.cuenta_id,
      data.tarjeta_uid,
      data.monto,
      data.estado,
      data.saldo_restante
    );
    return {
      id: Number(result.lastInsertRowid),
      cuenta_id: data.cuenta_id,
      tarjeta_uid: data.tarjeta_uid,
      monto: data.monto,
      estado: data.estado,
      saldo_restante: data.saldo_restante
    };
  },

  listRecent(limit: number = 50): Transaccion[] {
    const stmt = db.prepare(`
      SELECT t.id, t.cuenta_id, t.tarjeta_uid, t.monto, t.estado, t.saldo_restante,
             t.fecha_registro as created_at, t.fecha_registro,
             a.nombre_completo as alumno_nombre, a.dni as alumno_dni
      FROM transacciones t
      LEFT JOIN cuenta c ON c.id = t.cuenta_id
      LEFT JOIN alumno a ON a.dni = c.dni_alumno
      ORDER BY t.id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as Transaccion[];
  },

  getStats(): SystemStats {
    const alumnosRow = db.prepare('SELECT COUNT(*) as count FROM alumno').get() as { count: number };
    const saldoRow = db.prepare('SELECT COALESCE(SUM(saldo), 0) as total FROM cuenta').get() as { total: number };
    const tarjetasRow = db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN bloqueado = 1 THEN 1 ELSE 0 END), 0) as bloqueadas FROM tarjeta').get() as { total: number; bloqueadas: number };

    const ventasHoyRow = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM transacciones
      WHERE estado = 'OK' AND date(fecha_registro) = date('now', 'localtime')
    `).get() as { total: number };

    const recargasHoyRow = db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM transacciones
      WHERE estado = 'RECARGA' AND date(fecha_registro) = date('now', 'localtime')
    `).get() as { total: number };

    const txHoyRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM transacciones
      WHERE date(fecha_registro) = date('now', 'localtime')
    `).get() as { total: number };

    return {
      totalAlumnos: alumnosRow?.count || 0,
      totalTarjetas: tarjetasRow?.total || 0,
      totalTarjetasBloqueadas: tarjetasRow?.bloqueadas || 0,
      saldoTotal: Number((saldoRow?.total || 0).toFixed(2)),
      ventasHoy: Number((ventasHoyRow?.total || 0).toFixed(2)),
      recargasHoy: Number((recargasHoyRow?.total || 0).toFixed(2)),
      transaccionesHoy: txHoyRow?.total || 0
    };
  }
};
