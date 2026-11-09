import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { apiRoutes } from './routes/index.js';

export const app = express();

app.use(cors());
app.use(express.json());

// Archivos estáticos
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/media', express.static(path.join(process.cwd(), 'media')));

// Rutas amigables para el panel y el simulador
app.get(['/panel', '/admin'], (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'index.html'));
});

app.get(['/simulador', '/simulacion'], (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'public', 'simulacion', 'index.html'));
});

// Estado de la API
app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    name: 'Credi Quiosco API',
    status: 'ONLINE',
    version: '1.1.0'
  });
});

app.use('/api', apiRoutes);
