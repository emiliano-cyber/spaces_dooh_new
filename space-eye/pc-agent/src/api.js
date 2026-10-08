// pc-agent/src/api.js
// Cliente del backend de Space Eye. Habla EXACTAMENTE los mismos endpoints que
// la APK de Android (/api/device/*), asi el sitio con camara aparece en el
// dashboard como cualquier otro equipo y hereda galeria, marca de informacion,
// verificacion con IA, telemetria y fotos programadas sin tocar el servidor.
class Api {
  constructor(baseUrl, timeoutMs = 30000) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.token = null;
  }

  async _req(metodo, ruta, cuerpo, extraHeaders) {
    const headers = { ...(extraHeaders || {}) };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (cuerpo && !(cuerpo instanceof FormData)) headers['Content-Type'] = 'application/json';

    const res = await fetch(this.base + ruta, {
      method: metodo,
      headers,
      body: cuerpo instanceof FormData ? cuerpo : cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      const err = new Error(`${metodo} ${ruta} -> HTTP ${res.status} ${txt.slice(0, 200)}`);
      err.status = res.status;
      // El cuerpo entero, no solo el recorte del mensaje: quien llama necesita
      // distinguir un 401 por token caducado de un 401 por testigo invalido.
      err.cuerpo = txt;
      throw err;
    }
    return res.json();
  }

  // El backend identifica al equipo por device_uid: si se reinstala el agente con
  // el mismo uid, se reutiliza el mismo equipo en vez de duplicarlo.
  // `provision_token` es el testigo de alta que viaja DENTRO del instalador. No
  // lleva el nombre del dueno: el servidor mira de quien es el testigo y estampa
  // el dueno el mismo, asi el equipo no puede declararse de quien quiera. Se
  // manda solo si existe -sin testigo el alta es la de siempre y el equipo nace
  // sin dueno, a la espera de que alguien lo asigne desde el dashboard.
  async registrar({ device_uid, app_version, model, manufacturer, os_version, provision_token, codigo_vinculacion }) {
    const r = await this._req('POST', '/api/device/register', {
      device_uid,
      android_version: os_version, // el backend llama asi al campo de version del SO
      app_version,
      model,
      manufacturer,
      ...(provision_token ? { provision_token } : {}),
      // Codigo de un solo uso de SPACE OS: lo que deja entrar a un equipo nuevo.
      ...(codigo_vinculacion ? { codigo_vinculacion } : {}),
    });
    this.token = r.token;
    return r;
  }

  reportarEstado(estado) {
    return this._req('POST', '/api/device/status', estado);
  }

  comandosPendientes() {
    return this._req('GET', '/api/device/pending-commands');
  }

  resultadoComando(command_id, success, result, error_message) {
    return this._req('POST', '/api/device/command-result', {
      command_id, success, result, error_message,
    });
  }

  log(level, category, message, metadata) {
    return this._req('POST', '/api/device/log', { level, category, message, metadata })
      .catch(() => {}); // el logging nunca debe tumbar al agente
  }

  // La foto va como multipart, campo "photo", igual que en la APK.
  // watermark_baked=false -> el dashboard dibuja la marca configurable encima.
  async subirFoto(jpeg, { taken_at, command_id, schedule_id, campaign_id, source }) {
    const fd = new FormData();
    fd.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'foto.jpg');
    fd.append('taken_at', taken_at);
    fd.append('source', source || 'manual');
    fd.append('watermark_baked', 'false');
    if (command_id) fd.append('command_id', String(command_id));
    if (schedule_id) fd.append('schedule_id', String(schedule_id));
    if (campaign_id) fd.append('campaign_id', String(campaign_id));
    return this._req('POST', '/api/device/upload-photo', fd);
  }
}

module.exports = { Api };
