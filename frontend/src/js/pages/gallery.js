// frontend/src/js/pages/gallery.js
requireAuth();

function gallery() {
  return {
    photos: [],
    filters: { from: '', to: '', source: '', device_id: '' },
    page: 1,
    totalPages: 1,
    lightbox: null,   // foto abierta en grande (null = cerrado)

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
  };
}
