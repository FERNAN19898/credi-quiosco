import { db } from '../config/database.js';
import { Transaccion } from '../types/index.js';

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

  listRecent(limit: number = 20): Transaccion[] {
    const stmt = db.prepare(`
      SELECT t.id, t.cuenta_id, t.tarjeta_uid, t.monto, t.estado, t.saldo_restante, t.fecha_registro as created_at,
             a.nombre_completo as alumno_nombre
      FROM transacciones t
      LEFT JOIN cuenta c ON c.id = t.cuenta_id
      LEFT JOIN alumno a ON a.dni = c.dni_alumno
      ORDER BY t.id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as Transaccion[];
  }
};
