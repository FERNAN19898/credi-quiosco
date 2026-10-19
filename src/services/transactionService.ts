import { cardRepository } from '../repositories/cardRepository.js';
import { accountRepository } from '../repositories/accountRepository.js';
import { transactionRepository } from '../repositories/transactionRepository.js';
import { TransactionRequest, TransactionResponse } from '../types/index.js';

export const transactionService = {
  processPayment(payload: TransactionRequest): TransactionResponse {
    const { uid, pin, monto } = payload;
    const numericAmount = Number(monto);

    if (!uid || pin === undefined || isNaN(numericAmount) || numericAmount <= 0) {
      return {
        success: false,
        status: 'DATOS_INVALIDOS',
        message: 'UID, PIN y monto positivo son requeridos'
      };
    }

    const card = cardRepository.findByUid(uid.trim());

    if (!card) {
      return {
        success: false,
        status: 'TARJETA_NO_REGISTRADA',
        message: 'Tarjeta no registrada en el sistema'
      };
    }

    if (card.bloqueado === 1) {
      return {
        success: false,
        status: 'BLOQUEADO',
        message: 'Tarjeta bloqueada'
      };
    }

    if (String(card.pin) !== String(pin).trim()) {
      const attempts = card.intentos_fallidos + 1;
      cardRepository.incrementFailedAttempts(card.uid);

      if (attempts >= 3) {
        cardRepository.lockCard(card.uid);
        transactionRepository.create({
          cuenta_id: card.cuenta_id,
          tarjeta_uid: card.uid,
          monto: numericAmount,
          estado: 'BLOQUEADO',
          saldo_restante: card.saldo
        });
        return {
          success: false,
          status: 'BLOQUEADO',
          message: 'Tarjeta bloqueada por 3 intentos fallidos'
        };
      }

      transactionRepository.create({
        cuenta_id: card.cuenta_id,
        tarjeta_uid: card.uid,
        monto: numericAmount,
        estado: 'ERROR_PIN',
        saldo_restante: card.saldo
      });

      return {
        success: false,
        status: 'ERROR_PIN',
        message: 'PIN incorrecto',
        intentosRestantes: 3 - attempts
      };
    }

    if (card.intentos_fallidos > 0) {
      cardRepository.resetAttempts(card.uid);
    }

    if (card.saldo < numericAmount) {
      transactionRepository.create({
        cuenta_id: card.cuenta_id,
        tarjeta_uid: card.uid,
        monto: numericAmount,
        estado: 'SIN_SALDO',
        saldo_restante: card.saldo
      });
      return {
        success: false,
        status: 'SIN_SALDO',
        message: 'Saldo insuficiente',
        saldoActual: card.saldo
      };
    }

    const nuevoSaldo = Number((card.saldo - numericAmount).toFixed(2));
    accountRepository.updateBalance(card.cuenta_id, nuevoSaldo);

    const tx = transactionRepository.create({
      cuenta_id: card.cuenta_id,
      tarjeta_uid: card.uid,
      monto: numericAmount,
      estado: 'OK',
      saldo_restante: nuevoSaldo
    });

    return {
      success: true,
      status: 'OK',
      message: 'Cobro procesado correctamente',
      alumno: card.nombre_completo,
      dni: String(card.dni),
      monto: numericAmount,
      saldoRestante: nuevoSaldo,
      transaccionId: tx.id
    };
  }
};
