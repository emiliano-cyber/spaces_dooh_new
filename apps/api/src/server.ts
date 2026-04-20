import 'dotenv/config'
import Fastify from 'fastify'
import { buildApp } from './app'
import { createWorker } from './jobs/queue'
import { alertVencimientosProcessor } from './jobs/alert-vencimientos.job'
import { scheduleAlertJobs } from './jobs/scheduler'

const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '0.0.0.0'

export const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined, // JSON puro en producción para parseo centralizado
  },
})

const alertasWorker = createWorker('alertas-vencimiento', alertVencimientosProcessor)

alertasWorker.on('completed', (job) => {
  app.log.info(`[worker] Job ${job.id} completado`)
})
alertasWorker.on('failed', (job, err) => {
  app.log.error(`[worker] Job ${job?.id} falló: ${err.message}`)
})

buildApp(app)
  .then(() => app.listen({ port: PORT, host: HOST }))
  .then(async (address) => {
    app.log.info(`Server listening at ${address}`)
    app.log.info('[worker] Worker alertas-vencimiento activo')
    await scheduleAlertJobs()
  })
  .catch((err) => {
    app.log.error(err)
    process.exit(1)
  })

async function shutdown() {
  app.log.info('Shutting down...')
  await alertasWorker.close()
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
