import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const alertasQueue = new Queue('alertas-vencimiento', { connection })
export const readinessQueue = new Queue('readiness-check', { connection })

export function createWorker(queueName: string, processor: any) {
  return new Worker(queueName, processor, { connection })
}
