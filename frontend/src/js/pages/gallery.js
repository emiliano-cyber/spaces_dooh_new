// frontend/src/js/pages/gallery.js
requireAuth();

function gallery() {
  return {
    photos: [],
    filters: { from: '', to: '', source: '', device_id: '' },
    page: 1,
    totalPages: 1,
    lightbox: null,   // foto abierta en grande (null = cerrado)
    lbRotation: 0,
    albumDownloading: false,
    albumProgress: '',
    toast: { show: false, msg: '', type: 'info' },
    _toastT: null,

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.filters.device_id = params.get('device_id') || '';
      await this.loadPhotos();
    },

    async loadPhotos() {
      try {
        let query = `?page=${this.page}&limit=20`;
        if (this.filters.from) query += `&from=${this.filters.from}`;
        if (this.filters.to) query += `&to=${this.filters.to}`;
        if (this.filters.source) query += `&source=${this.filters.source}`;
        if (this.filters.device_id) query += `&device_id=${this.filters.device_id}`;
        const data = await API.get('/api/photos' + query);
        this.photos = data.photos;
        this.totalPages = Math.ceil(data.total / 20) || 1;
      } catch (err) {
        console.error('Failed to load photos:', err);
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
        this.photos = this.photos.filter((p) => p.id !== id);
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
    // Marca configurable de una foto (para el visor). Usa los campos que trae /api/photos.
    overlayInfoLinesFor(photo) { return photo ? overlayInfoLines(photo, photo.device_name) : []; },
    overlayCss(photo) {
      if (!photo) return '';
      let s = photo.overlay_style;
      if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = null; } }
      s = s || {};
      const parts = [
        `left:${photo.overlay_x != null ? photo.overlay_x : 50}%`,
        `top:${photo.overlay_y != null ? photo.overlay_y : 92}%`,
        `transform:translate(-50%,-50%)`,
        `font-size:${((Number(s.size) || 1.2) * (100 / 42)).toFixed(3)}cqw`,
        `font-weight:${s.weight === 'normal' ? '400' : '700'}`,
        `color:${s.color || '#ffffff'}`,
        `text-align:${s.align || 'left'}`,
        `line-height:${Number(s.lineSpacing) || 1.3}`,
        `letter-spacing:${Number(s.letterSpacing) || 0}em`,
        `font-family:Arial,Helvetica,sans-serif`, `padding:0.6em 0.9em`, `border-radius:0.4em`,
      ];
      if (s.bg !== false) parts.push('background:rgba(0,0,0,0.55)');
      if (s.shadow !== false) parts.push('text-shadow:0 0 4px rgba(0,0,0,0.9)');
      return parts.join(';');
    },
    async downloadCurrentPhoto() {
      if (!this.lightbox) return;
      const ts = new Date(this.lightbox.taken_at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const base = (this.lightbox.device_name || 'foto').replace(/\s+/g, '_');
      try {
        // Fotos limpias (v0.8.0): dibuja la marca configurable del dispositivo.
        const o = photoOverlayArgs(this.lightbox);
        await downloadRotatedImage(this.lightbox.storage_path, this.lbRotation, `${base}_${ts}.jpg`, o.lines, o.pos, o.style);
        this.showToast('Descargando foto…', 'success');
      } catch (e) {
        this.showToast('No se pudo descargar la foto', 'error');
      }
    },
    // Descarga todas las fotos que coinciden con los filtros actuales.
    async downloadAlbum() {
      if (this.albumDownloading) return;
      this.albumDownloading = true;
      this.albumProgress = 'Preparando…';
      try {
        const base = '?limit=100' +
          (this.filters.device_id ? `&device_id=${this.filters.device_id}` : '') +
          (this.filters.from ? `&from=${this.filters.from}` : '') +
          (this.filters.to ? `&to=${this.filters.to}` : '') +
          (this.filters.source ? `&source=${this.filters.source}` : '');
        let page = 1;
        let all = [];
        while (true) {
          const data = await API.get(`/api/photos${base}&page=${page}`);
          all = all.concat(data.photos);
          if (data.photos.length === 0 || all.length >= (data.total || all.length)) break;
          page++;
        }
        if (all.length === 0) { this.showToast('Sin fotos para descargar', 'info'); return; }
        await downloadAlbumZip(all, 'album_fotos.zip', (d, t) => { this.albumProgress = `${d}/${t}`; });
        this.showToast('Álbum descargado', 'success');
      } catch (e) {
        this.showToast('Error al descargar el álbum', 'error');
      } finally {
        this.albumDownloading = false;
        this.albumProgress = '';
      }
    },
  };
}
