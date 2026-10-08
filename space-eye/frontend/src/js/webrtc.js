// frontend/src/js/webrtc.js

// Duracion maxima de una transmision. Si alguien abre el stream y se va sin
// detenerlo, el telefono seguiria transmitiendo (gastando datos y bateria) y
// dejaba sesiones WebRTC zombis: se veian en coturn reintentando con
// credenciales ya vencidas. A los 3 minutos se corta solo.
const STREAM_MAX_MS = 3 * 60 * 1000;
// Si el equipo no manda su offer en este tiempo, no va a transmitir.
const OFFER_TIMEOUT_MS = 20000;
// Margen para que ICE conecte y empiece a llegar video antes de avisar.
const MEDIA_CHECK_MS = 12000;

class LiveStreamClient {
  // opts: { onAutoStop, onError, onTick(segundosRestantes) }
  constructor(deviceId, videoElement, opts = {}) {
    this.deviceId = deviceId;
    this.video = videoElement;
    this.pc = null;
    this.socket = null;
    // ICE candidates que llegan antes de fijar la descripcion remota: se
    // encolan y se aplican despues. Sin esto se descartaban y el stream
    // conectaba de forma intermitente (a veces negro).
    this.pendingCandidates = [];

    this.onAutoStop = opts.onAutoStop || (() => {});
    this.onError = opts.onError || (() => {});
    this.onTick = opts.onTick || (() => {});
    this._timers = [];
    this._gotOffer = false;
    this._stopped = false;
    // Si se cierra la pestaña sin detener, avisamos al equipo igual.
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

  // STOP_STREAM que sobrevive al cierre de la pestaña (keepalive), para que el
  // telefono no se quede transmitiendo solo.
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
    this.socket = io('/dashboard', {
      auth: { token: localStorage.getItem('access_token') },
      transports: ['websocket', 'polling'],
    });

    await new Promise((resolve, reject) => {
      this.socket.on('connect', resolve);
      this.socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('socket_timeout')), 5000);
    });

    // Join the watching room so we receive offers/ICE from this device
    this.socket.emit('watch_device', this.deviceId);

    // ICE servers desde el backend (incluye TURN para redes remotas / datos
    // moviles). Si falla, cae a STUN publico.
    let iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    try {
      const data = await API.get('/api/ice-servers');
      if (data && Array.isArray(data.iceServers) && data.iceServers.length) {
        iceServers = data.iceServers;
      }
    } catch (e) {
      console.warn('[WebRTC] no se pudieron obtener ICE servers, usando STUN', e);
    }

    this.pc = new RTCPeerConnection({ iceServers });

    // El ajuste de encuadre/rotacion lo gestiona device-detail.js
    // (applyVideoTransform), que es la unica fuente de verdad del estilo del video.
    this.video.onloadedmetadata = () => {
      console.log('[WebRTC] video metadata:', this.video.videoWidth + 'x' + this.video.videoHeight);
    };

    this.pc.ontrack = (evt) => {
      console.log('[WebRTC] ontrack — received remote stream; streams=' + (evt.streams ? evt.streams.length : 0));
      // El device hace addTrack() sin stream id, asi que evt.streams suele venir
      // vacio: en ese caso armamos el MediaStream a partir del track recibido.
      let stream = (evt.streams && evt.streams[0]) ? evt.streams[0] : null;
      if (!stream) {
        stream = new MediaStream([evt.track]);
        console.log('[WebRTC] stream reconstruido desde evt.track');
      }
      this.video.srcObject = stream;
      // Autoplay fiable: muted + play() explicito.
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.play()
        .then(() => console.log('[WebRTC] video.play() OK'))
        .catch((e) => console.warn('[WebRTC] video.play() bloqueado:', e.name, e.message));
    };

    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.socket.emit('webrtc_ice_candidate', {
          device_id: this.deviceId,
          candidate: {
            sdpMid: evt.candidate.sdpMid,
            sdpMLineIndex: evt.candidate.sdpMLineIndex,
            candidate: evt.candidate.candidate,
          },
        });
      }
    };

    // Antes esto solo se imprimia en consola: si ICE fallaba, el recuadro se
    // quedaba negro para siempre sin decir nada. Ahora se avisa y se corta.
    this.pc.oniceconnectionstatechange = () => {
      const st = this.pc ? this.pc.iceConnectionState : 'closed';
      console.log('[WebRTC] ICE state:', st);
      if (st === 'failed') {
        this.onError('No se pudo establecer la conexión de video con el equipo (red del sitio). Vuelve a intentar.');
      } else if (st === 'disconnected') {
        // Puede recuperarse solo; damos margen antes de avisar.
        this._timer(() => {
          if (this.pc && this.pc.iceConnectionState === 'disconnected') {
            this.onError('Se perdió la conexión de video con el equipo.');
          }
        }, 10000);
      }
    };

    // Listen for offer from device (sdp comes as { type: "offer", sdp: "v=0..." })
    this.socket.on('webrtc_offer', async (data) => {
      try {
        const sdpObj = data.sdp;
        this._gotOffer = true;
        console.log('[WebRTC] Received offer from device');
        await this.pc.setRemoteDescription(
          new RTCSessionDescription({ type: sdpObj.type, sdp: sdpObj.sdp })
        );
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.socket.emit('webrtc_answer', {
          device_id: this.deviceId,
          sdp: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });
        console.log('[WebRTC] Answer sent');

        // Aplicar los ICE candidates que llegaron antes de la descripcion remota.
        for (const c of this.pendingCandidates) {
          try { await this.pc.addIceCandidate(c); } catch (e) { console.warn('[WebRTC] pending ICE:', e.message); }
        }
        console.log('[WebRTC] flushed ' + this.pendingCandidates.length + ' pending ICE');
        this.pendingCandidates = [];
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    // Listen for ICE candidates from device
    this.socket.on('webrtc_ice_candidate', async (data) => {
      if (!data.candidate) return;
      const c = new RTCIceCandidate({
        sdpMid: data.candidate.sdpMid,
        sdpMLineIndex: data.candidate.sdpMLineIndex,
        candidate: data.candidate.candidate,
      });
      // Si aun no hay descripcion remota, encolar; si ya hay, aplicar.
      if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
        try { await this.pc.addIceCandidate(c); }
        catch (err) { console.warn('[WebRTC] Error adding ICE candidate:', err.message); }
      } else {
        this.pendingCandidates.push(c);
      }
    });

    // Send START_STREAM command to device via API
    await API.post(`/api/devices/${this.deviceId}/command`, {
      command_type: 'START_STREAM',
      payload: { session_id: Date.now().toString() },
    });

    console.log('[WebRTC] START_STREAM command sent');

    this.endsAt = Date.now() + STREAM_MAX_MS;
    window.addEventListener('pagehide', this._onUnload);
    window.addEventListener('beforeunload', this._onUnload);

    // Corte automatico a los 3 minutos.
    this._timer(() => this.onAutoStop(), STREAM_MAX_MS);
    // Cuenta regresiva para la interfaz.
    this._timer(() => {
      this.onTick(Math.max(0, Math.round((this.endsAt - Date.now()) / 1000)));
    }, 1000, true);

    // El equipo no mando su offer: no esta transmitiendo.
    this._timer(() => {
      if (!this._gotOffer) {
        this.onError('El equipo no respondió a la solicitud de transmisión. Puede estar sin señal o con la app reiniciándose.');
      }
    }, OFFER_TIMEOUT_MS);

    // Conectado pero sin imagen: es el caso que se veia como recuadro negro.
    this._timer(() => this._checkMedia(), MEDIA_CHECK_MS);
  }

  // Revisa por getStats si de verdad esta llegando video, y deja en consola el
  // par de candidatos elegido (util para diagnosticar equipos tras CGNAT).
  async _checkMedia() {
    if (!this.pc) return;
    try {
      const stats = await this.pc.getStats();
      let bytes = 0, pairLocal = '?', pairRemote = '?';
      const byId = new Map();
      stats.forEach((r) => byId.set(r.id, r));
      stats.forEach((r) => {
        if (r.type === 'inbound-rtp' && r.kind === 'video') bytes = r.bytesReceived || 0;
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
          const l = byId.get(r.localCandidateId), rc = byId.get(r.remoteCandidateId);
          if (l) pairLocal = `${l.candidateType}/${l.protocol}`;
          if (rc) pairRemote = `${rc.candidateType}/${rc.protocol}`;
        }
      });
      console.log(`[WebRTC] diagnostico: video recibido=${bytes} bytes; par=${pairLocal} <-> ${pairRemote}; ICE=${this.pc.iceConnectionState}`);
      if (bytes === 0) {
        this.onError(this.pc.iceConnectionState === 'connected'
          ? 'Conectado con el equipo pero no está llegando imagen (cámara ocupada o codificador del teléfono).'
          : 'No se logró conectar el video con el equipo (red del sitio).');
      }
    } catch (e) {
      console.warn('[WebRTC] getStats falló:', e.message);
    }
  }

  // Control manual de camara en vivo (zoom, enfoque, exposicion, WB, lock).
  // Va por el mismo socket /dashboard que la señalizacion; canal efimero.
  sendCameraControl(control) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('camera_control', { device_id: this.deviceId, control });
    }
  }

  async stop() {
    this._clearTimers();
    window.removeEventListener('pagehide', this._onUnload);
    window.removeEventListener('beforeunload', this._onUnload);

    if (!this._stopped) {
      this._stopped = true;
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, {
          command_type: 'STOP_STREAM',
        });
      } catch (e) { /* ignore */ }
    }

    this.pc?.close();
    this.pc = null;

    if (this.socket) {
      this.socket.emit('unwatch_device', this.deviceId);
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.video) this.video.srcObject = null;
  }
}
