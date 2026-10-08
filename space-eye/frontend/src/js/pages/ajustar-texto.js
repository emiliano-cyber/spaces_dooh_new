// frontend/src/js/pages/ajustar-texto.js
// Editor de la marca de informacion (nombre/fecha/hora) por dispositivo.
// - "Tomar fotografia": captura UNA foto bajo demanda para usarla de referencia.
// - Editor: posicion (drag), tamaño, peso, color, sombra, fondo, alineacion, espaciado.
// - Vista previa WYSIWYG (cqw = misma proporcion que el render de descarga: ancho/42).
// - Guardar: PUT /api/devices/:id/overlay {x,y,enabled,style}. Solo admin.
requireAuth();

const DEFAULT_STYLE = { size: 1.2, weight: 'bold', color: '#ffffff', shadow: true, bg: true, align: 'left', letterSpacing: 0, lineSpacing: 1.3 };

function ajustarTexto() {
  return {
    devices: [],
    deviceId: '',
    isAdmin: false,
    previewSrc: null,
    capturing: false,
    x: 50, y: 92, enabled: true,
    style: { ...DEFAULT_STYLE },
    _dragging: false,
    toast: { show: false, msg: '', type: 'info' },
    _toastT: null,

    async init() {
      try { this.isAdmin = JSON.parse(localStorage.getItem('user') || '{}').role === 'admin'; } catch (_) {}
      try {
        const data = await API.get('/api/devices');
        this.devices = data.devices || [];
        if (this.devices.length) {
          const online = this.devices.find((d) => d.online);
          this.deviceId = String((online || this.devices[0]).id);
          await this.onDeviceChange();
        }
      } catch (e) { console.error(e); }
    },

    showToast(msg, type = 'info') {
      this.toast = { show: true, msg, type };
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { this.toast.show = false; }, 3200);
    },

    // Al cambiar de dispositivo: carga su config guardada y su ultima foto como referencia.
    async onDeviceChange() {
      if (!this.deviceId) return;
      try {
        const data = await API.get(`/api/devices/${this.deviceId}`);
        const d = data.device || {};
        this.x = d.overlay_x != null ? Number(d.overlay_x) : 50;
        this.y = d.overlay_y != null ? Number(d.overlay_y) : 92;
        this.enabled = d.overlay_enabled !== 0 && d.overlay_enabled !== false;
        const st = typeof d.overlay_style === 'string' ? JSON.parse(d.overlay_style || 'null') : d.overlay_style;
        this.style = { ...DEFAULT_STYLE, ...(st || {}) };
        // Ultima foto como referencia (si existe).
        const ph = await API.get(`/api/photos?device_id=${this.deviceId}&limit=1`);
        this.previewSrc = (ph.photos && ph.photos[0]) ? ph.photos[0].storage_path : null;
      } catch (e) { console.error(e); }
    },

    // Captura UNA foto bajo demanda y la usa de referencia (no automatica).
    async takePhoto() {
      if (this.capturing || !this.deviceId) return;
      this.capturing = true;
      try {
        const before = await this._lastPhotoId();
        await API.post(`/api/devices/${this.deviceId}/command`, { command_type: 'TAKE_PHOTO', priority: 1 });
        let tries = 0;
        const poll = setInterval(async () => {
          tries++;
          const cur = await this._lastPhotoId();
          if (cur && cur !== before) {
            clearInterval(poll);
            this.capturing = false;
            const ph = await API.get(`/api/photos?device_id=${this.deviceId}&limit=1`);
            this.previewSrc = ph.photos[0].storage_path;
            this.showToast('Fotografía capturada', 'success');
          } else if (tries >= 15) { // ~30s
            clearInterval(poll);
            this.capturing = false;
            this.showToast('No llegó la foto (¿equipo en línea?)', 'error');
          }
        }, 2000);
      } catch (e) {
        this.capturing = false;
        this.showToast('No se pudo enviar el comando', 'error');
      }
    },
    async _lastPhotoId() {
      try { const d = await API.get(`/api/photos?device_id=${this.deviceId}&limit=1`); return d.photos && d.photos[0] ? d.photos[0].id : null; }
      catch (e) { return null; }
    },

    lines() {
      const dev = this.devices.find((d) => String(d.id) === String(this.deviceId));
      const now = new Date();
      return [
        (dev ? dev.name : 'Dispositivo'),
        now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ];
    },

    // CSS del overlay: fuente en cqw (1cqw = 1% del ancho del recuadro) para que
    // coincida con el render (ancho/42*size = size*2.381cqw). Padding/radio en em.
    overlayCss() {
      const s = this.style;
      const fontCqw = (Number(s.size) || 1.2) * (100 / 42);
      const parts = [
        `left:${this.x}%`, `top:${this.y}%`, `transform:translate(-50%,-50%)`,
        `font-size:${fontCqw.toFixed(3)}cqw`,
        `font-weight:${s.weight === 'normal' ? '400' : '700'}`,
        `color:${s.color}`,
        `text-align:${s.align}`,
        `line-height:${Number(s.lineSpacing) || 1.3}`,
        `letter-spacing:${Number(s.letterSpacing) || 0}em`,
        `font-family:Arial,Helvetica,sans-serif`,
        `padding:0.6em 0.9em`,
        `border-radius:0.4em`,
      ];
      if (s.bg) parts.push('background:rgba(0,0,0,0.55)');
      if (s.shadow) parts.push('text-shadow:0 0 4px rgba(0,0,0,0.9)');
      return parts.join(';');
    },

    dragStart() { if (this.isAdmin && this.previewSrc) this._dragging = true; },
    dragMove(e) {
      if (!this._dragging) return;
      const box = e.currentTarget.getBoundingClientRect();
      const pt = e.touches ? e.touches[0] : e;
      this.x = Math.min(100, Math.max(0, ((pt.clientX - box.left) / box.width) * 100));
      this.y = Math.min(100, Math.max(0, ((pt.clientY - box.top) / box.height) * 100));
    },
    dragEnd() { this._dragging = false; },

    async save() {
      if (!this.isAdmin) return;
      try {
        await API.put(`/api/devices/${this.deviceId}/overlay`, {
          x: Math.round(this.x), y: Math.round(this.y), enabled: this.enabled,
          style: {
            size: Number(this.style.size), weight: this.style.weight, color: this.style.color,
            shadow: !!this.style.shadow, bg: !!this.style.bg, align: this.style.align,
            letterSpacing: Number(this.style.letterSpacing), lineSpacing: Number(this.style.lineSpacing),
          },
        });
        this.showToast('Configuración guardada y aplicada al dispositivo', 'success');
      } catch (e) {
        this.showToast('No se pudo guardar (¿eres admin?)', 'error');
      }
    },
  };
}
