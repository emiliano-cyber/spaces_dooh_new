// frontend/src/js/pages/graficas.js
// Modulo de Graficas: concentra la telemetria historica de un dispositivo.
// Reutiliza el endpoint /api/devices/:id/telemetry (mismas gráficas del PlayLog)
// mas el consumo de datos de /api/devices/:id.
requireAuth();

function graficas() {
  return {
    devices: [],
    deviceId: '',
    range: '24h',
    from: '', to: '',
    loaded: false,
    deviceOnline: false,
    summary: {},
    alerts: [],
    series: [],
    dataUsage: null,
    _charts: {},

    async init() {
      try {
        const data = await API.get('/api/devices');
        this.devices = data.devices || [];
        if (this.devices.length) {
          // Preseleccionar el primero en línea, o el primero.
          const online = this.devices.find((d) => d.online);
          this.deviceId = String((online || this.devices[0]).id);
          await this.load();
        }
      } catch (e) { console.error(e); }
    },

    onRangePreset() { if (this.range !== 'custom') this.load(); },

    _computeRange() {
      const now = new Date();
      let from, to = now, gran = 'raw';
      if (this.range === '24h') { from = new Date(now - 24 * 3600e3); gran = 'raw'; }
      else if (this.range === '7d') { from = new Date(now - 7 * 24 * 3600e3); gran = 'hour'; }
      else if (this.range === '30d') { from = new Date(now - 30 * 24 * 3600e3); gran = 'hour'; }
      else {
        from = this.from ? new Date(this.from) : new Date(now - 24 * 3600e3);
        to = this.to ? new Date(this.to) : now;
        gran = (to - from) > 2 * 24 * 3600e3 ? 'hour' : 'raw';
      }
      return { fromISO: from.toISOString(), toISO: to.toISOString(), granularity: gran };
    },

    async load() {
      if (!this.deviceId) return;
      const { fromISO, toISO, granularity } = this._computeRange();
      try {
        const [tel, dev] = await Promise.all([
          API.get(`/api/devices/${this.deviceId}/telemetry?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&granularity=${granularity}`),
          API.get(`/api/devices/${this.deviceId}`),
        ]);
        this.summary = tel.summary || {};
        this.alerts = tel.alerts || [];
        this.series = tel.series || [];
        this.deviceOnline = !!(dev.device && dev.device.online);
        this.dataUsage = dev.data_usage || null;
        this.loaded = true;
        this.$nextTick(() => { this.renderCharts(granularity); this.renderDataChart(); });
      } catch (e) { console.error('load telemetry', e); }
    },

    fmtBytes(n) {
      if (n === null || n === undefined) return 'n/d';
      const b = Number(n);
      if (b < 1024) return b + ' B';
      if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
      if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
      return (b / 1073741824).toFixed(2) + ' GB';
    },

    _mk(canvasId, labels, datasets) {
      const elc = document.getElementById(canvasId);
      if (!elc || typeof Chart === 'undefined') return;
      if (this._charts[canvasId]) this._charts[canvasId].destroy();
      this._charts[canvasId] = new Chart(elc, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: true, animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: { x: { ticks: { maxTicksLimit: 8, font: { size: 9 } } }, y: { ticks: { font: { size: 10 } } } },
          elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.25 } },
        },
      });
    },

    renderCharts(granularity) {
      if (!this.series.length) return;
      const labels = this.series.map((r) => {
        const d = new Date(r.bucket || r.reported_at);
        return granularity === 'hour'
          ? d.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit' })
          : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      });
      const num = (v) => (v == null ? null : Number(v));
      const S = this.series;
      this._mk('chartTemp', labels, [
        { label: 'Temp CPU °C', data: S.map((r) => num(r.cpu_temp)), borderColor: '#dc2626' },
        { label: 'Temp batería °C', data: S.map((r) => num(r.battery_temp)), borderColor: '#f59e0b' },
      ]);
      this._mk('chartBattery', labels, [{ label: 'Batería %', data: S.map((r) => num(r.battery_pct)), borderColor: '#16a34a' }]);
      this._mk('chartSignal', labels, [{ label: 'Señal dBm', data: S.map((r) => num(r.signal_dbm)), borderColor: '#2563eb' }]);
      this._mk('chartStorage', labels, [
        { label: 'Storage MB', data: S.map((r) => num(r.storage_free_mb)), borderColor: '#7c3aed' },
        { label: 'RAM MB', data: S.map((r) => num(r.ram_free_mb)), borderColor: '#0891b2' },
      ]);
    },

    renderDataChart() {
      if (!this.dataUsage || typeof Chart === 'undefined') return;
      const el = document.getElementById('chartData');
      if (!el) return;
      if (this._charts.chartData) this._charts.chartData.destroy();
      const mb = (v) => (v == null ? 0 : Number(v) / 1048576);
      const du = this.dataUsage;
      this._charts.chartData = new Chart(el, {
        type: 'bar',
        data: {
          labels: ['Hoy', 'Semana', 'Mes', 'Total'],
          datasets: [
            { label: 'Móvil (MB)', data: [mb(du.mobile_today), mb(du.mobile_week), mb(du.mobile_month), mb(du.mobile_total)], backgroundColor: '#0A66FF' },
            { label: 'WiFi (MB)', data: [mb(du.wifi_today), mb(du.wifi_week), mb(du.wifi_month), mb(du.wifi_total)], backgroundColor: '#16a34a' },
          ],
        },
        options: { responsive: true, animation: false, plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { ticks: { font: { size: 10 } } } } },
      });
    },

    exportCsv() {
      const { fromISO, toISO } = this._computeRange();
      const token = localStorage.getItem('access_token');
      const url = `/api/devices/${this.deviceId}/telemetry/export?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`;
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.blob() : Promise.reject(r.status))
        .then((blob) => {
          const dev = this.devices.find((d) => String(d.id) === String(this.deviceId));
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `telemetria_${(dev ? dev.name : 'device').replace(/\s+/g, '_')}.csv`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        })
        .catch(() => window.toast?.('No se pudo exportar el CSV', 'error'));
    },
  };
}
