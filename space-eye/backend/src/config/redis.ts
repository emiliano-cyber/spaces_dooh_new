// backend/src/config/redis.ts
import { createClient } from 'redis';
import { env } from './env';

export const redis = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis max retries reached');
      return Math.min(retries * 200, 5000);
    },
  },
});

redis.on('error', (err) => {
  if (!(err as any)._logged) {
    console.error('[Redis] error:', err.message);
    (err as any)._logged = true;
  }
});

export async function connectRedis() {
  await redis.connect();
  console.log('[Redis] connected');
}
