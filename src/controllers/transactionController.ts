import { Request, Response } from 'express';
import { transactionService } from '../services/transactionService.js';
import { TransactionRequest } from '../types/index.js';

export const transactionController = {
  createTransaction(req: Request<{}, {}, TransactionRequest>, res: Response): Response {
    const result = transactionService.processPayment(req.body);
    return res.status(200).json(result);
  }
};
