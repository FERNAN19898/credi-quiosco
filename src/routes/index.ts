import { Router } from 'express';
import { transactionRoutes } from './transactionRoutes.js';
import { adminRoutes } from './adminRoutes.js';

export const apiRoutes = Router();

apiRoutes.use('/', transactionRoutes);
apiRoutes.use('/admin', adminRoutes);
