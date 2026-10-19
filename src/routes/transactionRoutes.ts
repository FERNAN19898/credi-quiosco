import { Router } from 'express';
import { transactionController } from '../controllers/transactionController.js';

export const transactionRoutes = Router();

// Mmm, como sera atacar esto?
transactionRoutes.post('/transaccion', transactionController.createTransaction);
