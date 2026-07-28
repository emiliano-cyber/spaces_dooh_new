// backend/src/routes/index.ts
import { Router } from 'express';
import multer from 'multer';
import { requireUser, requireDevice, requireRole, requireWorker } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import * as device from '../controllers/device.controller';
import * as dashboard from '../controllers/dashboard.controller';
import * as verification from '../controllers/verification.controller';
import * as telemetry from '../controllers/telemetry.controller';
import * as users from '../controllers/users.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function createRoutes() {
  const router = Router();

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
  router.put('/api/devices/:id/camera', requireUser, requireRole('admin'), dashboard.setCamera);
  // Version del APK publicado, para saber que equipos estan atrasados.
  router.get('/api/app/version', requireUser, dashboard.appVersion);
  // Posicion de la marca de informacion (overlay) del dispositivo (solo admin).
  router.put('/api/devices/:id/overlay', requireUser, requireRole('admin'), dashboard.setOverlay);

  // Photos
  router.get('/api/photos', requireUser, dashboard.listPhotos);
  router.delete('/api/photos/:id', requireUser, requireRole('admin', 'operator'), dashboard.deletePhoto);

  // Schedules
  router.get('/api/schedules', requireUser, dashboard.listSchedules);
  router.post('/api/schedules', requireUser, requireRole('admin', 'operator'), dashboard.createSchedule);
  router.put('/api/schedules/:id', requireUser, requireRole('admin', 'operator'), dashboard.updateSchedule);
  router.delete('/api/schedules/:id', requireUser, requireRole('admin'), dashboard.deleteSchedule);

  // Campaigns
  router.get('/api/campaigns', requireUser, dashboard.listCampaigns);
  router.post('/api/campaigns', requireUser, requireRole('admin', 'operator'), dashboard.createCampaign);
  router.get('/api/campaigns/:id', requireUser, dashboard.getCampaign);

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
