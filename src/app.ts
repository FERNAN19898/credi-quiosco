import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { apiRoutes } from './routes/index.js';
import { cardRepository } from './repositories/cardRepository.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    name: 'CrediQuiosco API',
    status: 'ONLINE',
    version: '1.0.0'
  });
});

app.use('/api', apiRoutes);
