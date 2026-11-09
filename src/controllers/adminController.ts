import { Request, Response } from 'express';
import { cardRepository } from '../repositories/cardRepository.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { RechargeRequest, RegisterCardRequest, RegisterStudentRequest, UpdateStudentRequest } from '../types/index.js';

export const adminController = {

  unlockAll(_req: Request, res: Response): Response {
    cardRepository.unlockAll();
    return res.status(200).json({
      status: 'OK',
      message: 'Todas las tarjetas fueron desbloqueadas con éxito'
    });
  },

  unlockCard(req: Request, res: Response): Response {
    const uid = req.body?.uid || req.params?.uid;
    if (!uid) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'UID de la tarjeta es requerido'
      });
    }

    const cleanUid = String(uid).trim().toUpperCase();
    cardRepository.unlockCard(cleanUid);

    return res.status(200).json({
      status: 'OK',
      message: `Tarjeta ${cleanUid} desbloqueada exitosamente`
    });
  },

  lockCard(req: Request, res: Response): Response {
    const uid = req.body?.uid || req.params?.uid;
    if (!uid) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'UID de la tarjeta es requerido'
      });
    }

    const cleanUid = String(uid).trim().toUpperCase();
    cardRepository.lockCard(cleanUid);

    return res.status(200).json({
      status: 'OK',
      message: `Tarjeta ${cleanUid} bloqueada exitosamente`
    });
  },

  deleteCard(req: Request, res: Response): Response {
    const uid = req.body?.uid || req.params?.uid;
    if (!uid) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'UID de la tarjeta es requerido'
      });
    }

    const cleanUid = String(uid).trim().toUpperCase();
    const deleted = cardRepository.deleteCard(cleanUid);

    if (!deleted) {
      return res.status(404).json({
        status: 'ERROR',
        message: `No se encontró la tarjeta ${cleanUid}`
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: `Tarjeta ${cleanUid} desvinculada exitosamente`
    });
  },

  getStatus(_req: Request, res: Response): Response {
    const alumnos = accountRepository.listAllDetailed();
    const cuentas = accountRepository.listAll();
    const tarjetas = cardRepository.listAll();
    const transacciones = transactionRepository.listRecent(50);
    const stats = transactionRepository.getStats();

    return res.status(200).json({
      status: 'OK',
      alumnos,
      cuentas,
      tarjetas,
      transacciones,
      stats
    });
  },

  getAlumnos(_req: Request, res: Response): Response {
    const alumnos = accountRepository.listAllDetailed();
    return res.status(200).json({
      status: 'OK',
      alumnos
    });
  },

  getAlumnoByDni(req: Request, res: Response): Response {
    const dni = req.params.dni || req.body?.dni || req.query?.dni;
    if (!dni) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'DNI es requerido'
      });
    }

    const account = accountRepository.findByDni(String(dni).trim());
    if (!account) {
      return res.status(404).json({
        status: 'NO_ENCONTRADO',
        message: 'Alumno no registrado con ese DNI'
      });
    }

    return res.status(200).json({
      status: 'OK',
      alumno: account.nombre_completo,
      dni: account.dni,
      saldo: account.saldo,
      cuenta_id: account.id
    });
  },

  registerStudent(req: Request<{}, {}, RegisterStudentRequest>, res: Response): Response {
    const { dni, nombre_completo, pin, saldo_inicial, uid } = req.body;

    if (!dni || !nombre_completo || !String(nombre_completo).trim()) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'DNI y Nombre Completo son obligatorios'
      });
    }

    const cleanDni = String(dni).trim();
    if (!/^\d+$/.test(cleanDni)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'El DNI debe contener solo números'
      });
    }

    const existing = accountRepository.findByDni(cleanDni);
    if (existing) {
      return res.status(409).json({
        status: 'CONFLICT',
        message: `Ya existe un alumno registrado con el DNI ${cleanDni} (${existing.nombre_completo})`
      });
    }

    const cleanPin = pin && String(pin).trim() ? String(pin).trim() : '1234';
    if (!/^\d{4,6}$/.test(cleanPin)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'El PIN debe ser numérico de 4 a 6 dígitos'
      });
    }

    const initialBalance = Number(saldo_inicial) || 0.0;
    if (initialBalance < 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'El saldo inicial no puede ser negativo'
      });
    }

    const account = accountRepository.createStudent({
      dni: cleanDni,
      nombre_completo: String(nombre_completo).trim(),
      pin: cleanPin,
      saldo_inicial: initialBalance
    });

    if (initialBalance > 0) {
      transactionRepository.create({
        cuenta_id: account.id,
        tarjeta_uid: 'SALDO_INICIAL',
        monto: initialBalance,
        estado: 'RECARGA',
        saldo_restante: initialBalance
      });
    }

    let linkedCard = null;
    if (uid && String(uid).trim()) {
      const cleanUid = String(uid).trim().toUpperCase();
      linkedCard = cardRepository.create({
        uid: cleanUid,
        cuenta_id: account.id
      });
    }

    return res.status(201).json({
      status: 'OK',
      message: 'Alumno registrado exitosamente',
      alumno: {
        dni: account.dni,
        nombre_completo: account.nombre_completo,
        saldo: account.saldo,
        cuenta_id: account.id,
        tarjeta_uid: linkedCard ? linkedCard.uid : null
      }
    });
  },

  updateStudent(req: Request<{ dni: string }, {}, UpdateStudentRequest>, res: Response): Response {
    const dni = req.params.dni || (req.body as any)?.dni;
    if (!dni) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'DNI es requerido'
      });
    }

    const cleanDni = String(dni).trim();
    const account = accountRepository.findByDni(cleanDni);
    if (!account) {
      return res.status(404).json({
        status: 'NO_ENCONTRADO',
        message: 'Alumno no encontrado'
      });
    }

    const { nombre_completo, pin } = req.body;
    if (pin && !/^\d{4,6}$/.test(String(pin).trim())) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'El PIN debe ser numérico de 4 a 6 dígitos'
      });
    }

    accountRepository.updateStudent(cleanDni, {
      nombre_completo: nombre_completo ? String(nombre_completo).trim() : undefined,
      pin: pin ? String(pin).trim() : undefined
    });

    const updated = accountRepository.findByDni(cleanDni)!;
    return res.status(200).json({
      status: 'OK',
      message: 'Datos del alumno actualizados con éxito',
      alumno: {
        dni: updated.dni,
        nombre_completo: updated.nombre_completo,
        saldo: updated.saldo
      }
    });
  },

  deleteStudent(req: Request<{ dni: string }>, res: Response): Response {
    const dni = req.params.dni || (req.body as any)?.dni;
    if (!dni) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'DNI es requerido'
      });
    }

    const cleanDni = String(dni).trim();
    const deleted = accountRepository.deleteStudent(cleanDni);
    if (!deleted) {
      return res.status(404).json({
        status: 'NO_ENCONTRADO',
        message: 'Alumno no encontrado con ese DNI'
      });
    }

    return res.status(200).json({
      status: 'OK',
      message: `Alumno con DNI ${cleanDni} eliminado exitosamente`
    });
  },

  registerCard(req: Request<{}, {}, RegisterCardRequest>, res: Response): Response {
    const { dni, pin, uid, nombre_completo } = req.body;

    if (!dni || !uid) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'DNI y UID son requeridos'
      });
    }

    const cleanDni = String(dni).trim();
    const cleanUid = String(uid).trim().toUpperCase();

    let account = accountRepository.findByDni(cleanDni);
    if (!account) {
      account = accountRepository.createWithAccount({
        dni: cleanDni,
        nombre_completo: nombre_completo || `Alumno ${cleanDni}`,
        pin: pin || '0000'
      });
    } else if (pin) {
      accountRepository.updatePin(cleanDni, String(pin).trim());
      account = accountRepository.findByDni(cleanDni)!;
    }

    const card = cardRepository.create({
      uid: cleanUid,
      cuenta_id: account.id
    });

    return res.status(200).json({
      status: 'OK',
      message: 'Tarjeta vinculada exitosamente',
      alumno: account.nombre_completo,
      dni: account.dni,
      saldo: account.saldo,
      uid: card.uid
    });
  },

  recharge(req: Request<{}, {}, RechargeRequest>, res: Response): Response {
    const { cuenta_id, dni, uid, monto } = req.body;
    const numericAmount = Number(monto);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Monto positivo es requerido'
      });
    }

    let account;
    if (dni) {
      account = accountRepository.findByDni(String(dni).trim());
    } else if (uid) {
      const card = cardRepository.findByUid(String(uid).trim().toUpperCase());
      if (card) {
        account = accountRepository.findById(card.cuenta_id);
      }
    } else if (cuenta_id) {
      account = accountRepository.findById(Number(cuenta_id));
    }

    if (!account) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Cuenta o tarjeta no encontrada'
      });
    }

    accountRepository.rechargeBalance(account.id, numericAmount);
    const nuevoSaldo = Number((account.saldo + numericAmount).toFixed(2));

    transactionRepository.create({
      cuenta_id: account.id,
      tarjeta_uid: uid ? String(uid).trim().toUpperCase() : 'RECARGA_CAJA',
      monto: numericAmount,
      estado: 'RECARGA',
      saldo_restante: nuevoSaldo
    });

    return res.status(200).json({
      status: 'OK',
      message: 'Recarga exitosa',
      alumno: account.nombre_completo,
      dni: account.dni,
      monto: numericAmount,
      nuevoSaldo,
      cuenta: {
        id: account.id,
        saldo: nuevoSaldo
      }
    });
  },

  seedDemoData(_req: Request, res: Response): Response {
    const existing = accountRepository.listAll();
    if (existing.length > 0) {
      return res.status(200).json({
        status: 'OK',
        message: 'Ya existen alumnos en la base de datos'
      });
    }

    const demoStudents = [
      { dni: '72345678', nombre_completo: 'Lucía Fernández Ramos', pin: '1234', saldo: 25.50, uid: 'A1B2C3D4' },
      { dni: '74561234', nombre_completo: 'Mateo Quispe Huamán', pin: '2468', saldo: 15.00, uid: 'E5F6A7B8' },
      { dni: '76982341', nombre_completo: 'Camila Torres Mendoza', pin: '1122', saldo: 8.50, uid: 'C9D0E1F2' },
      { dni: '78129045', nombre_completo: 'Joaquín Silva Morales', pin: '4321', saldo: 30.00, uid: 'AA7AFC35' }
    ];

    for (const s of demoStudents) {
      const acc = accountRepository.createStudent({
        dni: s.dni,
        nombre_completo: s.nombre_completo,
        pin: s.pin,
        saldo_inicial: s.saldo
      });

      cardRepository.create({
        uid: s.uid,
        cuenta_id: acc.id
      });

      transactionRepository.create({
        cuenta_id: acc.id,
        tarjeta_uid: 'SALDO_INICIAL',
        monto: s.saldo,
        estado: 'RECARGA',
        saldo_restante: s.saldo
      });
    }

    return res.status(201).json({
      status: 'OK',
      message: 'Datos de prueba cargados exitosamente (4 alumnos con tarjetas y saldo)'
    });
  }
};
