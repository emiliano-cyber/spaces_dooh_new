// backend/src/config/env.ts
import { z } from 'zod';
import 'dotenv/config';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('space_eye'),

  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),

  // Secreto compartido con el ai-worker para los endpoints /api/internal/*.
  WORKER_SECRET: z.string().min(16).default('dev-worker-secret-change-me'),
  // URL publica del backend, usada para construir enlaces descargables a las
  // fotos/creatividades que el worker debe recuperar (modo STORAGE_DRIVER=local).
  PUBLIC_BASE_URL: z.string().default('http://127.0.0.1:4000'),

  JWT_SECRET: z.string().min(32),
  JWT_DEVICE_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_DEVICE_TTL: z.string().default('365d'),

  // Almacenamiento de fotos: 'local' guarda en disco (desarrollo), 'spaces' sube a S3/DigitalOcean.
  STORAGE_DRIVER: z.enum(['local', 'spaces']).default('local'),
  STORAGE_DIR: z.string().default('./storage'),
  SPACES_ENDPOINT: z.string().default('https://nyc3.digitaloceanspaces.com'),
  SPACES_KEY: z.string().default('minioadmin'),
  SPACES_SECRET: z.string().default('minioadmin'),
  SPACES_BUCKET: z.string().default('space-eye-photos'),
  SPACES_REGION: z.string().default('nyc3'),

  // TURN (WebRTC en redes remotas / datos moviles). Vacio = solo STUN.
  // TURN_URL admite varias separadas por coma, p.ej.:
  //   "turn:turn.midominio.com:3478,turns:turn.midominio.com:5349"
  TURN_URL: z.string().default(''),
  TURN_SECRET: z.string().default(''),

  MEDIASOUP_LISTEN_IP: z.string().default('0.0.0.0'),
  MEDIASOUP_ANNOUNCED_IP: z.string().default('127.0.0.1'),
  MEDIASOUP_MIN_PORT: z.coerce.number().default(40000),
  MEDIASOUP_MAX_PORT: z.coerce.number().default(40100),
});

export const env = schema.parse(process.env);
