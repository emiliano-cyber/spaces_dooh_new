// frontend/src/js/socket.js
class DashboardSocket {
  constructor() {
    this.socket = null;
    this.handlers = {};
  }

  connect() {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    this.socket = io('/dashboard', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('[Socket] connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] disconnected');
    });

    this.socket.on('device:status', (data) => {
      this._emit('device:status', data);
    });

    this.socket.on('device:status_summary', (data) => {
      this._emit('device:status_summary', data);
    });

    this.socket.on('device:online', (data) => {
      this._emit('device:online', data);
    });

    // Una falla de pantalla se abrio o se cerro (monitoreo del equipo).
    this.socket.on('pantalla:falla', (data) => {
      this._emit('pantalla:falla', data);
    });
  }

  watchDevice(deviceId) {
    this.socket?.emit('watch_device', deviceId);
  }

  unwatchDevice(deviceId) {
    this.socket?.emit('unwatch_device', deviceId);
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
  }

  _emit(event, data) {
    (this.handlers[event] || []).forEach(h => h(data));
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

const dashboardSocket = new DashboardSocket();
