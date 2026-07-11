// frontend/src/js/pages/device-detail.js
requireAuth();

function deviceDetail() {
  return {
    deviceId: null,
    device: null,
    status: null,
    recentPhotos: [],
    logs: [],
    streaming: false,
    streamClient: null,
    lightbox: null,   // foto abierta en grande (null = cerrado)
    // Estado del control manual de camara (solo activo durante el stream)
    zoom: 0,
    exposure: 0,
    wb: 'auto',
    focusLocked: false,
    rotation: 0,   // rotacion del video en el visor (0/90/180/270)
    takingPhoto: false,
    toast: { show: false, msg: '', type: 'info' },
    _toastT: null,

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.deviceId = params.get('id');
      if (!this.deviceId) {
        window.location.href = '/dashboard.html';
        return;
      }

      await this.loadDevice();
      await this.loadPhotos();
      await this.loadLogs();
      // Refresca los registros remotos periodicamente.
      setInterval(() => this.loadLogs(), 15000);

      dashboardSocket.connect();
      dashboardSocket.watchDevice(Number(this.deviceId));
      dashboardSocket.on('device:status', (data) => {
        if (data.device_id === Number(this.deviceId)) {
          this.status = { ...this.status, ...data };
        }
      });
      dashboardSocket.on('device:online', (data) => {
        if (data.device_id === Number(this.deviceId)) {
          this.device.online = data.online;
        }
      });
    },

    async loadDevice() {
      try {
        const data = await API.get(`/api/devices/${this.deviceId}`);
        this.device = data.device;
        this.status = data.latest_status;
      } catch (err) {
        console.error('Failed to load device:', err);
      }
    },

    async loadPhotos() {
      try {
        const data = await API.get(`/api/photos?device_id=${this.deviceId}&limit=12`);
        this.recentPhotos = data.photos;
      } catch (err) {
        console.error('Failed to load photos:', err);
      }
    },

    async loadLogs() {
      try {
        const data = await API.get(`/api/devices/${this.deviceId}/logs?limit=50`);
        this.logs = data.logs;
      } catch (err) {
        /* silencioso */
      }
    },

    async takePhoto() {
      if (this.takingPhoto) return;
      this.takingPhoto = true;   // dispara el modal "Capturando fotografía…"
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, {
          command_type: 'TAKE_PHOTO',
          priority: 1,
        });
        // El device tarda ~2-6s en capturar y subir. Sondeamos hasta que
        // aparezca una foto nueva.
        const before = this.recentPhotos[0]?.id;
        let tries = 0;
        const poll = setInterval(async () => {
          tries++;
          await this.loadPhotos();
          if (this.recentPhotos[0]?.id !== before) {
            clearInterval(poll);
            this.takingPhoto = false;
            this.showToast('✓ Fotografía capturada', 'success');
          } else if (tries >= 12) {  // ~24s sin foto nueva
            clearInterval(poll);
            this.takingPhoto = false;
            this.showToast('No llegó la foto (la cámara puede estar ocupada por el stream).', 'error');
          }
        }, 2000);
      } catch (err) {
        this.takingPhoto = false;
        this.showToast('Error al enviar el comando', 'error');
      }
    },

    showToast(msg, type = 'info') {
      this.toast = { show: true, msg, type };
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { this.toast.show = false; }, 3200);
    },

    async deletePhoto(id) {
      if (!confirm('¿Eliminar esta fotografía? Esta acción no se puede deshacer.')) return;
      try {
        await API.delete(`/api/photos/${id}`);
        this.recentPhotos = this.recentPhotos.filter((p) => p.id !== id);
        if (this.lightbox && this.lightbox.id === id) this.lightbox = null;
        this.showToast('Fotografía eliminada', 'success');
      } catch (e) {
        this.showToast('No se pudo eliminar la fotografía', 'error');
      }
    },

    async startStream() {
      const video = document.getElementById('liveVideo');
      this.streamClient = new LiveStreamClient(Number(this.deviceId), video);
      await this.streamClient.start();
      this.streaming = true;
      // Ajustar encuadre/rotacion cuando lleguen frames y en cada resize.
      const v = document.getElementById('liveVideo');
      v.addEventListener('loadedmetadata', () => this.applyVideoTransform());
      v.addEventListener('resize', () => this.applyVideoTransform());
      this._resizeHandler = () => this.applyVideoTransform();
      window.addEventListener('resize', this._resizeHandler);
      setTimeout(() => this.applyVideoTransform(), 400);
      // Re-aplicar los ajustes que definiste, cuando la camara ya este lista.
      setTimeout(() => this.reapplyControls(), 1500);
    },

    async stopStream() {
      await this.streamClient?.stop();
      this.streamClient = null;
      this.streaming = false;
      if (this._resizeHandler) {
        window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = null;
      }
      // Se conservan zoom/exposicion/wb/foco/rotacion para el proximo stream.
    },

    // Reenvia los ajustes actuales al device (persisten entre reconexiones).
    reapplyControls() {
      if (!this.streaming) return;
      if (Number(this.zoom) > 0) this.onZoom();
      if (Number(this.exposure) !== 0) this.onExposure();
      if (this.wb !== 'auto') this.onWb();
      if (this.focusLocked) this.camControl({ action: 'lock_focus', x: 0.5, y: 0.5 });
    },

    // Rotacion del video en el visor (lado navegador).
    rotate() {
      this.rotation = (this.rotation + 90) % 360;
      this.applyVideoTransform();
    },

    // Ajusta tamaño + rotacion del video para que SIEMPRE encaje en el recuadro,
    // como una camara real al girarla (sin sobresalir ni deformarse). Al rotar
    // 90/270 se intercambian ancho/alto para que, tras el giro, ocupe el cuadro.
    applyVideoTransform() {
      const v = document.getElementById('liveVideo');
      if (!v || !v.parentElement) return;
      const box = v.parentElement;
      const cw = box.clientWidth, ch = box.clientHeight;
      const r = ((this.rotation % 360) + 360) % 360;
      if (r === 90 || r === 270) {
        v.style.width = ch + 'px';
        v.style.height = cw + 'px';
      } else {
        v.style.width = cw + 'px';
        v.style.height = ch + 'px';
      }
      v.style.position = 'absolute';
      v.style.left = '50%';
      v.style.top = '50%';
      v.style.objectFit = 'contain';   // muestra el cuadro completo, sin deformar
      v.style.transform = `translate(-50%, -50%) rotate(${r}deg)`;
    },

    // --- Control manual de camara (solo con stream activo) ---
    camControl(control) {
      if (!this.streaming || !this.streamClient) return;
      this.streamClient.sendCameraControl(control);
    },
    onZoom() { this.camControl({ action: 'zoom', value: Number(this.zoom) }); },
    onExposure() { this.camControl({ action: 'exposure', value: Number(this.exposure) }); },
    onWb() { this.camControl({ action: 'wb', value: this.wb }); },
    toggleFocusLock() {
      this.focusLocked = !this.focusLocked;
      this.camControl({ action: this.focusLocked ? 'lock_focus' : 'unlock_focus', x: 0.5, y: 0.5 });
    },
    focusPoint(evt) {
      if (!this.streaming) return;
      const rect = evt.currentTarget.getBoundingClientRect();
      const x = (evt.clientX - rect.left) / rect.width;
      const y = (evt.clientY - rect.top) / rect.height;
      this.camControl({ action: 'focus', x, y });
    },

    async rebootApp() {
      if (!confirm('Reiniciar la app en el device?')) return;
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, {
          command_type: 'REBOOT_APP',
        });
        alert('Comando enviado');
      } catch (err) {
        alert('Error al enviar comando');
      }
    },
  };
}
