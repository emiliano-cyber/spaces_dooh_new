// pi-agent/src/api.js
// Cliente del backend de Space Eye. Habla EXACTAMENTE los mismos endpoints que
// la APK de Android y que el agente de PC (/api/device/*), asi la Raspberry
// aparece en el dashboard como cualquier otro equipo y hereda galeria, marca de
// informacion, verificacion con IA, telemetria y fotos programadas sin tocar el
// servidor.
//
// Es casi identico al de pc-agent a proposito: el contrato de dispositivo es el
// mismo y conviene que se note. Se mantiene una copia por agente para que cada
// uno se pueda desplegar solo, sin dependencias entre carpetas.
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
      throw err;
    }
    return res.json();
  }

  // El backend identifica al equipo por device_uid: si se reinstala el agente
  // con el mismo uid, se reutiliza el mismo equipo en vez de duplicarlo.
  async registrar({ device_uid, app_version, model, manufacturer, os_version }) {
    const r = await this._req('POST', '/api/device/register', {
      device_uid,
      android_version: os_version, // el backend llama asi al campo de version del SO
      app_version,
      model,
      manufacturer,
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
  async subirFoto(jpeg, { taken_at, command_id, schedule_id, campaign_id, source, phash }) {
    const fd = new FormData();
    fd.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'foto.jpg');
    fd.append('taken_at', taken_at);
    fd.append('source', source || 'manual');
    fd.append('watermark_baked', 'false');
    if (command_id) fd.append('command_id', String(command_id));
    if (schedule_id) fd.append('schedule_id', String(schedule_id));
    if (campaign_id) fd.append('campaign_id', String(campaign_id));
    // Solo con source=creative_change: liga la foto al creativo que la disparo,
    // para que en el dashboard la ficha del creativo muestre su imagen.
    if (phash) fd.append('phash', phash);
    return this._req('POST', '/api/device/upload-photo', fd);
  }

  // Configuracion de vigilancia del loop y catalogo de huellas ya conocidas.
  creativos() {
    return this._req('GET', '/api/device/creativos');
  }
}

module.exports = { Api };
