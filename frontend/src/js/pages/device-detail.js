// frontend/src/js/pages/device-detail.js
requireAuth();

function deviceDetail() {
  return {
    deviceId: null,
    device: null,
    status: null,
    recentPhotos: [],
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
    photoMsg: '',

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.deviceId = params.get('id');
      if (!this.deviceId) {
        window.location.href = '/dashboard.html';
        return;
      }

      await this.loadDevice();
      await this.loadPhotos();

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

    async takePhoto() {
      if (this.takingPhoto) return;
      this.takingPhoto = true;
      this.photoMsg = 'Tomando foto…';
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, {
          command_type: 'TAKE_PHOTO',
          priority: 1,
        });
        // El device tarda ~2-6s en capturar y subir. Sondeamos hasta que
        // aparezca una foto nueva, mostrando el estado al usuario.
        const before = this.recentPhotos[0]?.id;
        let tries = 0;
        const poll = setInterval(async () => {
          tries++;
          await this.loadPhotos();
          if (this.recentPhotos[0]?.id !== before) {
            clearInterval(poll);
            this.takingPhoto = false;
            this.photoMsg = '✓ Foto lista';
            setTimeout(() => { this.photoMsg = ''; }, 2500);
          } else if (tries >= 12) {  // ~24s sin foto nueva
            clearInterval(poll);
            this.takingPhoto = false;
            this.photoMsg = 'No llegó la foto (la cámara puede estar ocupada por el stream).';
            setTimeout(() => { this.photoMsg = ''; }, 5000);
          }
        }, 2000);
      } catch (err) {
        this.takingPhoto = false;
        this.photoMsg = 'Error al enviar el comando';
        setTimeout(() => { this.photoMsg = ''; }, 4000);
      }
    },

    async startStream() {
      const video = document.getElementById('liveVideo');
      this.streamClient = new LiveStreamClient(Number(this.deviceId), video);
      await this.streamClient.start();
      this.streaming = true;
      // Re-aplicar los ajustes que definiste, cuando la camara ya este lista.
      setTimeout(() => this.reapplyControls(), 1500);
    },

    async stopStream() {
      await this.streamClient?.stop();
      this.streamClient = null;
      this.streaming = false;
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

    // Rotacion del video en el visor (recorte/encuadre visual, lado navegador).
    rotate() { this.rotation = (this.rotation + 90) % 360; },

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
