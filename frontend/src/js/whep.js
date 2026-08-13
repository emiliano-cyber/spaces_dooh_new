// frontend/src/js/whep.js
// Visor de vista en vivo para los equipos que NO son telefonos (Raspberry y PCs
// con camara IP). Esos equipos no hacen WebRTC punto a punto: empujan el video
// al servidor de medios y aqui se consume de ahi por WebRTC (protocolo WHEP).
//
// Expone la MISMA interfaz que LiveStreamClient (start/stop/sendCameraControl y
// las devoluciones onTick/onAutoStop/onError), asi la ficha del equipo elige uno
// u otro sin cambiar nada mas.

const WHEP_STREAM_MAX_MS = 3 * 60 * 1000;
// El equipo tarda en arrancar la camara y conectar; hasta que publica, el
// servidor responde 404. Se reintenta en vez de darlo por fallido.
const WHEP_ESPERA_MAX_MS = 40000;
const WHEP_REINTENTO_MS = 1500;
// Margen para confirmar que de verdad esta llegando imagen.
const WHEP_CHECK_MS = 12000;

class WhepStreamClient {
  constructor(deviceId, videoElement, opts = {}) {
    this.deviceId = deviceId;
    this.video = videoElement;
    this.pc = null;
    this.recurso = null; // URL que devuelve el servidor para cerrar la sesion

    this.onAutoStop = opts.onAutoStop || (() => {});
    this.onError = opts.onError || (() => {});
    this.onTick = opts.onTick || (() => {});
    this._timers = [];
    this._stopped = false;
    this._onUnload = () => this._beaconStop();
  }

  _timer(fn, ms, repeat) {
    const id = repeat ? setInterval(fn, ms) : setTimeout(fn, ms);
    this._timers.push({ id, repeat });
    return id;
  }

  _clearTimers() {
    for (const t of this._timers) (t.repeat ? clearInterval : clearTimeout)(t.id);
    this._timers = [];
  }

  // STOP_STREAM que sobrevive al cierre de la pestaña, para que el equipo no se
  // quede transmitiendo (y gastando datos) solo.
  _beaconStop() {
    if (this._stopped) return;
    this._stopped = true;
    try {
      fetch(`${window.location.origin}/api/devices/${this.deviceId}/command`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command_type: 'STOP_STREAM' }),
      });
    } catch (e) { /* la pestaña ya se esta cerrando */ }
  }

  async start() {
    // El backend crea una ruta al azar y de un solo uso: le dice al equipo a
    // donde publicar y a nosotros de donde ver.
    const res = await API.post(`/api/devices/${this.deviceId}/command`, {
      command_type: 'START_STREAM',
      payload: { session_id: Date.now().toString() },
    });
    if (!res || !res.stream || !res.stream.whep) {
      throw new Error('el servidor no entrego la direccion de la transmision');
    }
    this.whepUrl = res.stream.whep;
    this.clave = (res.stream.whep.match(/\/([0-9a-f]{8,})\/whep$/) || [])[1] || null;

    // El servidor de medios reparte el MISMO video a varios espectadores sin que
    // al equipo le cueste un byte de mas, asi que si ya habia una vista abierta
    // el backend nos devuelve esa en vez de arrancar otra. Se recuerda para
    // poder avisar con quien la estamos compartiendo.
    this.compartida = res.compartida === true;
    this.compartidaCon = res.con || null;

    this.endsAt = Date.now() + WHEP_STREAM_MAX_MS;
    window.addEventListener('pagehide', this._onUnload);
    window.addEventListener('beforeunload', this._onUnload);
    this._timer(() => this.onAutoStop(), WHEP_STREAM_MAX_MS);
    this._timer(() => {
      this.onTick(Math.max(0, Math.round((this.endsAt - Date.now()) / 1000)));
    }, 1000, true);

    await this._conectarConReintentos();
    this._timer(() => this._checkMedia(), WHEP_CHECK_MS);
  }

  // Se espera preguntandole AL BACKEND si el equipo ya empezo a publicar, en vez
  // de tocarle la puerta al servidor de video: asi no se llena la consola de
  // errores 404 mientras la camara del equipo arranca (tarda unos segundos).
  async _esperarAlEquipo() {
    const limite = Date.now() + WHEP_ESPERA_MAX_MS;
    while (Date.now() < limite && !this._stopped) {
      try {
        const r = await API.get(`/api/devices/${this.deviceId}/stream-status?key=${this.clave}`);
        if (r && r.listo) return true;
      } catch (e) {
        // El backend viejo no conoce este endpoint: se conecta a ciegas.
        if (e && e.status === 404) return true;
      }
      await new Promise((r) => setTimeout(r, WHEP_REINTENTO_MS));
    }
    return false;
  }

  async _conectarConReintentos() {
    // Si no se puede saber la clave, se intenta directo (comportamiento previo).
    if (this.clave && !(await this._esperarAlEquipo())) {
      if (!this._stopped) {
        this.onError('El equipo no comenzó a transmitir. Puede estar sin señal o con la cámara ocupada.');
      }
      return;
    }
    if (this._stopped) return;
    try {
      await this._conectar();
    } catch (e) {
      this.onError(`No se pudo conectar el video (${e.message}).`);
    }
  }

  async _conectar() {
    this.pc = new RTCPeerConnection();
    // Solo recibimos: el dashboard nunca manda video ni audio.
    this.pc.addTransceiver('video', { direction: 'recvonly' });

    this.pc.ontrack = (evt) => {
      const stream = (evt.streams && evt.streams[0]) ? evt.streams[0] : new MediaStream([evt.track]);
      this.video.srcObject = stream;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.play().catch((e) => console.warn('[WHEP] play() bloqueado:', e.name));
    };

    this.pc.oniceconnectionstatechange = () => {
      const st = this.pc ? this.pc.iceConnectionState : 'closed';
      console.log('[WHEP] ICE:', st);
      if (st === 'failed') {
        this.onError('Se perdió la conexión de video con el servidor.');
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    // Sin "trickle": se esperan todas las candidatas y se manda una sola oferta
    // completa. Es lo mas compatible y evita depender de PATCH en el servidor.
    await this._esperarIce();

    const resp = await fetch(this.whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: this.pc.localDescription.sdp,
    });
    if (!resp.ok) {
      this.pc.close();
      this.pc = null;
      throw new Error(`HTTP ${resp.status}`);
    }
    this.recurso = resp.headers.get('location') || null;
    const answer = await resp.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answer });
  }

  _esperarIce() {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      const listo = () => {
        if (this.pc && this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', listo);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', listo);
      // Si alguna candidata tarda, no se espera para siempre.
      setTimeout(resolve, 3000);
    });
  }

  // Conectado pero sin imagen: el caso que se veia como recuadro negro.
  async _checkMedia() {
    if (!this.pc) return;
    try {
      const stats = await this.pc.getStats();
      let bytes = 0;
      stats.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') bytes = r.bytesReceived || 0;
      });
      console.log(`[WHEP] diagnostico: video recibido=${bytes} bytes; ICE=${this.pc.iceConnectionState}`);
      if (bytes === 0) {
        this.onError('Conectado con el servidor pero no está llegando imagen del equipo.');
      }
    } catch (e) {
      console.warn('[WHEP] getStats fallo:', e.message);
    }
  }

  // El control manual de camara todavia no existe en estos equipos (la Raspberry
  // lo tendra con los controles de libcamera). Se ignora en silencio para no
  // romper la ficha, que lo llama al abrir el stream.
  sendCameraControl() {}

  async stop() {
    this._clearTimers();
    window.removeEventListener('pagehide', this._onUnload);
    window.removeEventListener('beforeunload', this._onUnload);

    if (!this._stopped) {
      this._stopped = true;
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, { command_type: 'STOP_STREAM' });
      } catch (e) { /* ignore */ }
    }

    // Cerrar tambien la sesion en el servidor de medios.
    if (this.recurso) {
      try { await fetch(this.recurso, { method: 'DELETE' }); } catch (e) { /* ignore */ }
      this.recurso = null;
    }

    this.pc?.close();
    this.pc = null;
    if (this.video) this.video.srcObject = null;
  }
}
