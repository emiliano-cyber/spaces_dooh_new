// backend/src/routes/index.ts
import { Router } from 'express';
import { asyncRouter } from '../utils/asyncRouter';
import multer from 'multer';
import { requireUser, requireDevice, requireRole, requireWorker } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import * as device from '../controllers/device.controller';
import * as dashboard from '../controllers/dashboard.controller';
import * as llaves from '../controllers/llaves.controller';
import * as eyes from '../controllers/eyes.controller';
import * as verification from '../controllers/verification.controller';
import * as telemetry from '../controllers/telemetry.controller';
import * as users from '../controllers/users.controller';
import * as creativos from '../controllers/creativos.controller';
import * as monitoreo from '../controllers/monitoreo.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function createRoutes() {
  // asyncRouter: sin esto, el error de un handler asincrono mata el proceso
  // entero (Express 4 no captura promesas rechazadas).
  const router = asyncRouter();

  // --- Auth (public) ---
  router.post('/api/auth/login', auth.login);
  router.post('/api/auth/refresh', auth.refresh);
  router.post('/api/auth/logout', auth.logout);
  router.get('/api/auth/me', requireUser, auth.me);
  router.put('/api/auth/password', requireUser, auth.changePassword);

  // --- Users (admin) ---
  router.get('/api/users', requireUser, requireRole('admin'), users.listUsers);
  router.post('/api/users', requireUser, requireRole('admin'), users.createUser);
  router.put('/api/users/:id', requireUser, requireRole('admin'), users.updateUser);

  // --- Device endpoints (device JWT) ---
  router.post('/api/device/register', device.register);
  router.post('/api/device/status', requireDevice, device.reportStatus);
  router.get('/api/device/pending-commands', requireDevice, device.pendingCommands);
  router.post('/api/device/command-result', requireDevice, device.commandResult);
  router.post('/api/device/upload-photo', requireDevice, upload.single('photo'), device.uploadPhotoEndpoint);
  router.post('/api/device/log', requireDevice, device.logEvent);
  router.get('/api/device/ice-servers', requireDevice, dashboard.iceServers);
  // Configuracion de vigilancia y catalogo de huellas del sitio. El equipo lo
  // pide antes de cada recorrido; el resultado vuelve pegado a /device/status.
  router.get('/api/device/creativos', requireDevice, creativos.paraElEquipo);
  // Monitoreo de la pantalla (APK 0.15.0+): configuracion antes de cada vuelta,
  // y alertas de falla solo cuando algo cambia de estado.
  router.get('/api/device/monitoreo', requireDevice, monitoreo.paraElEquipo);
  router.post('/api/device/fallas', requireDevice, upload.single('photo'), monitoreo.reportarFalla);

  // --- Dashboard endpoints (user JWT) ---
  // Devices
  router.get('/api/devices', requireUser, dashboard.listDevices);
  router.get('/api/devices/:id', requireUser, dashboard.getDevice);
  router.get('/api/devices/:id/logs', requireUser, dashboard.listDeviceLogs);
  // PlayLog / historico de telemetria (lee device_status existente).
  router.get('/api/devices/:id/telemetry', requireUser, telemetry.getTelemetry);
  router.get('/api/devices/:id/telemetry/export', requireUser, telemetry.exportTelemetry);
  router.put('/api/devices/:id', requireUser, requireRole('admin', 'operator'), dashboard.updateDevice);
  router.delete('/api/devices/:id', requireUser, requireRole('admin'), dashboard.deleteDevice);
  router.post('/api/devices/:id/command', requireUser, requireRole('admin', 'operator'), dashboard.sendCommand);
  // Fijar orientacion por defecto del stream (solo admin).
  router.put('/api/devices/:id/stream-rotation', requireUser, requireRole('admin'), dashboard.setStreamRotation);
  // Encuadre, color y enfoque: tambien el operador. Ajustar la vista de un sitio
  // es operarlo, y dejarlo solo en manos de admin obligaba a que un operador
  // pidiera ayuda para algo que hace desde el visor. La orientacion fija y la
  // marca de datos SI siguen siendo de admin: se definen al instalar y cambian
  // lo que ve todo el mundo.
  router.put('/api/devices/:id/camera', requireUser, requireRole('admin', 'operator'), dashboard.setCamera);
  // Si el equipo ya empezo a transmitir (equipos que pasan por el servidor de medios).
  router.get('/api/devices/:id/stream-status', requireUser, dashboard.streamStatus);
  // Version del APK publicado, para saber que equipos estan atrasados.
  router.get('/api/app/version', requireUser, dashboard.appVersion);
  // Posicion de la marca de informacion (overlay) del dispositivo (solo admin).
  router.put('/api/devices/:id/overlay', requireUser, requireRole('admin'), dashboard.setOverlay);

  // Pantalla: esquinas, gabinetes, horario, y el monitoreo de fallas.
  router.get('/api/devices/:id/pantalla', requireUser, monitoreo.deEquipo);
  router.put('/api/devices/:id/pantalla', requireUser, requireRole('admin', 'operator'), monitoreo.configurarPantalla);
  router.put('/api/devices/:id/salud', requireUser, requireRole('admin', 'operator'), monitoreo.configurarSalud);
  router.get('/api/fallas', requireUser, monitoreo.listar);
  router.put('/api/fallas/:id', requireUser, requireRole('admin', 'operator'), monitoreo.actualizar);
  // Creativos detectados en la pantalla
  router.get('/api/devices/:id/creativos', requireUser, creativos.listarDeEquipo);
  router.put('/api/devices/:id/creativos', requireUser, requireRole('admin', 'operator'), creativos.configurar);
  router.post('/api/devices/:id/creativos/reaprender', requireUser, requireRole('admin'), creativos.reaprender);
  router.put('/api/creativos/:id', requireUser, requireRole('admin', 'operator'), creativos.descartar);

  // Photos
  // Foto ya, en varios equipos de una vez (sin device_ids = toda la flota).
  router.post('/api/capture', requireUser, requireRole('admin', 'operator'), dashboard.capturarAhora);
  router.get('/api/photos', requireUser, dashboard.listPhotos);
  router.delete('/api/photos/:id', requireUser, requireRole('admin', 'operator'), dashboard.deletePhoto);

  // Espejo de SPACE OS: de aqui saca cada instancia lo que cambio en SUS camaras.
  router.get('/api/eyes/cambios', requireUser, eyes.cambios);
  // Lo UNICO que una instancia puede escribir: pedirle una foto a un equipo
  // suyo. Ruta aparte de /api/devices/:id/command a proposito -esa acepta ocho
  // tipos de orden y aqui el tipo no es un parametro-. Ver el comentario del
  // controlador.
  router.post('/api/eyes/devices/:id/captura', requireUser, eyes.pedirCaptura);

  // Llaves de servicio: como entra OTRO SISTEMA a leer, sin la cuenta admin.
  // Todo admin: crear una llave es repartir acceso a los datos de la flota.
  router.get('/api/llaves', requireUser, requireRole('admin'), llaves.listar);
  router.post('/api/llaves', requireUser, requireRole('admin'), llaves.crear);
  router.delete('/api/llaves/:id', requireUser, requireRole('admin'), llaves.revocar);

  // Schedules
  router.get('/api/schedules', requireUser, dashboard.listSchedules);
  router.post('/api/schedules', requireUser, requireRole('admin', 'operator'), dashboard.createSchedule);
  router.put('/api/schedules/:id', requireUser, requireRole('admin', 'operator'), dashboard.updateSchedule);
  router.delete('/api/schedules/:id', requireUser, requireRole('admin'), dashboard.deleteSchedule);

  // Campaigns
  router.get('/api/campaigns', requireUser, dashboard.listCampaigns);
  router.post('/api/campaigns', requireUser, requireRole('admin', 'operator'), dashboard.createCampaign);
  router.get('/api/campaigns/:id', requireUser, dashboard.getCampaign);
  router.put('/api/campaigns/:id', requireUser, requireRole('admin', 'operator'), dashboard.actualizarCampana);
  // La creatividad de referencia: la imagen contra la que se compara lo que
  // aparece en la pantalla. Sin ella una campana no se puede verificar ni buscar.
  router.post('/api/campaigns/:id/creative', requireUser, requireRole('admin', 'operator'),
    upload.single('creative'), dashboard.subirCreatividad);

  // Verifications
  router.get('/api/verifications', requireUser, dashboard.listVerifications);

  // WebRTC ICE servers (STUN + TURN) para el dashboard
  router.get('/api/ice-servers', requireUser, dashboard.iceServers);

  // --- Internal endpoints (ai-worker, shared secret) ---
  const evidenceUpload = upload.fields([
    { name: 'evidence', maxCount: 1 },
    { name: 'aligned', maxCount: 1 },
    { name: 'diff', maxCount: 1 },
  ]);
  router.get('/api/internal/verification/:photoId/context', requireWorker, verification.getVerificationContext);
  router.post('/api/internal/verification/:photoId/result', requireWorker, evidenceUpload, verification.submitVerificationResult);

  return router;
}
