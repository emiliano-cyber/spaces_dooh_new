// frontend/src/js/pages/dashboard.js
requireAuth();

function dashboard() {
  return {
    devices: [],
    search: '',
    filter: 'all',
    userName: '',
    toast: { show: false, msg: '', type: 'info' },
    _toastT: null,

    get onlineCount() {
      return this.devices.filter(d => d.online).length;
    },
    get totalCount() {
      return this.devices.length;
    },
    get filtered() {
      return this.devices.filter(d => {
        const matchSearch = !this.search ||
          d.name.toLowerCase().includes(this.search.toLowerCase()) ||
          (d.billboard_code || '').toLowerCase().includes(this.search.toLowerCase()) ||
          (d.address || '').toLowerCase().includes(this.search.toLowerCase());

        const matchFilter = this.filter === 'all' ||
          (this.filter === 'online' && d.online) ||
          (this.filter === 'offline' && !d.online) ||
          (this.filter === 'maintenance' && d.status === 'maintenance');

        return matchSearch && matchFilter;
      });
    },

    async init() {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      this.userName = user.name || '';

      await this.loadDevices();
      // Refresca la lista (aparecen equipos nuevos, se actualizan estados).
      setInterval(() => this.loadDevices(), 30000);

      dashboardSocket.connect();
      dashboardSocket.on('device:online', (data) => {
        const dev = this.devices.find(d => d.id === data.device_id);
        if (dev) dev.online = data.online;
      });
      dashboardSocket.on('device:status_summary', (data) => {
        const dev = this.devices.find(d => d.id === data.device_id);
        if (dev) {
          dev.battery_pct = data.battery_pct;
          dev.signal_dbm = data.signal_dbm;
        }
      });
    },

    async loadDevices() {
      try {
        const data = await API.get('/api/devices');
        this.devices = data.devices;
      } catch (err) {
        console.error('Failed to load devices:', err);
      }
    },

    openDevice(id) {
      window.location.href = `/device-detail.html?id=${id}`;
    },

    showToast(msg, type = 'info') {
      this.toast = { show: true, msg, type };
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { this.toast.show = false; }, 3200);
    },

    // Fijar/desfijar: los fijados aparecen primero (orden del backend).
    async togglePin(d) {
      const next = !d.pinned;
      try {
        await API.put(`/api/devices/${d.id}`, { pinned: next });
        await this.loadDevices();
        this.showToast(next ? 'Dispositivo fijado' : 'Dispositivo desfijado', 'success');
      } catch (e) {
        this.showToast('No se pudo actualizar', 'error');
      }
    },

    async deleteDevice(d) {
      if (!confirm(`¿Eliminar "${d.name}"? Se borrarán sus fotos, estado y registros. Esta acción no se puede deshacer.`)) return;
      try {
        await API.delete(`/api/devices/${d.id}`);
        this.devices = this.devices.filter((x) => x.id !== d.id);
        this.showToast('Dispositivo eliminado', 'success');
      } catch (e) {
        this.showToast('No se pudo eliminar (requiere rol admin)', 'error');
      }
    },

    signalLabel(dbm) {
      if (dbm == null) return '—';
      if (dbm > -70) return 'Buena';
      if (dbm > -85) return 'Media';
      return 'Baja';
    },

    relTime(date) {
      if (!date) return 'Nunca';
      const diff = Date.now() - new Date(date).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Ahora';
      if (mins < 60) return `${mins}m`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h`;
      return `${Math.floor(hours / 24)}d`;
    },

    logout() {
      API.post('/api/auth/logout', { refresh_token: localStorage.getItem('refresh_token') }).catch(() => {});
      localStorage.clear();
      window.location.href = '/index.html';
    },
  };
}
