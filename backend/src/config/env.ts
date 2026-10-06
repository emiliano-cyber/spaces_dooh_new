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

  // Servidor de medios (MediaMTX) para la vista en vivo de los equipos que NO
  // son telefonos: la Raspberry y las PCs con camara IP empujan el video aqui y
  // el dashboard lo consume por WebRTC. Los telefonos Android no lo usan: siguen
  // con su WebRTC punto a punto.
  // Si MEDIAMTX_HOST queda vacio se deduce de PUBLIC_BASE_URL.
  MEDIAMTX_HOST: z.string().default(''),
  MEDIAMTX_RTSP_PORT: z.coerce.number().default(8554),
  MEDIAMTX_WEBRTC_PORT: z.coerce.number().default(8889),
  MEDIAMTX_USER: z.string().default('spaceeye'),
  MEDIAMTX_PASS: z.string().default(''),
  // API interna del servidor de medios (no se publica al exterior): sirve para
  // saber si un equipo ya empezo a transmitir.
  MEDIAMTX_API: z.string().default('http://mediamtx:9997'),
  // La direccion PUBLICA por la que un navegador consume la vista en vivo.
  //
  // Hace falta desde que el dashboard de un cliente vive en HTTPS: una pagina
  // https NO puede abrir un WHEP en http -el navegador lo bloquea como
  // contenido mixto, sin avisar mas que en la consola-. Con esto puesto, la
  // vista sale por el mismo dominio y certificado que la pagina, y quien la
  // reenvia a MediaMTX es el proxy de delante.
  //
  //   MEDIAMTX_WHEP_PUBLIC=https://eyes.g500.space-os.io/whep
  //
  // Vacio = se sigue armando como siempre (http://<host>:8889/...), que es lo
  // correcto mientras el servidor vaya por IP y sin TLS.
  MEDIAMTX_WHEP_PUBLIC: z.string().default(''),
  // Donde el BACKEND le entrega al servidor de medios la oferta de video de un
  // telefono (WHIP). Es la red interna de docker, no la publica.
  MEDIAMTX_WEBRTC_INTERNAL: z.string().default('http://mediamtx:8889'),
  // Los telefonos tambien transmiten por el servidor de medios: mandan su video
  // UNA vez y el servidor lo reparte a cuantos lo miren. Apagado, vuelven al
  // punto a punto de siempre (un solo espectador por equipo).
  // MODO ESPEJO (V2 al lado de V1). Los equipos en campo traen fija la direccion
  // de V1 en su APK y no hay quien vaya a cambiarla, asi que V2 no los tiene
  // conectados: los REFLEJA. Lee de la base de V1 lo que los equipos reportan y
  // les manda ordenes por el mismo buzon de Redis que usa V1 -igual que si
  // alguien pulsara el boton en el dashboard de V1-. V1 no cambia ni se reinicia.
  // Vacio = instancia normal, con sus propios equipos.
  ESPEJO_DB_HOST: z.string().default(''),
  ESPEJO_DB_PORT: z.coerce.number().default(3306),
  ESPEJO_DB_USER: z.string().default('root'),
  ESPEJO_DB_PASSWORD: z.string().default(''),
  ESPEJO_DB_NAME: z.string().default('space_eye'),
  ESPEJO_REDIS_URL: z.string().default(''),
  // Las fotos de V1 (su volumen, montado solo lectura): se sirven si no estan aqui.
  ESPEJO_STORAGE_DIR: z.string().default(''),
  // Como se le llama a V1 en pantalla ("159.203.188.58:4000").
  ESPEJO_NOMBRE: z.string().default('V1'),

  // MODO INSTANCIA (ver utils/instancia.ts): este Space Eye vive dentro del
  // droplet de una empresa de SPACE OS y es solo suyo. Lo escribe el alta.
  INSTANCIA_OWNER: z.string().default(''),
  // En un Space Eye de empresa, un equipo NUEVO solo entra con un codigo de
  // vinculacion (o el testigo de alta de los instaladores de antes). 'no' lo
  // apaga, solo para emergencias: vuelve a dejar entrar a cualquiera.
  VINCULACION_OBLIGATORIA: z.enum(['si', 'no']).default('si'),
  INSTANCIA_LLAVE: z.string().default(''),
  INSTANCIA_TESTIGO: z.string().default(''),
  ADMIN_EMAIL: z.string().default(''),
  ADMIN_PASSWORD: z.string().default(''),
  // Donde estan los instaladores que se publican (APK, agente de PC, de Pi).
  // En una instancia es un volumen propio: cada empresa tiene los suyos,
  // compilados contra SU servidor. Vacio = frontend/public, como siempre.
  DESCARGAS_DIR: z.string().default(''),

  VIVO_TELEFONOS_POR_SERVIDOR: z
    .string()
    .default('true')
    .transform((v) => !/^(0|false|no|off)$/i.test(v.trim())),

  MEDIASOUP_LISTEN_IP: z.string().default('0.0.0.0'),
  MEDIASOUP_ANNOUNCED_IP: z.string().default('127.0.0.1'),
  MEDIASOUP_MIN_PORT: z.coerce.number().default(40000),
  MEDIASOUP_MAX_PORT: z.coerce.number().default(40100),
});

export const env = schema.parse(process.env);
