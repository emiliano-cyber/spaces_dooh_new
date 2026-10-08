// frontend/src/js/pages/fallas.js
// Fallas de pantalla de toda la flota: lo que cada equipo detecto al revisar su
// pantalla, con su evidencia y su historial.
requireAuth();

function fallasPage() {
  return {
    fallas: [],
    // Cuantas hay de cada estado en TOTAL (las cuenta el servidor): la lista
    // trae como mucho 500 y los indicadores no pueden contar solo esas.
    cuentas: null,
    devices: [],
    estado: '',
    deviceId: '',
    cargado: false,
    verFoto: null,
    puedeCerrar: false,

    async init() {
      try {
        const rol = JSON.parse(localStorage.getItem('user') || '{}').role;
        this.puedeCerrar = rol === 'admin' || rol === 'operator';
      } catch (_) {}
      const params = new URLSearchParams(location.search);
      this.estado = params.get('estado') || '';
      this.deviceId = params.get('device_id') || '';
      try { this.devices = (await API.get('/api/devices')).devices || []; } catch (_) {}
      await this.load();

      // Se actualiza solo cuando un equipo abre o cierra una falla.
      dashboardSocket.connect();
      dashboardSocket.on('pantalla:falla', () => { this.load(); window.contarFallas?.(); });
    },

    async load() {
      const q = new URLSearchParams();
      // Se traen todas: el filtro de estado es solo de la tabla, y los
      // indicadores de arriba tienen que contar siempre el total.
      if (this.deviceId) q.set('device_id', this.deviceId);
      q.set('limit', '500');
      try {
        const r = await API.get('/api/fallas?' + q.toString());
        this.fallas = r.fallas || [];
        this.cuentas = r.cuentas || null;
      } catch (err) {
        console.error('Failed to load fallas:', err);
      }
      this.cargado = true;
    },

    abiertas() { return this.fallas.filter((f) => f.estado === 'abierta'); },
    lista() { return this.estado ? this.fallas.filter((f) => f.estado === this.estado) : this.fallas; },
    cuenta(estado) {
      if (this.cuentas && this.cuentas[estado] != null) return this.cuentas[estado];
      return this.fallas.filter((f) => f.estado === estado).length;
    },

    fecha(v) { return v ? new Date(v).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'; },

    async cerrar(f, estado) {
      const descartar = estado === 'descartada';
      // Con `prompt()` la ventana la pintaba el NAVEGADOR, y Chrome la encabeza
      // con la direccion del servidor —«159.203.188.58:4100 dice»—: al operador
      // se le ensenaba una IP con un puerto justo cuando se le preguntaba algo.
      // Ahora es el dialogo de la casa, con las mismas formas que el resto.
      const nota = await window.pedirTexto({
        titulo: descartar ? 'No es una falla' : 'Marcar como arreglada',
        mensaje: descartar
          ? 'El equipo no volverá a avisar de esta zona durante 7 días.'
          : 'Se cierra sin esperar a que el equipo lo compruebe en su próxima foto.',
        etiqueta: 'Qué se hizo',
        marcador: descartar ? 'Por ejemplo: es un reflejo del sol' : 'Por ejemplo: se cambió la fuente',
        textoBoton: descartar ? 'Descartar' : 'Marcar arreglada',
      });
      if (nota === null) return;
      try {
        await API.put(`/api/fallas/${f.id}`, { estado, nota: nota || undefined });
        await this.load();
        window.contarFallas?.();
        window.toast?.(descartar ? 'Falla descartada' : 'Falla marcada como arreglada', 'success');
      } catch (err) {
        window.toast?.('No se pudo cerrar: ' + (err.message || err), 'error');
      }
    },
  };
}
