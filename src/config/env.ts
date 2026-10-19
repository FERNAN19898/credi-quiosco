import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: Number(process.env.PORT) || 3000,
  DB_FILE: process.env.DB_FILE || path.join(process.cwd(), 'data/crediquiosco.db')
};
