// frontend/src/js/pages/dashboard.js
const _hasSession = requireAuth();

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
      })
        // Orden alfabetico estable, con los fijados arriba. Se ordena tambien
        // aqui (no solo en el servidor) para que las actualizaciones en vivo por
        // socket no muevan las tarjetas de lugar mientras alguien las mira.
        // numeric: "Sitio 2" va antes que "Sitio 10", no al reves.
        .sort((a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
          String(a.name || '').localeCompare(String(b.name || ''), 'es', { numeric: true, sensitivity: 'base' }) ||
          (a.id - b.id));
    },

    async init() {
      // Sin sesion ya estamos navegando al login: no arrancar sockets ni
      // peticiones condenadas al 401.
      if (!_hasSession) return;

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
      // Borrar un equipo se lleva su historial completo y no hay vuelta atras:
      // se exige escribir ELIMINAR, no solo aceptar un aviso.
      const confirmar = window.confirmarEscribiendo
        // Respaldo por si el encabezado no alcanzo a cargar: mismo criterio,
        // sin modal. Nunca se borra sin escribir la palabra.
        || (async ({ mensaje, palabra }) => prompt(`${mensaje}\n\nEscribe ${palabra} para confirmar:`) === palabra);

      const ok = await confirmar({
        titulo: 'Eliminar dispositivo',
        mensaje: `Vas a eliminar "${d.name}"`,
        detalle: 'Se borrarán sus fotos, su telemetría y todos sus registros. Esta acción no se puede deshacer.',
        palabra: 'ELIMINAR',
        textoBoton: 'Eliminar dispositivo',
      });
      if (!ok) return;
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
      clearSession();
      window.location.replace('/index.html');
    },
  };
}
