// backend/src/services/verification.service.ts
import { Queue, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const verificationQueue = new Queue('verification', {
  // bullmq empaqueta su propia copia de ioredis; la instancia es compatible en
  // runtime pero difiere nominalmente en tipos, de ahí el cast.
  connection: connection as unknown as ConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});
