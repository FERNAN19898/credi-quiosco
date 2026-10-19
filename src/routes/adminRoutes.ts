import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';

export const adminRoutes = Router();

// No hay auth aun. Lo hice a las 2 am por favor.
// Si le metes auth, bacan p.

adminRoutes.get('/status', adminController.getStatus);
adminRoutes.get('/alumno/:dni', adminController.getAlumnoByDni);
adminRoutes.post('/buscar-alumno', adminController.getAlumnoByDni);
adminRoutes.post('/registrar-tarjeta', adminController.registerCard);
adminRoutes.post('/recargar', adminController.recharge);
adminRoutes.get('/desbloquear-todo', adminController.unlockAll);
adminRoutes.post('/desbloquear-todo', adminController.unlockAll);
