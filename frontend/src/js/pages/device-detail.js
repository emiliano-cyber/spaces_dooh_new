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
    // Hay un intento de conexion en curso. Conectar tarda: el visor espera hasta
    // 40 s a que el equipo empiece a publicar, y en ese silencio la gente volvia
    // a picarle al boton, encimando un START_STREAM sobre otro.
    streamStarting: false,
    streamError: '',   // motivo del ultimo intento fallido, para explicarlo en el visor
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
    // Quien puede GUARDAR ajustes de camara (encuadre, color, enfoque). El
    // operador tambien: ajustar la vista de un sitio es parte de operarlo.
    puedeAjustar: false,
    // --- Ajustes de imagen del equipo (encuadre fino y color) ---
    // Viven en el servidor y viajan en cada orden de foto. Nacieron porque la
    // Raspberry ignoraba hasta el zoom, y para corregir el tinte morado que da
    // una camara sin filtro infrarrojo.
    ajustesAbiertos: false,
    ajustes: {},
    manualWb: false,
    fotoPrueba: '',
    probandoAjustes: false,
    guardandoAjustes: false,
    controlesImagen: [
      { campo: 'centro_x',   nombre: 'Centro horizontal', min: 0,  max: 1, pordefecto: 0.5 },
      { campo: 'centro_y',   nombre: 'Centro vertical',   min: 0,  max: 1, pordefecto: 0.5 },
      { campo: 'brillo',     nombre: 'Brillo',            min: -1, max: 1, pordefecto: 0 },
      { campo: 'contraste',  nombre: 'Contraste',         min: 0,  max: 2, pordefecto: 1 },
      { campo: 'saturacion', nombre: 'Saturación',        min: 0,  max: 2, pordefecto: 1 },
      { campo: 'nitidez',    nombre: 'Nitidez',           min: 0,  max: 2, pordefecto: 1 },
    ],
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
      try {
        const rol = JSON.parse(localStorage.getItem('user') || '{}').role;
        this.isAdmin = rol === 'admin';
        this.puedeAjustar = rol === 'admin' || rol === 'operator';
      } catch (_) {}

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
        // Ajustes de imagen guardados (encuadre fino y color).
        try {
          const aj = typeof this.device.camera_ajustes === 'string'
            ? JSON.parse(this.device.camera_ajustes || 'null')
            : this.device.camera_ajustes;
          this.ajustes = aj || {};
        } catch (_) { this.ajustes = {}; }
        this.manualWb = this.ajustes.awb_rojo != null && this.ajustes.awb_azul != null;
        // Enfoque fijo del sitio: si esta guardado, el visor arranca bloqueado
        // para todos, no solo para quien lo puso.
        this.focusLocked = this.ajustes.enfoque_fijo === true;
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

    // Equipos que transmiten por el servidor de medios (Raspberry, PC con camara
    // IP). Importa para los controles del visor: los deslizadores de zoom,
    // exposicion, balance y enfoque mandan ordenes por el canal de datos de
    // WebRTC, que SOLO implementan los telefonos. En la Raspberry se movia el
    // zoom y no pasaba absolutamente nada, sin un aviso ni un error: parecia
    // descompuesto. Ahora se le muestran los controles que si le sirven.
    get esRelay() {
      return /^(pi|pc)-agent/i.test(this.device?.app_version || '');
    },

    // Encuadre del sitio en estos equipos: zoom y a donde apunta el recorte.
    //
    // NO es en vivo. El recorte se le da a la camara al arrancar, asi que para
    // verlo hay que reabrir la transmision. Lo que se cuida es que eso no parezca
    // una falla: el visor NO se apaga, se queda con un aviso encima mientras
    // vuelve. Antes se cerraba entero y la imagen "se iba".
    reencuadrando: false,
    vistaOcupada: null,   // {con, minutos} si otra persona tiene la vista

    encuadreDeSitio(campo, valor) {
      const v = Number(valor) || 0;
      if (campo === 'zoom') this.zoom = v;
      else this.ajustes = { ...this.ajustes, [campo]: v };

      // Se espera a que suelte el deslizador: si no, se guardaria en cada pixel
      // que arrastra y se reabriria la transmision decenas de veces.
      if (this._encuadreT) clearTimeout(this._encuadreT);
      this._encuadreT = setTimeout(() => this._aplicarEncuadre(), 800);
    },

    async _aplicarEncuadre() {
      const cuerpo = { zoom: this.zoom, ajustes: this._cuerpoAjustes() };
      try {
        await API.put(`/api/devices/${this.deviceId}/camera`, cuerpo);
        this.savedZoom = this.zoom;
        if (this.device) this.device.camera_zoom = this.zoom;
      } catch (err) {
        this.showToast(err && err.status === 403 ? 'Necesitas rol admin' : 'No se pudo guardar el encuadre', 'error');
        return;
      }

      if (!this.streaming) {
        this.showToast('Encuadre guardado: se aplica a las fotos y a la vista en vivo', 'success');
        return;
      }

      // Se reabre SIN bajar la bandera de streaming, para que el visor y sus
      // controles sigan en pantalla y no parezca que se cayo la transmision.
      this.reencuadrando = true;
      try {
        await this.streamClient?.stop();
        this.streamClient = null;
        // La camara del equipo tarda un instante en soltarse; sin esta pausa la
        // nueva transmision arranca contra una camara todavia ocupada.
        await new Promise((r) => setTimeout(r, 1200));
        await this.startStream();
      } catch (err) {
        this.showToast('No se pudo reabrir la vista con el encuadre nuevo', 'error');
      } finally {
        this.reencuadrando = false;
      }
    },

    // ---- Ajustes de imagen (encuadre fino y color) -------------------------

    alternarWbManual(activado) {
      this.manualWb = activado;
      if (activado) {
        if (this.ajustes.awb_rojo == null) this.ajustes.awb_rojo = 1.5;
        if (this.ajustes.awb_azul == null) this.ajustes.awb_azul = 1.5;
      } else {
        this.ajustes.awb_rojo = null;
        this.ajustes.awb_azul = null;
      }
    },

    // Punto de partida para una camara SIN filtro infrarrojo (la Module 3 NoIR).
    // La vegetacion refleja muchisimo infrarrojo cercano, esa luz entra al sensor
    // y las hojas salen moradas. Se baja la ganancia de rojo, se sube algo la de
    // azul y se quita saturacion. NO lo arregla del todo: es fisica del sensor y
    // desde el software solo se atenua. Hay que afinarlo con "Probar".
    presetSinFiltroIR() {
      this.manualWb = true;
      this.ajustes = {
        ...this.ajustes,
        awb_rojo: 1.05,
        awb_azul: 1.9,
        saturacion: 0.75,
        contraste: 1.1,
      };
      this.showToast('Punto de partida aplicado. Dale a "Probar" y afina con los deslizadores.', 'info');
    },

    restablecerAjustes() {
      this.ajustes = {};
      this.manualWb = false;
      this.showToast('Ajustes en blanco. Guarda para que el equipo los tome.', 'info');
    },

    _cuerpoAjustes() {
      const a = { ...this.ajustes };
      // Sin las dos ganancias no se manda ninguna: el agente las ignora sueltas.
      if (!this.manualWb || a.awb_rojo == null || a.awb_azul == null) {
        delete a.awb_rojo; delete a.awb_azul;
      }
      Object.keys(a).forEach((k) => { if (a[k] === null || a[k] === undefined) delete a[k]; });
      return Object.keys(a).length ? a : null;
    },

    async guardarAjustes() {
      if (this.guardandoAjustes) return;
      this.guardandoAjustes = true;
      try {
        await API.put(`/api/devices/${this.deviceId}/camera`, { ajustes: this._cuerpoAjustes() });
        this.showToast('Ajustes guardados: se aplican a todas las fotos del equipo', 'success');
        return true;
      } catch (err) {
        this.showToast(err && err.status === 403 ? 'Necesitas rol admin' : 'No se pudieron guardar', 'error');
        return false;
      } finally {
        this.guardandoAjustes = false;
      }
    },

    // Guarda y pide una foto: los ajustes viajan al equipo dentro de la orden,
    // asi que hay que guardarlos antes o la prueba saldria con los anteriores.
    async probarAjustes() {
      if (this.probandoAjustes) return;
      if (!(await this.guardarAjustes())) return;
      this.probandoAjustes = true;
      try {
        const antes = this.recentPhotos[0]?.id;
        await API.post(`/api/devices/${this.deviceId}/command`, { command_type: 'TAKE_PHOTO', priority: 1 });
        let intentos = 0;
        const sondeo = setInterval(async () => {
          intentos++;
          await this.loadPhotos();
          const nueva = this.recentPhotos[0];
          if (nueva && nueva.id !== antes) {
            clearInterval(sondeo);
            this.probandoAjustes = false;
            this.fotoPrueba = nueva.storage_path || nueva.thumbnail_path;
            this.showToast('Así se ve con estos ajustes', 'success');
          } else if (intentos >= 15) {   // ~30 s
            clearInterval(sondeo);
            this.probandoAjustes = false;
            this.showToast('No llegó la foto: el equipo puede estar apagado o transmitiendo', 'error');
          }
        }, 2000);
      } catch (err) {
        this.probandoAjustes = false;
        this.showToast('No se pudo pedir la foto de prueba', 'error');
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
        // Fotos limpias (APK v0.8.0): dibujamos la marca configurable (nombre/fecha/hora
        // de captura) en la posicion del dispositivo. Fotos con marca quemada: sin overlay.
        const clean = this.lightbox.watermark_baked === 0 || this.lightbox.watermark_baked === false;
        const on = clean && this.overlayEnabled;
        const lines = on ? overlayInfoLines(this.lightbox, this.device && this.device.name) : null;
        const pos = on ? { x: this.overlayX, y: this.overlayY } : null;
        await downloadRotatedImage(this.lightbox.storage_path, this.lbRotation + giroDeFoto(this.lightbox), `${base}_${ts}.jpg`, lines, pos, on ? this.overlayStyle : null);
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
      // Un solo intento a la vez. El boton ya se deshabilita en la vista, pero
      // aqui se entra tambien desde el "Reintentar" de vista ocupada, desde el
      // cambio de lente y desde _aplicarEncuadre, y dos START_STREAM encimados
      // dejaban al equipo publicando en una ruta y al visor esperando en otra.
      //
      // El candado mira SOLO el intento en curso, no `streaming`: _aplicarEncuadre
      // reabre la vista a proposito con la bandera arriba para que el visor no
      // parpadee, y mirar `streaming` aqui lo romperia.
      if (this.streamStarting) return;
      this.streamStarting = true;
      this.streamError = '';

      const video = document.getElementById('liveVideo');
      this.streamLeft = 180;
      // Los telefonos transmiten punto a punto; la Raspberry y las PCs con
      // camara IP pasan por el servidor de medios. Se distingue por la version
      // del agente, que la ponemos nosotros ("pi-agent", "pc-agent").
      const porServidor = /^(pi|pc)-agent/i.test(this.device?.app_version || '');
      const Cliente = porServidor ? WhepStreamClient : LiveStreamClient;
      this.streamClient = new Cliente(Number(this.deviceId), video, {
        onTick: (s) => { this.streamLeft = s; },
        // Corte a los 3 min: evita que un stream olvidado siga consumiendo
        // datos del equipo y deje sesiones colgadas en el TURN.
        onAutoStop: async () => {
          await this.stopStream();
          this.showToast('Transmisión detenida automáticamente a los 3 minutos', 'info');
        },
        onError: async (msg) => {
          // El fallo puede llegar ANTES de que la vista se de por activa: el
          // visor de los equipos relay avisa por aqui y su start() termina
          // normal, sin lanzar. Con el "if (!this.streaming)" de antes ese
          // motivo se tiraba a la basura y el usuario se quedaba mirando un
          // recuadro negro sin una sola explicacion. Se guarda para que lo
          // recoja startStream.
          if (this.streamStarting) { this.streamError = msg; return; }
          if (!this.streaming) return;
          await this.stopStream();
          this.streamError = msg;
          this.showToast(msg, 'error');
        },
      });
      try {
        await this.streamClient.start();
      } catch (err) {
        this.streamClient = null;
        // Alguien mas tiene abierta la vista de este equipo.
        //
        // Solo pasa en los telefonos: ahi cada espectador es OTRA conexion de
        // video saliendo del equipo, o sea el doble de datos moviles, asi que no
        // se comparte a proposito. En la Raspberry y las camaras IP el servidor
        // de medios reparte el mismo video y el backend nos habria unido sin
        // avisar de nada.
        if (err && err.status === 409 && err.body && err.body.error === 'vista_ocupada') {
          this.vistaOcupada = { con: err.body.con, minutos: err.body.minutos };
          this.showToast(
            `${err.body.con} está viendo este equipo desde hace ${err.body.minutos} min`,
            'error'
          );
          return;
        }
        // Antes se relanzaba y moria como promesa sin capturar: en pantalla no
        // pasaba absolutamente nada. Ahora el visor lo dice y ofrece reintentar.
        const motivos = {
          servidor_de_medios_no_configurado:
            'El servidor de video no está configurado. Es cosa del servidor, no del equipo.',
        };
        this.streamError = motivos[err?.body?.error]
          || `No se pudo iniciar la transmisión${err?.message ? ` (${err.message})` : ''}.`;
        // Puede venir de _aplicarEncuadre, que reabre con la bandera arriba: si
        // el reintento falla hay que bajarla o el visor se queda diciendo "en
        // vivo" sobre una transmision que ya no existe.
        this.streaming = false;
        this.showToast(this.streamError, 'error');
        return;
      } finally {
        this.streamStarting = false;
      }

      // Los visores avisan de los fallos de conexion por onError y su start()
      // termina sin lanzar, asi que hay que mirar si quedo un motivo antes de
      // dar la vista por buena. Si no, se marcaba "en vivo" un recuadro negro.
      if (this.streamError) {
        const motivo = this.streamError;
        await this.streamClient?.stop();
        this.streamClient = null;
        this.streaming = false;
        this.streamError = motivo;
        this.showToast(motivo, 'error');
        return;
      }

      this.vistaOcupada = null;
      this.streaming = true;
      // Se esta compartiendo la vista que otra persona abrio: conviene saberlo,
      // porque el corte a los 3 minutos lo manda quien la abrio primero.
      if (this.streamClient.compartida) {
        this.showToast(`Viendo la transmisión que abrió ${this.streamClient.compartidaCon}`, 'info');
      }
      // Re-aplicar los ajustes que definiste, cuando la camara ya este lista.
      setTimeout(() => this.reapplyControls(), 1500);
    },

    async stopStream() {
      await this.streamClient?.stop();
      this.streamClient = null;
      this.streaming = false;
      this.streamLeft = 0;
      // Detener a mano limpia el aviso del intento anterior: quien vuelve a
      // "Iniciar" no deberia seguir leyendo el error de hace rato.
      this.streamError = '';
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
      if (this.focusLocked) {
        this.camControl({
          action: 'lock_focus',
          x: Number(this.ajustes.enfoque_x ?? 0.5),
          y: Number(this.ajustes.enfoque_y ?? 0.5),
        });
      }
    },

    // Estilo del video segun la rotacion. En 90°/270° escala x(4/3) para LLENAR
    // el recuadro 4:3 (si no, quedarian barras negras al girar). El frame es 4:3.
    //
    // Devuelve un OBJETO, no una cadena, y eso NO es cosmetico. Con una cadena
    // Alpine reescribe el atributo `style` entero, y ahi se lleva por delante el
    // `display:none` que `x-show` le habia puesto al video.
    //
    // Pasaba en CADA carga de la ficha: Alpine arranca y esconde el video, pero
    // enseguida loadDevice() asigna this.rotation, esta expresion se recalcula,
    // el atributo se reescribe y el video vuelve a existir en el acomodo. Como
    // es negro sobre negro no se ve, pero ocupa su lugar: el recuadro es flex y
    // el bloque de "Stream no activo" quedaba empujado a la derecha. Al detener
    // el stream se enderezaba solo, porque ahi `streaming` cambia y x-show
    // vuelve a escribir display:none.
    //
    // Con un objeto, Alpine toca unicamente la propiedad `transform` y deja en
    // paz al resto.
    videoStyle() {
      const r = ((Number(this.rotation) % 360) + 360) % 360;
      const scale = (r === 90 || r === 270) ? (4 / 3) : 1;
      return { transform: `rotate(${r}deg) scale(${scale})` };
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

    // Los sitios con camara IP SI tienen vista en vivo desde el agente de PC
    // v1.1.0: ffmpeg toma el RTSP de la camara y lo publica en el servidor de
    // medios, que es de donde lo lee el navegador (startStream ya los manda por
    // WhepStreamClient). Los que siguen en 1.0.0 no lo traen, y ahi el boton se
    // quedaba esperando 20 s para acabar culpando al equipo de no responder,
    // que es justo lo contrario de lo que pasa.
    //
    // El bloqueo mira la VERSION, no el tipo de equipo: cuando una PC se
    // actualiza por red, el boton se enciende solo. Cuando el bloqueo miraba el
    // tipo, REVOLUCION 267 quedo con el boton apagado aun corriendo la v1.1.0 y
    // publicando bien -- el equipo estaba listo y el dashboard no dejaba verlo.
    sinVistaEnVivo() {
      const m = /^pc-agent\s*v?(\d+)\.(\d+)/i.exec(String(this.device?.app_version || ''));
      if (!m) return false;
      const mayor = Number(m[1]);
      const menor = Number(m[2]);
      return mayor < 1 || (mayor === 1 && menor < 1);
    },

    // ---- Actualizacion remota de la app ----
    // Antes cada version nueva exigia ir sitio por sitio a reinstalar el APK.
    apkLatest: null,
    updating: false,
    async loadAppVersion() {
      try { this.apkLatest = await API.get('/api/app/version'); } catch (_) { this.apkLatest = null; }
    },
    // Lo publicado PARA ESTE equipo. Cada tipo baja lo suyo, y compararlos todos
    // contra el APK dejaba a las PCs y a la Raspberry marcadas como atrasadas
    // para siempre: "pc-agent 1.1.0" nunca va a coincidir con "0.13.0".
    publicadoParaEsteEquipo() {
      if (this.esAgenteDePc()) return this.apkLatest?.agente_pc;
      if (this.esAgenteDePi()) return this.apkLatest?.agente_pi;
      return this.apkLatest;
    },
    // Un equipo esta atrasado si su version instalada es menor a la publicada.
    // Las APK anteriores a la v0.10.0 no reportan su numero: en ese caso se
    // compara por nombre, que basta para saber que no estan al dia.
    appAtrasada() {
      const pub = this.publicadoParaEsteEquipo();
      if (!pub?.disponible || !this.device) return false;

      // Los agentes se anuncian como "pc-agent 1.2.0" / "pi-agent 0.2.0"; lo que
      // se compara es el numero, no la etiqueta.
      const instaladaTexto = String(this.device.app_version || '').replace(/^(pc|pi)-agent\s*v?/i, '');
      const instalado = Number(this.device.app_version_code) || 0;
      if (pub.version_code && instalado) return instalado < pub.version_code;
      return Boolean(pub.version && instaladaTexto && instaladaTexto !== pub.version);
    },
    // Sin device owner, Android exige que alguien confirme en la pantalla del
    // equipo. Conviene decirlo ANTES de mandar la orden, no despues.
    puedeActualizarSolo() {
      return this.device?.device_owner === 1 || this.device?.device_owner === true;
    },
    // Las PCs con camara IP y la Raspberry se actualizan solas SIEMPRE: no hay
    // pantalla donde confirmar nada. El aviso de "device owner" es cosa de
    // Android y en un equipo de estos solo confunde.
    esAgenteDePc() {
      return /^pc-agent/i.test(String(this.device?.app_version || ''));
    },
    esAgenteDePi() {
      return /^pi-agent/i.test(String(this.device?.app_version || ''));
    },
    // Los unicos que necesitan a alguien delante son los telefonos sin device
    // owner. Antes esta condicion no distinguia el tipo de equipo y a una PC o a
    // la Raspberry se les pedia "confirmar en la pantalla", que no existe.
    seActualizaSolo() {
      return this.esAgenteDePc() || this.esAgenteDePi() || this.puedeActualizarSolo();
    },
    async updateApp() {
      const aviso = this.esAgenteDePc()
        ? `Se instalará el agente publicado en esta PC. Verifica la huella del archivo antes de sustituirlo y, si el programa nuevo no arranca, vuelve solo al anterior.`
        : this.esAgenteDePi()
          ? `Se instalará el agente publicado en esta Raspberry. Verifica la huella y lo prueba antes de reemplazar nada; si la versión nueva no arranca, vuelve sola a la anterior. La identidad del equipo y sus fotos pendientes se conservan.`
          : this.puedeActualizarSolo()
            ? `Se instalará la versión ${this.apkLatest?.version || 'publicada'} en este equipo. Tardará un par de minutos y la app se reiniciará sola.`
            : `Este equipo NO puede instalar solo: alguien tendrá que confirmar la instalación EN LA PANTALLA del teléfono. ¿Enviar de todos modos?`;
      if (!confirm(aviso)) return;
      this.updating = true;
      try {
        await API.post(`/api/devices/${this.deviceId}/command`, { command_type: 'UPDATE_APP' });
        this.showToast(this.seActualizaSolo()
          ? 'Actualización enviada; el equipo se reiniciará al terminar'
          : 'Orden enviada: falta confirmar la instalación en el equipo', 'success');
      } catch (e) {
        const motivos = {
          apk_no_publicado: 'No hay APK publicada en el servidor',
          agente_no_publicado: 'No hay agente de PC publicado en el servidor',
          agente_pi_no_publicado: 'No hay agente de Raspberry publicado en el servidor',
        };
        this.showToast(motivos[e?.body?.error] || 'No se pudo enviar la actualización', 'error');
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
    // Bloquear el enfoque se GUARDA en el equipo. Antes vivia solo en esta
    // pestaña: al cortarse la transmision (a los 3 minutos) o al abrirla otra
    // persona, la camara volvia a enfoque continuo y la imagen saltaba cada vez
    // que pasaba un creativo de muchos colores.
    async toggleFocusLock() {
      this.focusLocked = !this.focusLocked;
      const x = Number(this.ajustes.enfoque_x ?? 0.5);
      const y = Number(this.ajustes.enfoque_y ?? 0.5);
      this.camControl({ action: this.focusLocked ? 'lock_focus' : 'unlock_focus', x, y });
      await this._guardarEnfoque();
    },

    // Tocar el video enfoca ahi. Si el enfoque esta bloqueado, ese punto pasa a
    // ser el punto fijo del sitio: es la forma natural de decir "enfoca AQUI".
    async _guardarEnfoque() {
      this.ajustes = { ...this.ajustes, enfoque_fijo: this.focusLocked };
      try {
        await API.put(`/api/devices/${this.deviceId}/camera`, { ajustes: this._cuerpoAjustes() });
        this.showToast(
          this.focusLocked
            ? 'Enfoque fijado: se aplica solo cada vez que se abra la vista'
            : 'Enfoque libre: la cámara vuelve a enfocar sola',
          'success'
        );
      } catch (err) {
        this.showToast(err && err.status === 403 ? 'Necesitas rol admin' : 'No se pudo guardar el enfoque', 'error');
      }
    },
    focusPoint(evt) {
      if (!this.streaming) return;
      const rect = evt.currentTarget.getBoundingClientRect();
      const x = (evt.clientX - rect.left) / rect.width;
      const y = (evt.clientY - rect.top) / rect.height;
      this.camControl({ action: this.focusLocked ? 'lock_focus' : 'focus', x, y });
      if (this.focusLocked) {
        this.ajustes = { ...this.ajustes, enfoque_x: Math.round(x * 100) / 100, enfoque_y: Math.round(y * 100) / 100 };
        this._guardarEnfoque();
      }
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
