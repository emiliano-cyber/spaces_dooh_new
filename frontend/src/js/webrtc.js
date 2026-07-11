// frontend/src/js/webrtc.js
class LiveStreamClient {
  constructor(deviceId, videoElement) {
    this.deviceId = deviceId;
    this.video = videoElement;
    this.pc = null;
    this.socket = null;
    // ICE candidates que llegan antes de fijar la descripcion remota: se
    // encolan y se aplican despues. Sin esto se descartaban y el stream
    // conectaba de forma intermitente (a veces negro).
    this.pendingCandidates = [];
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

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', this.pc.iceConnectionState);
    };

    // Listen for offer from device (sdp comes as { type: "offer", sdp: "v=0..." })
    this.socket.on('webrtc_offer', async (data) => {
      try {
        const sdpObj = data.sdp;
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
  }

  // Control manual de camara en vivo (zoom, enfoque, exposicion, WB, lock).
  // Va por el mismo socket /dashboard que la señalizacion; canal efimero.
  sendCameraControl(control) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('camera_control', { device_id: this.deviceId, control });
    }
  }

  async stop() {
    try {
      await API.post(`/api/devices/${this.deviceId}/command`, {
        command_type: 'STOP_STREAM',
      });
    } catch (e) { /* ignore */ }

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
