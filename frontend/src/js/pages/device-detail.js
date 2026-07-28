// frontend/src/js/pages/device-detail.js
requireAuth();

function deviceDetail() {
  return {
    deviceId: null,
    device: null,
    status: null,
    dataUsage: null,   // consumo de datos (movil/wifi) del dispositivo
    recentPhotos: [],
    logs: [],
    streaming: false,
    streamClient: null,
    streamLeft: 0, // segundos restantes antes del corte automatico
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
    rotation: 0,        // rotacion actual del video en el visor (0/90/180/270)
    savedRotation: 0,   // orientacion fija guardada en el servidor (la que ven todos)
    // Encuadre fijo del sitio: a diferencia del zoom "en vivo", esto se guarda y
    // el backend lo manda en cada orden de foto, incluidas las programadas.
    lens: 'main',       // 'main' | 'wide' (gran angular 0.5x)
    savedLens: 'main',
    savedZoom: 0,
    isAdmin: false,     // solo admin puede fijar la orientacion / overlay
    // Marca de informacion (overlay): posicion en % + estilo (se configura en "Ajustar texto").
    overlayX: 50, overlayY: 92, overlayEnabled: true,
    overlayStyle: { size: 1.2, weight: 'bold', color: '#ffffff', shadow: true, bg: true, align: 'left', letterSpacing: 0, lineSpacing: 1.3 },
    lbImgW: 0,          // ancho renderizado de la imagen en el visor (para el overlay)
    _dragging: false,
    takingPhoto: false,
    toast: { show: false, msg: '', type: 'info' },
    _toastT: null,
    // PlayLog / historico de telemetria
    tlRange: '24h',
    tlFrom: '', tlTo: '',
    tlLoaded: false,
    tlAlerts: [],
    tlSummary: {},
    tlSeries: [],
    _charts: {},

    async init() {
      const params = new URLSearchParams(window.location.search);
      this.deviceId = params.get('id');
      if (!this.deviceId) {
        window.location.href = '/dashboard.html';
        return;
      }

      // Rol del usuario (para habilitar "Fijar orientacion" solo a admin).
      try { this.isAdmin = JSON.parse(localStorage.getItem('user') || '{}').role === 'admin'; } catch (_) {}

      await this.loadDevice();
      await this.loadPhotos();
      await this.loadLogs();
      await this.loadTelemetry();
      this.loadAppVersion();
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
        this.dataUsage = data.data_usage;
        // Orientacion fija guardada por admin: es la que ven todos al abrir/recargar.
        this.savedRotation = ((Number(this.device.stream_rotation) % 360) + 360) % 360 || 0;
        this.rotation = this.savedRotation;
        // Encuadre fijo: lente y zoom guardados. Aplican tanto a la vista en vivo
        // como a las fotos programadas.
        this.lens = this.device.camera_lens === 'wide' ? 'wide' : 'main';
        this.savedLens = this.lens;
        this.savedZoom = Number(this.device.camera_zoom) || 0;
        this.zoom = this.savedZoom;
        // Marca de informacion (overlay) configurada para este dispositivo.
        if (this.device.overlay_x != null) this.overlayX = Number(this.device.overlay_x);
        if (this.device.overlay_y != null) this.overlayY = Number(this.device.overlay_y);
        this.overlayEnabled = this.device.overlay_enabled !== 0 && this.device.overlay_enabled !== false;
        try {
          const st = typeof this.device.overlay_style === 'string' ? JSON.parse(this.device.overlay_style || 'null') : this.device.overlay_style;
          if (st) this.overlayStyle = { ...this.overlayStyle, ...st };
        } catch (_) {}
      } catch (err) {
        console.error('Failed to load device:', err);
      }
    },

    // Formatea bytes a KB/MB/GB. 'n/d' si no existe (equipo con APK previa a v0.7.0).
    fmtBytes(n) {
      if (n === null || n === undefined) return 'n/d';
      const b = Number(n);
      if (b < 1024) return b + ' B';
      if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
      if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
      return (b / 1073741824).toFixed(2) + ' GB';
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

    // ---- PlayLog / historico de telemetria ----
    onRangePreset() {
      // Al elegir un preset != custom, recarga de una vez.
      if (this.tlRange !== 'custom') this.loadTelemetry();
    },
    // Devuelve {fromISO, toISO, granularity} segun el rango elegido.
    _computeRange() {
      const now = new Date();
      let from, to = now, gran = 'raw';
      if (this.tlRange === '24h') { from = new Date(now - 24 * 3600e3); gran = 'raw'; }
      else if (this.tlRange === '7d') { from = new Date(now - 7 * 24 * 3600e3); gran = 'hour'; }
      else if (this.tlRange === '30d') { from = new Date(now - 30 * 24 * 3600e3); gran = 'hour'; }
      else { // custom
        from = this.tlFrom ? new Date(this.tlFrom) : new Date(now - 24 * 3600e3);
        to = this.tlTo ? new Date(this.tlTo) : now;
        gran = (to - from) > 2 * 24 * 3600e3 ? 'hour' : 'raw';
      }
      return { fromISO: from.toISOString(), toISO: to.toISOString(), granularity: gran };
    },
    async loadTelemetry() {
      const { fromISO, toISO, granularity } = this._computeRange();
      try {
        const data = await API.get(
          `/api/devices/${this.deviceId}/telemetry?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&granularity=${granularity}`
        );
        this.tlAlerts = data.alerts || [];
        this.tlSummary = data.summary || {};
        this.tlSeries = data.series || [];
        this.tlLoaded = true;
        this.$nextTick(() => this.renderCharts(granularity));
      } catch (err) {
        console.error('Failed to load telemetry:', err);
      }
    },
    renderCharts(granularity) {
      if (typeof Chart === 'undefined' || !this.tlSeries.length) return;
      const labels = this.tlSeries.map((r) => {
        const d = new Date(r.bucket || r.reported_at);
        return granularity === 'hour'
          ? d.toLocaleString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit' })
          : d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      });
      const num = (v) => (v == null ? null : Number(v));
      const mk = (canvasId, datasets) => {
        const el = document.getElementById(canvasId);
        if (!el) return;
        if (this._charts[canvasId]) this._charts[canvasId].destroy();
        this._charts[canvasId] = new Chart(el, {
          type: 'line',
          data: { labels, datasets },
          options: {
            responsive: true, animation: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
            scales: { x: { ticks: { maxTicksLimit: 8, font: { size: 9 } } }, y: { ticks: { font: { size: 10 } } } },
            elements: { point: { radius: 0 }, line: { borderWidth: 1.5, tension: 0.25 } },
          },
        });
      };
      const S = this.tlSeries;
      mk('chartTemp', [
        { label: 'Temp CPU °C', data: S.map((r) => num(r.cpu_temp)), borderColor: '#dc2626' },
        { label: 'Temp batería °C', data: S.map((r) => num(r.battery_temp)), borderColor: '#f59e0b' },
      ]);
      mk('chartBattery', [
        { label: 'Batería %', data: S.map((r) => num(r.battery_pct)), borderColor: '#16a34a' },
      ]);
      mk('chartSignal', [
        { label: 'Señal dBm', data: S.map((r) => num(r.signal_dbm)), borderColor: '#2563eb' },
      ]);
      mk('chartStorage', [
        { label: 'Storage libre MB', data: S.map((r) => num(r.storage_free_mb)), borderColor: '#7c3aed' },
        { label: 'RAM libre MB', data: S.map((r) => num(r.ram_free_mb)), borderColor: '#0891b2' },
      ]);
    },
    exportTelemetry() {
      const { fromISO, toISO } = this._computeRange();
      const token = localStorage.getItem('access_token');
      // Descarga con token en query (el endpoint valida requireUser); abrimos en
      // nueva pestaña para que el navegador maneje la descarga del CSV.
      const url = `/api/devices/${this.deviceId}/telemetry/export?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`;
      // Usamos fetch con Authorization y forzamos descarga del blob.
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.blob() : Promise.reject(r.status))
        .then((blob) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `telemetria_${(this.device?.name || 'device').replace(/\s+/g, '_')}.csv`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          this.showToast('CSV exportado', 'success');
        })
        .catch(() => this.showToast('No se pudo exportar', 'error'));
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
        // Fotos limpias (APK v0.8.0): dibujamos la marca configurable (nombre/fecha/hora
        // de captura) en la posicion del dispositivo. Fotos con marca quemada: sin overlay.
        const clean = this.lightbox.watermark_baked === 0 || this.lightbox.watermark_baked === false;
        const on = clean && this.overlayEnabled;
        const lines = on ? overlayInfoLines(this.lightbox, this.device && this.device.name) : null;
        const pos = on ? { x: this.overlayX, y: this.overlayY } : null;
        await downloadRotatedImage(this.lightbox.storage_path, this.lbRotation, `${base}_${ts}.jpg`, lines, pos, on ? this.overlayStyle : null);
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
      this.streamLeft = 180;
      this.streamClient = new LiveStreamClient(Number(this.deviceId), video, {
        onTick: (s) => { this.streamLeft = s; },
        // Corte a los 3 min: evita que un stream olvidado siga consumiendo
        // datos del equipo y deje sesiones colgadas en el TURN.
        onAutoStop: async () => {
          await this.stopStream();
          this.showToast('Transmisión detenida automáticamente a los 3 minutos', 'info');
        },
        onError: async (msg) => {
          if (!this.streaming) return;
          await this.stopStream();
          this.showToast(msg, 'error');
        },
      });
      await this.streamClient.start();
      this.streaming = true;
      // Re-aplicar los ajustes que definiste, cuando la camara ya este lista.
      setTimeout(() => this.reapplyControls(), 1500);
    },

    async stopStream() {
      await this.streamClient?.stop();
      this.streamClient = null;
      this.streaming = false;
      this.streamLeft = 0;
      // Se conservan zoom/exposicion/wb/foco/rotacion para el proximo stream.
    },

    // Diagnostico de red del ultimo intento de transmision. Explica en la ficha
    // el caso que dejo ciego a un sitio: el equipo funcionaba (fotos, telemetria)
    // pero su red movil ya solo le daba IPv6 y el video nunca podia conectar.
    iceDiag() {
      const s = this.device?.last_ice_summary;
      if (!s) return null;
      const d = typeof s === 'string' ? JSON.parse(s) : s;
      const cuando = this.device.last_ice_at
        ? new Date(this.device.last_ice_at).toLocaleString('es-MX')
        : 'n/d';
      const textos = {
        ok: ['Conectividad correcta', ''],
        sin_ipv4: ['Sin IPv4 (red IPv6)', 'El equipo solo ofrece direcciones IPv6 y el servidor de video es IPv4: la vista en vivo no puede conectar. Cambia el APN del equipo a IPv4/IPv6. Las fotos y la telemetría no se ven afectadas.'],
        sin_publicos: ['Sin dirección pública', 'El equipo no logró obtener candidatos públicos (STUN/TURN). Su red puede estar bloqueando el puerto 3478.'],
        sin_candidatos: ['Sin candidatos', 'El equipo no generó ninguna dirección para la conexión de video.'],
      };
      const [titulo, detalle] = textos[d.verdict] || ['Desconocido', ''];
      return { ok: d.verdict === 'ok', titulo, detalle, cuando, raw: d };
    },

    // mm:ss para la cuenta regresiva del corte automatico.
    streamLeftLabel() {
      const s = Math.max(0, Number(this.streamLeft) || 0);
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    },

    // Reenvia los ajustes actuales al device (persisten entre reconexiones).
    reapplyControls() {
      if (!this.streaming) return;
      if (Number(this.zoom) > 0) this.onZoom();
      if (Number(this.exposure) !== 0) this.onExposure();
      if (this.wb !== 'auto') this.onWb();
      if (this.focusLocked) this.camControl({ action: 'lock_focus', x: 0.5, y: 0.5 });
    },

    // Estilo del video segun la rotacion. En 90°/270° escala x(4/3) para LLENAR
    // el recuadro 4:3 (si no, quedarian barras negras al girar). El frame es 4:3.
    videoStyle() {
      const r = ((Number(this.rotation) % 360) + 360) % 360;
      const scale = (r === 90 || r === 270) ? (4 / 3) : 1;
      return `transform: rotate(${r}deg) scale(${scale});`;
    },
    // Rotacion del video en el visor (CSS simple; el frame ya llega 4:3 correcto).
    // Es temporal por navegador; al recargar vuelve a la orientacion fija (savedRotation).
    rotate() {
      this.rotation = (this.rotation + 90) % 360;
    },
    // Vuelve a la orientacion fija guardada (la que ven todos).
    resetRotation() {
      this.rotation = this.savedRotation;
    },
    // Fija la orientacion actual como la que veran todos (solo admin). Persiste en el servidor.
    async saveRotation() {
      try {
        await API.put(`/api/devices/${this.deviceId}/stream-rotation`, { rotation: this.rotation });
        this.savedRotation = this.rotation;
        if (this.device) this.device.stream_rotation = this.rotation;
        this.showToast('Orientación fijada para todos', 'success');
      } catch (e) {
        this.showToast('No se pudo fijar la orientación (¿eres admin?)', 'error');
      }
    },

    // ---- Actualizacion remota de la app ----
    // Antes cada version nueva exigia ir sitio por sitio a reinstalar el APK.
    apkLatest: null,
    updating: false,
    async loadAppVersion() {
      try { this.apkLatest = await API.get('/api/app/version'); } catch (_) { this.apkLatest = null; }
    },
    // Un equipo esta atrasado si su version instalada es menor a la publicada.
    // Las APK anteriores a la v0.10.0 no reportan su numero: en ese caso se
    // compara por nombre, que basta para saber que no estan al dia.
    appAtrasada() {
      if (!this.apkLatest?.disponible || !this.device) return false;
      const instalado = Number(this.device.app_version_code) || 0;
      if (this.apkLatest.version_code && instalado) return instalado < this.apkLatest.version_code;
      return Boolean(this.apkLatest.version && this.device.app_version &&
        this.device.app_version !== this.apkLatest.version);
    },
    // Sin device owner, Android exige que alguien confirme en la pantalla del
    // equipo. Conviene decirlo ANTES de mandar la orden, no despues.
    puedeActualizarSolo() {
      return this.device?.device_owner === 1 || this.device?.device_owner === true;
    },
    async updateApp() {
      const aviso = this.puedeActualizarSolo()
        ? `Se instalará la versión ${this.apkLatest?.version || 'publicada'} en este equipo. Tardará un par de minutos y la app se reiniciará sola.`
        : `Este equipo NO puede instalar solo: alguien tendrá que confirmar la instalación EN LA PANTALLA del teléfono. ¿Enviar de todos modos?`;
      if (!confirm(aviso)) return;
      this.updating = true;
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, { command_type: 'UPDATE_APP' });
        this.showToast(this.puedeActualizarSolo()
          ? 'Actualización enviada; el equipo se reiniciará al terminar'
          : 'Orden enviada: falta confirmar la instalación en el equipo', 'success');
      } catch (e) {
        this.showToast(e?.body?.error === 'apk_no_publicado'
          ? 'No hay APK publicada en el servidor'
          : 'No se pudo enviar la actualización', 'error');
      } finally {
        this.updating = false;
      }
    },

    // ---- Encuadre fijo del sitio (lente + zoom) ----
    // Se guarda en el servidor y el backend lo manda en CADA orden de foto, asi
    // que aplica igual a las programadas. Antes el zoom de la vista en vivo no
    // llegaba a las capturas por horario: salian siempre al encuadre por defecto.
    encuadreCambiado() {
      return this.lens !== this.savedLens || Math.abs(Number(this.zoom) - this.savedZoom) > 0.001;
    },
    async saveCamera() {
      try {
        await API.put(`/api/devices/${this.deviceId}/camera`, {
          lens: this.lens,
          zoom: Number(this.zoom) || 0,
        });
        const cambioLente = this.lens !== this.savedLens;
        this.savedLens = this.lens;
        this.savedZoom = Number(this.zoom) || 0;
        if (this.device) {
          this.device.camera_lens = this.savedLens;
          this.device.camera_zoom = this.savedZoom;
        }
        this.showToast('Encuadre fijado: se aplicará también a las fotos programadas', 'success');
        // El lente es una cámara física distinta: hay que reabrirla para verlo.
        if (cambioLente && this.streaming) {
          await this.stopStream();
          setTimeout(() => this.startStream(), 1200);
        }
      } catch (e) {
        this.showToast('No se pudo guardar el encuadre (¿eres admin?)', 'error');
      }
    },

    // ---- Marca de informacion (overlay) configurable ----
    // Imagen de referencia para posicionar: ultima foto o placeholder.
    overlayPreviewSrc() {
      const p = this.recentPhotos && this.recentPhotos[0];
      return p ? p.thumbnail_path : null;
    },
    // Lineas de ejemplo para la vista previa (usa la ultima foto o "ahora").
    overlayPreviewLines() {
      const p = (this.recentPhotos && this.recentPhotos[0]) || {};
      const d = p.taken_at ? new Date(p.taken_at) : new Date();
      return [
        (this.device && this.device.name) || 'Dispositivo',
        d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ];
    },
    // Drag: actualiza x/y en % relativo al recuadro de preview (4:3 = igual que la foto).
    overlayDragStart(e) { if (this.isAdmin) this._dragging = true; },
    overlayDragMove(e) {
      if (!this._dragging) return;
      const box = e.currentTarget.getBoundingClientRect();
      const pt = e.touches ? e.touches[0] : e;
      let x = ((pt.clientX - box.left) / box.width) * 100;
      let y = ((pt.clientY - box.top) / box.height) * 100;
      this.overlayX = Math.min(100, Math.max(0, Math.round(x)));
      this.overlayY = Math.min(100, Math.max(0, Math.round(y)));
    },
    overlayDragEnd() { this._dragging = false; },
    // Lineas de la marca para una foto (usa el helper global de photo-utils).
    overlayInfoLinesFor(photo) { return photo ? overlayInfoLines(photo, this.device && this.device.name) : []; },
    // CSS del overlay para el lightbox. Fuente en px segun el ancho real de la
    // imagen (ancho/42*size), igual que el render de descarga.
    overlayCss() {
      const s = this.overlayStyle || {};
      const w = this.lbImgW || 600;
      const parts = [
        `left:${this.overlayX}%`, `top:${this.overlayY}%`, `transform:translate(-50%,-50%)`,
        `font-size:${(((Number(s.size) || 1.2) * w) / 42).toFixed(1)}px`,
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
    async saveOverlay() {
      try {
        await API.put(`/api/devices/${this.deviceId}/overlay`, { x: this.overlayX, y: this.overlayY, enabled: this.overlayEnabled });
        if (this.device) { this.device.overlay_x = this.overlayX; this.device.overlay_y = this.overlayY; this.device.overlay_enabled = this.overlayEnabled; }
        this.showToast('Posición de la marca guardada', 'success');
      } catch (e) {
        this.showToast('No se pudo guardar (¿eres admin?)', 'error');
      }
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
