import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';

export const adminRoutes = Router();

// Estado general y métricas
adminRoutes.get('/status', adminController.getStatus);

// Gestión de alumnos
adminRoutes.get('/alumnos', adminController.getAlumnos);
adminRoutes.post('/alumno', adminController.registerStudent);
adminRoutes.post('/registrar-alumno', adminController.registerStudent);
adminRoutes.get('/alumno/:dni', adminController.getAlumnoByDni);
adminRoutes.post('/buscar-alumno', adminController.getAlumnoByDni);
adminRoutes.put('/alumno/:dni', adminController.updateStudent);
adminRoutes.post('/actualizar-alumno', adminController.updateStudent);
adminRoutes.delete('/alumno/:dni', adminController.deleteStudent);
adminRoutes.post('/eliminar-alumno', adminController.deleteStudent);

// Gestión de tarjetas RFID / NFC
adminRoutes.post('/registrar-tarjeta', adminController.registerCard);
adminRoutes.post('/desbloquear-tarjeta', adminController.unlockCard);
adminRoutes.post('/bloquear-tarjeta', adminController.lockCard);
adminRoutes.delete('/tarjeta/:uid', adminController.deleteCard);
adminRoutes.post('/eliminar-tarjeta', adminController.deleteCard);
adminRoutes.get('/desbloquear-todo', adminController.unlockAll);
adminRoutes.post('/desbloquear-todo', adminController.unlockAll);

// Recargas de saldo
adminRoutes.post('/recargar', adminController.recharge);

// Cargar datos demo de prueba
adminRoutes.post('/seed-demo', adminController.seedDemoData);
