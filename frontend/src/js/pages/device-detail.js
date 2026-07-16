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
    lbRotation: 0,    // rotacion de la foto en el visor
    albumDownloading: false,
    albumProgress: '',
    editMode: false,
    editForm: {},
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
          // Rotacion del visor + nombre del sitio -> el telefono los graba en la foto.
          payload: { rotation: this.rotation, site: (this.device && this.device.name) || '' },
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

    openLightbox(photo) {
      this.lightbox = photo;
      this.lbRotation = 0;
    },
    rotateLightbox() {
      this.lbRotation = (this.lbRotation + 90) % 360;
    },
    // Texto del sitio (ubicacion) para grabar dentro de la foto.
    siteText() {
      const d = this.device || {};
      const loc = [d.address, [d.city, d.state].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
      return [d.name, loc].filter(Boolean).join(' · ') || (d.name || 'SPACE EYE');
    },
    async downloadCurrentPhoto() {
      if (!this.lightbox) return;
      const ts = new Date(this.lightbox.taken_at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const base = (this.device && this.device.name ? this.device.name : 'foto').replace(/\s+/g, '_');
      try {
        // La foto ya trae grabada la ubicacion y fecha/hora; solo aplicamos la rotacion.
        await downloadRotatedImage(this.lightbox.storage_path, this.lbRotation, `${base}_${ts}.jpg`);
        this.showToast('Descargando foto…', 'success');
      } catch (e) {
        this.showToast('No se pudo descargar la foto', 'error');
      }
    },
    async downloadAlbum() {
      if (this.albumDownloading) return;
      this.albumDownloading = true;
      this.albumProgress = 'Preparando…';
      try {
        let page = 1;
        let all = [];
        while (true) {
          const data = await API.get(`/api/photos?device_id=${this.deviceId}&page=${page}&limit=100`);
          all = all.concat(data.photos);
          if (data.photos.length === 0 || all.length >= (data.total || all.length)) break;
          page++;
        }
        if (all.length === 0) { this.showToast('Sin fotos para descargar', 'info'); return; }
        const base = (this.device && this.device.name ? this.device.name : 'album').replace(/\s+/g, '_');
        await downloadAlbumZip(all, `${base}_fotos.zip`, (d, t) => { this.albumProgress = `${d}/${t}`; });
        this.showToast('Álbum descargado', 'success');
      } catch (e) {
        this.showToast('Error al descargar el álbum', 'error');
      } finally {
        this.albumDownloading = false;
        this.albumProgress = '';
      }
    },

    openEdit() {
      const d = this.device || {};
      this.editForm = {
        name: d.name || '',
        billboard_code: d.billboard_code || '',
        address: d.address || '',
        city: d.city || '',
        state: d.state || '',
      };
      this.editMode = true;
    },
    async saveDevice() {
      try {
        await API.put(`/api/devices/${this.deviceId}`, this.editForm);
        await this.loadDevice();
        this.editMode = false;
        this.showToast('Datos del sitio guardados', 'success');
      } catch (e) {
        this.showToast('No se pudo guardar', 'error');
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

    // Rotacion del video en el visor (CSS simple; el frame ya llega 4:3 correcto).
    rotate() {
      this.rotation = (this.rotation + 90) % 360;
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
