import { Request, Response } from 'express';
import { cardRepository } from '../repositories/cardRepository.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { RechargeRequest, RegisterCardRequest } from '../types/index.js';

export const adminController = {

  unlockAll(_req: Request, res: Response): Response {
  // Por que un desbloqueo general y no uno por UID de tarjeta? nunca lo sabremos
  
    cardRepository.unlockAll();
    return res.status(200).json({
      status: 'OK',
      message: 'Todas las tarjetas fueron desbloqueadas con exito'
    });
  },

  getStatus(_req: Request, res: Response): Response {
    const cuentas = accountRepository.listAll();
    const tarjetas = cardRepository.listAll();
    const transacciones = transactionRepository.listRecent(15);
    return res.status(200).json({
      cuentas,
      tarjetas,
      transacciones
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
      nuevoSaldo
    });
  }
};
