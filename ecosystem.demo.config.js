// ============================================================================
//  DEMO — el segundo proceso, en la misma máquina que el PADRE.
// ----------------------------------------------------------------------------
//  Arreglo del 2026-08-24: al perderse el droplet viejo, la demostración pasa a
//  vivir dentro del PADRE. Mismo código, distinta base, distinto puerto,
//  distinto usuario del sistema.
//
//    PADRE  ecosystem.config.js       :3000   spaces_prod   usuario root (*)
//    DEMO   ecosystem.demo.config.js  :3001   spaces_demo   usuario demo
//
//  (*) El PADRE corre como root, medido el 24/08 (`pm2 describe spaces-web`).
//      Eso merece corregirse aparte; DEMO no lo hereda.
//
//  ─── Por qué un archivo aparte y no una segunda entrada en el de siempre ───
//
//  Porque pm2 no sabe cambiar de usuario por aplicación: el usuario lo fija el
//  proceso pm2 que la arranca. Para que DEMO corra como `demo` hace falta el
//  pm2 DE ESE USUARIO, con su propia lista de procesos. Meterlo en el
//  `ecosystem.config.js` del PADRE daría a entender que un `pm2 start` los
//  levanta a los dos, y no es verdad.
//
//  ─── De dónde salen las variables, y por qué NO están aquí ────────────────
//
//  `DATABASE_URL` lleva contraseña, así que no se versiona. Vive en
//  `/etc/space-os/demo.env`, a 600 y del usuario `demo` — el defecto ⑦ del
//  21/08 fue exactamente esto: `.env.production` nació 644 con la clave dentro.
//
//  Se cargan al arrancar, y pm2 se las queda en su lista guardada:
//
//      sudo -u demo bash -lc '
//        set -a; . /etc/space-os/demo.env; set +a
//        cd /var/www/Spaces
//        pm2 start ecosystem.demo.config.js
//        pm2 save
//      '
//
//  ⚠️ El orden importa: Next carga `.env.production` **sin pisar** lo que ya
//  esté en el entorno, así que lo de `/etc/space-os/demo.env` gana. Si algún día
//  eso cambiara, DEMO acabaría hablando con la base del PADRE — y no daría
//  error, solo enseñaría los datos equivocados. Se comprueba mirando qué base
//  contesta, no suponiéndolo:
//
//      curl -s https://demo.space-os.io/spaces-dooh/api/estado/ | head -c 200
//
//  ─── Lo que ese .env TIENE que llevar ─────────────────────────────────────
//
//      DATABASE_URL=postgresql://spaces_app:<clave>@127.0.0.1:5432/spaces_demo
//      APP_URL=https://demo.space-os.io
//      COOKIE_SECURE=1
//      AUTOREGISTRO=0                  <- P8: cerrado en TODA la flota, DEMO incluida
//      DOOHMAIN_PUBLISH_ENABLED=0      <- ver abajo, no es opcional
//
//  ⚠️ `DOOHMAIN_PUBLISH_ENABLED=0` NO ES NEGOCIABLE, y el motivo es más
//  duradero que el que decía aquí antes.
//
//  CORREGIDO EL 2026-08-24 POR EMILIANO: la publicación de SPACE OS ha ido
//  siempre a PANTALLAS DE PRUEBA de DOOHmain, nunca a pantallas de cliente.
//  Este comentario decía «LLEGA A PANTALLAS REALES», y eso el código no lo
//  sabe: solo sabe que con el flag en 1 el contenido SALE de verdad por el SDK
//  Python hacia DOOHmain. Qué hay al otro lado es un dato de negocio.
//
//  Sigue en 0, por lo que sí se sostiene:
//    · El destino es CONFIGURACIÓN -- `DOOHMAIN_SCREEN_MAP` y
//      `DOOHMAIN_DEFAULT_SCREEN`. Hoy apunta a pruebas; mañana lo cambia
//      cualquiera, y entonces la demo publicaría donde apunte.
//    · Una demostración no tiene por qué publicar a NINGÚN sitio: ensucia la
//      cuenta compartida de DOOHmain y ocupa pantallas que otros usan.
//    · Y lo que enseñó `eyro`: lo publicado NO se retira borrando filas de esta
//      base. Eso lo decide el SDK, no un `delete`
//      (`docs/datos/20260810_reset_tenant_eyro.sql:14-21`).
//
//  El argumento ya no depende de una afirmación que resultó falsa.
// ============================================================================
module.exports = {
  apps: [
    {
      name: 'spaces-demo',
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
        // Solo lo que NO es secreto. El resto llega del entorno ya cargado.
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Logs propios: mezclarlos con los del PADRE haría imposible saber cuál
      // de los dos sitios falló.
      error_file: './logs/demo-error.log',
      out_file: './logs/demo-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
