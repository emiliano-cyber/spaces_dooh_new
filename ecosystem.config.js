// El proceso `spaces-api` (Fastify) se retiró: ese backend nunca se desplegó y
// se archivó en /_archive/api (Hardening 1 · Bloque G). El backend vivo es el
// BFF dentro del propio `spaces-web` (Next.js Route Handlers).
module.exports = {
  apps: [
    {
      name: 'spaces-web',
      cwd: './apps/web',
      script: 'npm',
      args: 'start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
