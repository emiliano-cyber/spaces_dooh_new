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
    // Encuadre con el que salio la transmision que se esta viendo. Es la
    // referencia contra la que se calcula el zoom instantaneo del visor.
    zoomEnStream: 0,
    centroEnStream: null,
    // Brillo con el que salio ESTA transmision. Es la referencia contra la que se
    // calcula la vista previa: si no, al reabrir la vista con el brillo ya
    // aplicado se veria aclarada dos veces.
    brilloEnStream: 0,
    streamLeft: 0, // segundos restantes antes del corte automatico
    // Numero del visor vigente. Es un NUMERO a proposito, no el objeto del
    // visor: Alpine guarda los datos del componente en un proxy reactivo, asi
    // que al leer `this.streamClient` NO vuelve el mismo objeto que se guardo
    // sino su envoltorio, y comparar identidad (`this.streamClient === cliente`)
    // era SIEMPRE falso. Con eso, las tres devoluciones del visor -la cuenta
    // regresiva, el corte a los 3 minutos y los errores- se salian por la
    // guarda y no hacian nada. Un entero atraviesa el proxy tal cual.
    streamTurno: 0,
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
    // A donde apunta el recorte, tal como esta GUARDADO en el equipo. Hacia falta
    // para poder comparar: sin esto el boton no sabia si habias movido el centro,
    // y "Descartar" no tenia a donde volver.
    savedCentro: { x: 0.5, y: 0.5 },
    savedBrillo: 0,
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
    exposicionManual: false,
    fotoPrueba: '',
    probandoAjustes: false,
    guardandoAjustes: false,
    controlesImagen: [
      { campo: 'centro_x',   nombre: 'Centro horizontal', min: 0,  max: 1, pordefecto: 0.5 },
      { campo: 'centro_y',   nombre: 'Centro vertical',   min: 0,  max: 1, pordefecto: 0.5 },
      { campo: 'brillo',     nombre: 'Brillo',            min: -1, max: 1, pordefecto: 0 },
      { campo: 'ev',         nombre: 'Exposición',        min: -3, max: 3, pordefecto: 0 },
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
      this.loadCreativos();
      this.loadPantalla();
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
      // Una falla de la pantalla se abrio o se cerro: se ve sin recargar.
      dashboardSocket.on('pantalla:falla', (data) => {
        if (data.device_id === Number(this.deviceId)) { this.loadPantalla(); this.loadPhotos(); }
        window.contarFallas?.();
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
        this.savedCentro = {
          x: Number(this.ajustes.centro_x ?? 0.5),
          y: Number(this.ajustes.centro_y ?? 0.5),
        };
        this.savedBrillo = Number(this.ajustes.brillo ?? 0);
        this.manualWb = this.ajustes.awb_rojo != null && this.ajustes.awb_azul != null;
        this.exposicionManual = Number(this.ajustes.obturador) > 0;
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

    // --- Creativos detectados en la pantalla ---------------------------------
    //
    // El equipo mira su pantalla cada tantas horas SIN subir nada, reconoce cada
    // anuncio por su huella y solo manda foto de lo que no habia visto. Aqui se
    // enciende por equipo y se ve lo que va encontrando.
    creativos: null,         // { config, fotos_hoy, creativos: [...] }
    guardandoCreativos: false,

    // Que agentes saben vigilar. La APK desde la 0.15.0 y la Raspberry; el agente
    // de PC no. Encenderlo en un equipo que no sabe hacerlo no hace nada, y eso
    // hay que decirlo en vez de dejar un interruptor que miente.
    sabeVigilar() {
      const v = String(this.device?.app_version || '');
      if (v.startsWith('pi-agent')) return true;
      if (v.startsWith('pc-agent')) return false;
      const [a, b] = v.split('.').map(Number);
      return a > 0 || (a === 0 && b >= 15);
    },

    // Solo la APK (0.15.0+) usa la pantalla marcada y busca fallas; la Raspberry
    // sigue mirando la foto entera para los creativos (ver migracion 018).
    usaPantalla() {
      const v = String(this.device?.app_version || '');
      return this.sabeVigilar() && !v.startsWith('pi-agent');
    },

    async loadCreativos() {
      try {
        this.creativos = await API.get(`/api/devices/${this.deviceId}/creativos`);
      } catch (err) {
        console.error('Failed to load creativos:', err);
      }
    },

    // Los que tienen foto son los hallazgos; los demas son el loop que se
    // aprendio (o huellas sin foto por el tope diario).
    creativosConFoto() {
      return (this.creativos?.creativos || []).filter((c) => c.photo_id && !c.descartado);
    },

    async guardarCreativos(cambios) {
      this.guardandoCreativos = true;
      try {
        await API.put(`/api/devices/${this.deviceId}/creativos`, cambios);
        await this.loadCreativos();
      } catch (err) {
        alert('No se pudo guardar: ' + (err.message || err));
      } finally {
        this.guardandoCreativos = false;
      }
    },

    async descartarCreativo(c) {
      try {
        await API.put(`/api/creativos/${c.id}`, { descartado: true });
        await this.loadCreativos();
      } catch (err) {
        alert('No se pudo descartar: ' + (err.message || err));
      }
    },

    async reaprenderCreativos() {
      if (!confirm('Se borra todo lo que el equipo aprendió de esta pantalla y vuelve a aprender 24 horas sin tomar fotos. ¿Seguir?')) return;
      try {
        await API.post(`/api/devices/${this.deviceId}/creativos/reaprender`, {});
        await this.loadCreativos();
      } catch (err) {
        alert('No se pudo reiniciar: ' + (err.message || err));
      }
    },

    // --- Pantalla y fallas ---------------------------------------------------
    //
    // Donde esta la pantalla en la foto (4 esquinas), cuantos gabinetes tiene y
    // su horario. Con eso el equipo vigila por si mismo: reconoce creativos y
    // busca fallas SIN mandar imagenes, y solo avisa cuando algo cambia de estado.
    pant: null,              // { pantalla, salud, ultimo, fallas }
    editPant: null,          // copia en edicion { esquinas, filas, columnas, excluir, horario }
    modoPant: 'esquinas',    // 'esquinas' | 'excluir'
    _arrastre: null,         // indice de la esquina que se arrastra
    guardandoPant: false,

    async loadPantalla() {
      try {
        this.pant = await API.get(`/api/devices/${this.deviceId}/pantalla`);
      } catch (err) {
        console.error('Failed to load pantalla:', err);
      }
    },

    // La foto sobre la que se marca: la mas reciente que NO sea una evidencia
    // (esas traen dibujos encima).
    fotoReferencia() {
      const p = this.recentPhotos && this.recentPhotos.find((x) => x.source !== 'falla');
      return p ? (p.storage_path || p.thumbnail_path) : null;
    },

    empezarPantalla() {
      const p = this.pant?.pantalla;
      this.editPant = p
        ? JSON.parse(JSON.stringify({ ...p, excluir: p.excluir || [], horario: p.horario || { inicio: '06:00', fin: '24:00' } }))
        : { esquinas: [], filas: 1, columnas: 1, excluir: [], horario: { inicio: '06:00', fin: '24:00' } };
      this.modoPant = 'esquinas';
    },

    _puntoFoto(e) {
      const caja = this.$refs.fotoPant.getBoundingClientRect();
      return [
        Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width)),
        Math.min(1, Math.max(0, (e.clientY - caja.top) / caja.height)),
      ];
    },

    pantAbajo(e) {
      if (!this.editPant || !this.puedeAjustar) return;
      e.preventDefault();
      const [x, y] = this._puntoFoto(e);
      const q = this.editPant.esquinas;
      if (this.modoPant === 'excluir' && q.length === 4) {
        const celda = Pantalla.celdaEn({ ...this.editPant, filas: Number(this.editPant.filas), columnas: Number(this.editPant.columnas) }, x, y);
        if (!celda) return;
        const k = this.editPant.excluir.findIndex(([f, c]) => f === celda[0] && c === celda[1]);
        if (k >= 0) this.editPant.excluir.splice(k, 1); else this.editPant.excluir.push(celda);
        return;
      }
      // Cerca de una esquina: se arrastra. Si faltan esquinas: se agrega.
      const caja = this.$refs.fotoPant.getBoundingClientRect();
      const cerca = q.findIndex(([qx, qy]) => Math.hypot((qx - x) * caja.width, (qy - y) * caja.height) < 18);
      if (cerca >= 0) this._arrastre = cerca;
      else if (q.length < 4) { q.push([x, y]); this._arrastre = q.length - 1; }
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },

    pantMueve(e) {
      if (this._arrastre == null) return;
      this.editPant.esquinas.splice(this._arrastre, 1, this._puntoFoto(e));
    },

    pantArriba() { this._arrastre = null; },

    // Lo que se dibuja encima de la foto (en fracciones: el SVG usa viewBox 0 0 1 1).
    pantPoligono() {
      const q = this.editPant?.esquinas || [];
      return q.map((p) => p.join(',')).join(' ');
    },
    _pantNum() {
      const p = this.editPant;
      return { ...p, filas: Math.max(1, Number(p.filas) || 1), columnas: Math.max(1, Number(p.columnas) || 1) };
    },
    pantLineas() {
      if (!this.editPant || this.editPant.esquinas.length !== 4) return [];
      return Pantalla.lineas(this._pantNum());
    },
    pantExcluidas() {
      if (!this.editPant || this.editPant.esquinas.length !== 4) return [];
      const p = this._pantNum();
      return p.excluir.filter(([f, c]) => f < p.filas && c < p.columnas).map(([f, c]) => Pantalla.contorno(p, f, c));
    },

    async guardarPantalla() {
      const p = this.editPant;
      if (!p || p.esquinas.length !== 4) return;
      const antes = this.pant?.pantalla;
      const filas = Number(p.filas), columnas = Number(p.columnas);
      const cambiaImagen = antes && (JSON.stringify(antes.esquinas) !== JSON.stringify(p.esquinas)
        || antes.filas !== filas || antes.columnas !== columnas);
      if (cambiaImagen && !confirm('Cambiaron las esquinas o los gabinetes: el equipo olvida lo que aprendió de esta pantalla y vuelve a aprender 24 horas. ¿Seguir?')) return;
      const redondea = (v) => Math.round(v * 1000) / 1000;
      this.guardandoPant = true;
      try {
        await API.put(`/api/devices/${this.deviceId}/pantalla`, {
          esquinas: p.esquinas.map(([x, y]) => [redondea(x), redondea(y)]),
          filas, columnas,
          excluir: p.excluir.filter(([f, c]) => f < filas && c < columnas),
          horario: { inicio: p.horario.inicio || '06:00', fin: p.horario.fin || '24:00' },
        });
        this.editPant = null;
        await this.loadPantalla();
        await this.loadCreativos();
      } catch (err) {
        alert('No se pudo guardar: ' + (err.message || err));
      } finally {
        this.guardandoPant = false;
      }
    },

    async guardarSalud(cambios) {
      try {
        await API.put(`/api/devices/${this.deviceId}/salud`, cambios);
        await this.loadPantalla();
      } catch (err) {
        alert('No se pudo guardar: ' + (err.message || err));
      }
    },

    async cerrarFalla(f, estado) {
      const texto = estado === 'descartada'
        ? 'Marcar como "no es falla". El equipo no volverá a avisar de esta zona en 7 días.'
        : 'Marcar como resuelta sin esperar a que el equipo lo compruebe.';
      const nota = prompt(texto + '\n\nNota (opcional):', '');
      if (nota === null) return;
      try {
        await API.put(`/api/fallas/${f.id}`, { estado, nota: nota || undefined });
        await this.loadPantalla();
        window.contarFallas?.();
      } catch (err) {
        alert('No se pudo cerrar: ' + (err.message || err));
      }
    },

    fallasAbiertas() { return (this.pant?.fallas || []).filter((f) => f.estado === 'abierta'); },
    nombreFalla(f) { return f.nombre || Pantalla.NOMBRES[f.tipo] || f.tipo; },
    dondeFalla(f) { return Pantalla.donde(f); },
    fechaCorta(v) { return v ? new Date(v).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'; },

    // Resumen de la ultima vuelta, en una linea.
    ultimaRevision() {
      const u = this.pant?.ultimo;
      if (!u) return 'El equipo todavía no ha hecho ninguna revisión.';
      const cuando = this.fechaCorta(u.ts || u.recibido);
      const pantalla = { OK: 'se ve bien', APAGADA: 'apagada', CONGELADA: 'congelada', INCONCLUSO: 'no se pudo juzgar' }[u.pantalla] || u.pantalla;
      const camara = { MOVIDA: ' · la cámara se movió', SIN_IMAGEN: ' · sin imagen' }[u.camara] || '';
      return `Última revisión ${cuando}: pantalla ${pantalla}${camara} (${u.vistazos} vistazos, ${u.cambios} cambios de anuncio).`;
    },

    // Zonas que el equipo aprendio que NUNCA cambian: tapadas... o ya muertas al instalar.
    zonasQuietas() {
      const ex = this.pant?.ultimo?.excluidas || [];
      const p = this.pant?.pantalla;
      if (!ex.length || !p) return '';
      return ex.map(([f, c]) => f * p.columnas + c + 1).join(', ');
    },

    finAprendizajeSalud() {
      const d = this.pant?.salud?.desde;
      return d ? new Date(new Date(d).getTime() + 24 * 3600 * 1000).toLocaleString() : '';
    },

    // Hasta cuando aprende (24 h desde que se encendio), como texto.
    finAprendizaje() {
      const desde = this.creativos?.config?.desde || null;
      if (!desde) return '';
      return new Date(new Date(desde).getTime() + 24 * 3600 * 1000).toLocaleString();
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

    // Mover un deslizador NO toca el equipo: solo mueve la vista previa.
    //
    // Antes se guardaba solo a los 1.5 s de soltar y la transmision se reabria
    // sola, con su aviso encima, cada vez que alguien corregia el encuadre. Para
    // afinar hacen falta varios intentos, asi que eso eran varios cortes y varios
    // avisos seguidos: molestaba y ademas escribia en el equipo encuadres que el
    // usuario todavia estaba descartando. Ahora se comporta como la camara de un
    // telefono: se ve al momento, y lo que decide es el boton.
    encuadreDeSitio(campo, valor) {
      const v = Number(valor) || 0;
      if (campo === 'zoom') this.zoom = v;
      else this.ajustes = { ...this.ajustes, [campo]: v };
    },

    // Volver al encuadre que tiene guardado el equipo, sin pedirle nada a nadie:
    // es la salida para quien se perdio moviendo deslizadores.
    descartarEncuadre() {
      this.zoom = Number(this.savedZoom) || 0;
      this.lens = this.savedLens;
      this.ajustes = {
        ...this.ajustes,
        centro_x: this.savedCentro.x,
        centro_y: this.savedCentro.y,
        brillo: this.savedBrillo,
      };
      // En los telefonos el zoom ya viajo a la camara mientras lo movias (canal
      // de camara en vivo), asi que devolver el numero no basta: hay que pedirle
      // al equipo que vuelva. En los de relay no hace falta, porque ahi nada
      // habia salido del navegador.
      if (!this.esRelay && this.streaming) this.onZoom();
    },

    // El unico camino que escribe el encuadre en el equipo. Lo usan los dos
    // visores: el de los telefonos y el de los equipos que pasan por el servidor
    // de medios.
    async aplicarEncuadre() {
      if (this.reencuadrando) return;
      const cambioLente = this.lens !== this.savedLens;
      // El brillo cuenta igual que el recorte: en estos equipos se le pasa a la
      // camara al arrancar, asi que para verlo de verdad hay que reabrir.
      const cambioRecorte = Math.abs(Number(this.zoom) - this.savedZoom) > 0.001
        || Math.abs(Number(this.ajustes.centro_x ?? 0.5) - this.savedCentro.x) > 0.001
        || Math.abs(Number(this.ajustes.centro_y ?? 0.5) - this.savedCentro.y) > 0.001
        || Math.abs(Number(this.ajustes.brillo ?? 0) - this.savedBrillo) > 0.001;

      try {
        await API.put(`/api/devices/${this.deviceId}/camera`, {
          lens: this.lens,
          zoom: Number(this.zoom) || 0,
          ajustes: this._cuerpoAjustes(),
        });
        this.savedLens = this.lens;
        this.savedZoom = Number(this.zoom) || 0;
        this.savedCentro = {
          x: Number(this.ajustes.centro_x ?? 0.5),
          y: Number(this.ajustes.centro_y ?? 0.5),
        };
        this.savedBrillo = Number(this.ajustes.brillo ?? 0);
        if (this.device) {
          this.device.camera_lens = this.savedLens;
          this.device.camera_zoom = this.savedZoom;
        }
      } catch (err) {
        this.showToast(err && err.status === 403 ? 'Necesitas rol admin' : 'No se pudo guardar el encuadre', 'error');
        return;
      }

      this.showToast('Encuadre fijado: se aplica también a las fotos programadas', 'success');

      // Reabrir la vista solo cuando hace falta de verdad. En los telefonos el
      // zoom ya viaja en vivo por el canal de camara, asi que ahi solo el LENTE
      // -que es otra camara fisica- obliga a reabrir. En los equipos que pasan
      // por el servidor de medios el recorte se le da a la camara al arrancar,
      // asi que para ver la version nitida hay que reabrir.
      const hayQueReabrir = cambioLente || (this.esRelay && cambioRecorte);
      if (!this.streaming || !hayQueReabrir) return;

      // Se reabre SIN bajar la bandera de streaming, para que el visor y sus
      // controles sigan en pantalla y no parezca que se cayo la transmision.
      this.reencuadrando = true;
      try {
        // El visor viejo pierde la vigencia aqui, al cerrarlo, y no 1200 ms
        // despues cuando arranca el nuevo: en ese hueco su aviso de muerte
        // llegaba a tiempo de tumbar una vista que seguia en pantalla.
        this.streamTurno++;
        await this.streamClient?.stop();
        this.streamClient = null;
        // La camara del equipo necesita un respiro para soltarse antes de que la
        // reclame la transmision nueva.
        //
        // Se probo bajarlo a 300 ms -el sensor de la Pi se reabre bien incluso
        // sin pausa- y fue un error: el problema no era el sensor, era que el
        // STOP y el START se pisaban en el camino y la vista se caia con un "se
        // perdio la señal". Vuelve a 1200 ms, que es lo que estaba probado.
        //
        // Y ya no se nota: el encuadre nuevo se ve al instante en el visor
        // (previewDeZoom), asi que esta espera ocurre por detras, con la imagen
        // ya puesta donde el usuario la quiere.
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

    // Exposicion a mano. Va todo o nada: el obturador fijo sin ganancia fija
    // deja la foto a merced de la hora del dia, asi que se guardan los dos o
    // ninguno.
    alternarExposicionManual(activado) {
      this.exposicionManual = activado;
      if (activado) {
        if (!Number(this.ajustes.obturador)) this.ajustes.obturador = 8000;
        if (!Number(this.ajustes.ganancia)) this.ajustes.ganancia = 1;
      } else {
        this.ajustes.obturador = 0;
        this.ajustes.ganancia = 0;
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

    // Punto de partida para fotografiar una PANTALLA de LED, que es lo que
    // hacen todos estos equipos y el caso que peor sale por omision.
    //
    // Dos problemas distintos, dos mandos:
    //
    //   LINEAS. Un LED prende y apaga miles de veces por segundo y se refresca
    //   por franjas; a mediodia la camara expone en menos de un milisegundo y
    //   atrapa solo un pedazo de ese ciclo. Medido el 27-ago en el
    //   espectacular: 40% de amplitud. El patron cae en fase distinta en cada
    //   cuadro -correlacion entre dos capturas: -0.10-, asi que promediando 16
    //   se va al 10%.
    //
    //   COLOR DURO. El 21.4% de los pixeles de la pantalla tenia un canal
    //   pegado en 250, o sea recortado, y un canal recortado ya perdio el dato.
    //   Se corrige exponiendo MENOS (ev) y midiendo la luz en el centro, donde
    //   esta la pantalla, en vez de en todo el cuadro, que es lo que la estaba
    //   quemando. El 'Brillo' no sirve para esto: suma luz despues de revelar.
    presetPantallaLed() {
      this.ajustes = {
        ...this.ajustes,
        cuadros: 16,
        ev: -0.7,
        medicion: 'spot',
      };
      this.showToast('Punto de partida para pantalla aplicado. Dale a "Probar" y sube o baja la Exposición.', 'info');
    },

    restablecerAjustes() {
      this.ajustes = {};
      this.manualWb = false;
      this.exposicionManual = false;
      this.showToast('Ajustes en blanco. Guarda para que el equipo los tome.', 'info');
    },

    _cuerpoAjustes() {
      const a = { ...this.ajustes };
      // Sin las dos ganancias no se manda ninguna: el agente las ignora sueltas.
      if (!this.manualWb || a.awb_rojo == null || a.awb_azul == null) {
        delete a.awb_rojo; delete a.awb_azul;
      }
      // 0 significa "automatico" para el agente; mandarlo suelto solo ensucia.
      if (!this.exposicionManual) { delete a.obturador; delete a.ganancia; }
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
        status: d.status || 'provisioning',
        // MySQL devuelve DECIMAL como texto, no como numero.
        lat: d.lat == null ? '' : String(d.lat),
        lng: d.lng == null ? '' : String(d.lng),
      };
      this.editMode = true;
    },

    // Las coordenadas se escriben a mano y hay que limpiarlas antes de mandarlas:
    // el campo vacio significa "no se sabe" (null) y NO cero, que es una isla en
    // el golfo de Guinea; y el backend espera numero, no texto.
    _cuerpoEquipo() {
      const c = { ...this.editForm };
      for (const k of ['lat', 'lng']) {
        const t = String(c[k] ?? '').trim();
        if (t === '') { c[k] = null; continue; }
        const n = Number(t);
        if (!Number.isFinite(n)) { delete c[k]; continue; }
        c[k] = n;
      }
      return c;
    },

    async saveDevice() {
      try {
        await API.put(`/api/devices/${this.deviceId}`, this._cuerpoEquipo());
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
      // cambio de lente y desde aplicarEncuadre, y dos START_STREAM encimados
      // dejaban al equipo publicando en una ruta y al visor esperando en otra.
      //
      // El candado mira SOLO el intento en curso, no `streaming`: aplicarEncuadre
      // reabre la vista a proposito con la bandera arriba para que el visor no
      // parpadee, y mirar `streaming` aqui lo romperia.
      if (this.streamStarting) return;
      this.streamStarting = true;
      this.streamError = '';

      const video = document.getElementById('liveVideo');
      this.streamLeft = 180;
      // Este visor es el vigente hasta que alguien abra otro o lo detenga.
      const miTurno = ++this.streamTurno;
      // Los telefonos transmiten punto a punto; la Raspberry y las PCs con
      // camara IP pasan por el servidor de medios. Se distingue por la version
      // del agente, que la ponemos nosotros ("pi-agent", "pc-agent").
      const porServidor = /^(pi|pc)-agent/i.test(this.device?.app_version || '');
      const Cliente = porServidor ? WhepStreamClient : LiveStreamClient;
      // Se guarda en una variable propia para poder reconocerlo despues: las
      // devoluciones de abajo tienen que saber si siguen siendo del visor vivo.
      const cliente = new Cliente(Number(this.deviceId), video, {
        onTick: (s) => { if (this.streamTurno === miTurno) this.streamLeft = s; },
        // Corte a los 3 min: evita que un stream olvidado siga consumiendo
        // datos del equipo y deje sesiones colgadas en el TURN.
        onAutoStop: async () => {
          if (this.streamTurno !== miTurno) return;
          await this.stopStream();
          this.showToast('Transmisión detenida automáticamente a los 3 minutos', 'info');
        },
        onError: async (msg) => {
          // Solo se atiende al visor VIGENTE.
          //
          // Al reencuadrar se cierra un visor y se abre otro enseguida. El aviso
          // de muerte del viejo llega DESPUES, cuando el nuevo ya esta
          // arrancando, y sin esta comprobacion mataba al recien nacido: la
          // vista se caia sola con un "se perdio la señal" que no correspondia a
          // nada. Es el mismo cuidado que ya tenia el agente de la Raspberry con
          // sus procesos ("esVigente" en transmision.js); al visor le faltaba.
          if (this.streamTurno !== miTurno) return;

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
      this.streamClient = cliente;
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
        // Puede venir de aplicarEncuadre, que reabre con la bandera arriba: si
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
      // Con que encuadre viene ESTA transmision. El backend le pega a
      // START_STREAM el encuadre GUARDADO del equipo, asi que es contra esto -y
      // no contra el deslizador- que se calcula el recorte de la vista previa.
      // Sin esta referencia, el video se veria ampliado dos veces.
      this.zoomEnStream = Number(this.savedZoom) || 0;
      this.brilloEnStream = Number(this.savedBrillo) || 0;
      this.centroEnStream = {
        x: Number(this.ajustes?.centro_x ?? 0.5),
        y: Number(this.ajustes?.centro_y ?? 0.5),
      };
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
      // Se retira la vigencia ANTES de cerrar: si el visor moribundo avisa de
      // un fallo de camino, ya no le corresponde a nadie.
      this.streamTurno++;
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
      const giro = (r === 90 || r === 270) ? (4 / 3) : 1;
      const p = this.previewDeZoom();
      const estilo = {
        transform: `rotate(${r}deg) scale(${(giro * p.escala).toFixed(4)}) `
          + `translate(${p.tx.toFixed(2)}%, ${p.ty.toFixed(2)}%)`,
      };
      const b = this.previewDeBrillo();
      if (b !== 1) estilo.filter = `brightness(${b.toFixed(3)})`;
      return estilo;
    },

    // --- Brillo instantaneo --------------------------------------------------
    //
    // Mientras se mueve el deslizador, el video que ya esta llegando se aclara u
    // oscurece en el navegador. Es una APROXIMACION a proposito: el equipo aplica
    // el brillo dentro de la camara (--brightness, que suma luz a la imagen) y el
    // navegador solo puede multiplicar. Sirve para decidir hacia donde ir; el
    // resultado exacto llega al pulsar "Fijar encuadre", cuando la vista se
    // reabre con el valor puesto en la camara.
    //
    // Se calcula contra el brillo con el que SALIO la transmision, no contra
    // cero: si no, al reabrir la vista ya corregida se veria el efecto dos veces.
    previewDeBrillo() {
      if (!this.streaming || !this.esRelay) return 1;
      const deseado = Math.min(1, Math.max(-1, Number(this.ajustes?.brillo ?? 0)));
      const enStream = Math.min(1, Math.max(-1, Number(this.brilloEnStream) || 0));
      const delta = deseado - enStream;
      if (Math.abs(delta) < 0.001) return 1;
      // Un tope de 0.6 a cada lado: mas alla el video se va a blanco o a negro y
      // deja de servir para juzgar nada.
      return Math.min(1.6, Math.max(0.4, 1 + delta * 0.6));
    },

    // --- Zoom instantaneo ----------------------------------------------------
    //
    // Al mover el zoom, el encuadre nuevo se ve AL MOMENTO recortando el video
    // que ya esta llegando, sin esperar al equipo.
    //
    // Antes habia que esperar a que soltara el deslizador (800 ms), que el
    // equipo guardara el valor, cortara la transmision y la volviera a abrir:
    // unos cuatro segundos sin imagen cada vez que se tocaba el zoom. Y el
    // resultado no se veia hasta el final, asi que encuadrar era a ciegas.
    //
    // Un telefono aplica el zoom a la camara en vivo por el canal de datos.
    // La Raspberry no puede: `rpicam-vid` fija el recorte al arrancar. Pero el
    // encuadre se puede ANTICIPAR aqui, porque el recorte es exactamente la
    // region --roi que el equipo va a usar: se muestra esa region ampliada, y
    // cuando llega la transmision nueva la imagen ya esta en su sitio y solo
    // gana nitidez. Sin saltos y sin pantalla en negro.
    //
    // Solo se puede ACERCAR sobre lo que ya se recibe: al alejar, la parte que
    // falta nunca viajo por la red, asi que ahi se mantiene la imagen actual
    // hasta que llegue la nueva -pero tampoco se queda en negro.
    previewDeZoom() {
      const quieto = { escala: 1, tx: 0, ty: 0 };
      if (!this.streaming || !this.esRelay) return quieto;

      const ladoStream = 1 - Math.min(0.9, Math.max(0, Number(this.zoomEnStream) || 0));
      const ladoDeseado = 1 - Math.min(0.9, Math.max(0, Number(this.zoom) || 0));
      if (!(ladoStream > 0) || !(ladoDeseado > 0)) return quieto;

      // Alejar no se puede anticipar: esos pixeles no estan en el video.
      const escala = ladoStream / ladoDeseado;
      if (escala <= 1.001) return quieto;

      // La misma geometria que usa el equipo (argumentosDeAjuste en camara.js):
      // el recorte es un cuadro de lado (1-zoom) centrado en centro_x/centro_y y
      // empujado hacia adentro para no salirse del cuadro.
      const esquina = (centro, lado) => Math.min(1 - lado, Math.max(0, centro - lado / 2));
      const cS = this.centroEnStream || { x: 0.5, y: 0.5 };
      const cD = {
        x: Math.min(1, Math.max(0, Number(this.ajustes?.centro_x ?? 0.5))),
        y: Math.min(1, Math.max(0, Number(this.ajustes?.centro_y ?? 0.5))),
      };
      const xS = esquina(cS.x, ladoStream), yS = esquina(cS.y, ladoStream);
      const xD = esquina(cD.x, ladoDeseado), yD = esquina(cD.y, ladoDeseado);

      // Centro del recorte deseado, en coordenadas del video que se esta viendo.
      const cx = (xD + ladoDeseado / 2 - xS) / ladoStream;
      const cy = (yD + ladoDeseado / 2 - yS) / ladoStream;

      // CORRECCION POR LAS BARRAS NEGRAS.
      //
      // Un translate en porcentaje se mide contra el ELEMENTO, no contra la
      // imagen. Y con `object-contain` no son lo mismo: el video llega en 16:9 y
      // el recuadro es 4:3, asi que la imagen ocupa solo el 75% del alto y
      // arriba y abajo hay negro.
      //
      // Sin esto, el desplazamiento vertical salia un tercio pasado y el zoom
      // se iba de sitio en cuanto el recorte no estaba centrado -que es
      // exactamente lo que tiene la Raspberry (centro 0.2, 0.05).
      const f = this._factorDeContenido();

      // Se corre ese punto al centro del recuadro ANTES de ampliar (las
      // transformaciones de CSS se aplican de derecha a izquierda).
      return { escala, tx: (0.5 - cx) * 100 * f.x, ty: (0.5 - cy) * 100 * f.y };
    },

    /**
     * Que fraccion del elemento ocupa de verdad la imagen, a lo ancho y a lo
     * alto. Con `object-contain` una de las dos es 1 y la otra es menor.
     *
     * Se mide del propio elemento, que es la unica fuente que no miente: da
     * igual que el equipo cambie de resolucion o que el recuadro cambie de
     * proporcion en otra pantalla.
     */
    _factorDeContenido() {
      const v = document.getElementById('liveVideo');
      const vw = v?.videoWidth || 0, vh = v?.videoHeight || 0;
      const cw = v?.clientWidth || 0, ch = v?.clientHeight || 0;
      if (!vw || !vh || !cw || !ch) return { x: 1, y: 1 };
      const k = Math.min(cw / vw, ch / vh);   // asi encaja object-contain
      return { x: (vw * k) / cw, y: (vh * k) / ch };
    },
    // Rotacion del video en el visor (CSS simple; el frame ya llega 4:3 correcto).
    // Es temporal por navegador; al recargar vuelve a la orientacion fija (savedRotation).
    // Girar en los DOS sentidos. Antes solo se podia a la derecha, asi que para
    // corregir 90 grados de mas habia que dar tres vueltas.
    rotate(sentido = 1) {
      const paso = sentido < 0 ? -90 : 90;
      this.rotation = (((this.rotation + paso) % 360) + 360) % 360;
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
    // Hay algo sin guardar. Incluye el centro del recorte: antes solo miraba
    // lente y zoom, asi que mover el recorte de lado dejaba el boton en gris y
    // no habia forma de aplicarlo.
    encuadreCambiado() {
      return this.lens !== this.savedLens
        || Math.abs(Number(this.zoom) - this.savedZoom) > 0.001
        || Math.abs(Number(this.ajustes.centro_x ?? 0.5) - this.savedCentro.x) > 0.001
        || Math.abs(Number(this.ajustes.centro_y ?? 0.5) - this.savedCentro.y) > 0.001
        || Math.abs(Number(this.ajustes.brillo ?? 0) - this.savedBrillo) > 0.001;
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
