// frontend/src/js/pages/gallery.js
requireAuth();

function gallery() {
  return {
    photos: [],
    filters: { from: '', to: '', source: '', device_id: '' },
    page: 1,
    totalPages: 1,
    lightbox: null,   // foto abierta en grande (null = cerrado)
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
  };
}
