// backend/src/routes/index.ts
import { Router } from 'express';
import multer from 'multer';
import { requireUser, requireDevice, requireRole, requireWorker } from '../middleware/auth';
import * as auth from '../controllers/auth.controller';
import * as device from '../controllers/device.controller';
import * as dashboard from '../controllers/dashboard.controller';
import * as verification from '../controllers/verification.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function createRoutes() {
  const router = Router();

  // --- Auth (public) ---
  router.post('/api/auth/login', auth.login);
  router.post('/api/auth/refresh', auth.refresh);
  router.post('/api/auth/logout', auth.logout);
  router.get('/api/auth/me', requireUser, auth.me);

  // --- Device endpoints (device JWT) ---
  router.post('/api/device/register', device.register);
  router.post('/api/device/status', requireDevice, device.reportStatus);
  router.get('/api/device/pending-commands', requireDevice, device.pendingCommands);
  router.post('/api/device/command-result', requireDevice, device.commandResult);
  router.post('/api/device/upload-photo', requireDevice, upload.single('photo'), device.uploadPhotoEndpoint);

  // --- Dashboard endpoints (user JWT) ---
  // Devices
  router.get('/api/devices', requireUser, dashboard.listDevices);
  router.get('/api/devices/:id', requireUser, dashboard.getDevice);
  router.put('/api/devices/:id', requireUser, requireRole('admin', 'operator'), dashboard.updateDevice);
  router.post('/api/devices/:id/command', requireUser, requireRole('admin', 'operator'), dashboard.sendCommand);

  // Photos
  router.get('/api/photos', requireUser, dashboard.listPhotos);

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
