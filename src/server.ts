import { app } from './app.js';
import { config } from './config/env.js';

/**
 * ============================================================================
 *   [ OPENMIND INNOVATIONS - CREDI QUIOSCO ]
 *   Project: Credi Quiosco API
 *   Author: Fernando Espejo
 *   License: AGPL-3.0
 * ============================================================================
 * 
 * Todo lo que hace el fanatismo a Portal.
 * 
 */

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Credi Quiosco API corriendo en puerto ${config.PORT} (0.0.0.0)`);
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
