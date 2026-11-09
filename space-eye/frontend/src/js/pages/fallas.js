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
    // Avisos por correo (migracion 031). Solo un admin los cambia; los demas
    // los ven para saber si estan encendidos y a quien le llegan.
    avisos: null,
    puedeAvisos: false,
    editandoAvisos: false,
    editandoCuenta: false,
    guardandoAvisos: false,
    // La llave nunca llega del servidor (solo sus ultimos cuatro), asi que vive
    // aparte: en blanco significa "no la toques".
    llaveNueva: '',
    avisosMsg: '',
    avisosErrorMsg: false,

    async init() {
      try {
        const rol = JSON.parse(localStorage.getItem('user') || '{}').role;
        this.puedeCerrar = rol === 'admin' || rol === 'operator';
        this.puedeAvisos = rol === 'admin';
      } catch (_) {}
      // Si la base aun no tiene la migracion 031, la caja no se pinta y el
      // resto de la pagina sigue funcionando igual.
      try { this.avisos = await API.get('/api/avisos'); } catch (_) {}
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

    // --- Avisos por correo ---

    resumenAvisos() {
      const a = this.avisos;
      if (!a) return '';
      if (!a.activo) return ' · apagados';
      const n = (a.destinatarios || '').split(',').filter((d) => d.trim()).length;
      if (!n) return ' · encendidos, pero sin ningún correo';
      const quien = n === 1 ? a.destinatarios.trim() : n + ' correos';
      return ' · a ' + quien + ', agrupados cada ' + a.agrupar_min + ' min';
    },

    resumenCuenta() {
      const a = this.avisos;
      if (!a) return '';
      if (!a.hay_llave) return 'Sin cuenta: no sale ningún correo.';
      const de = a.remitente ? 'Sale de ' + a.remitente : 'Sin remitente';
      return a.cuenta_del_panel
        ? de + ', con la llave ' + a.llave_pista + '.'
        : de + ' — viene del entorno del contenedor, no de aquí. Si la escribes aquí, manda esta.';
    },

    async quitarLlave() {
      const ok = await window.confirmar({
        titulo: 'Quitar la llave de correo',
        mensaje: 'Sin llave no sale ningún aviso: quedan escritos en el registro del servidor.',
        detalle: 'Se puede volver a poner cuando sea.',
        textoBoton: 'Quitar',
        peligro: true,
      });
      if (!ok) return;
      this.llaveNueva = '';
      await this.guardarAvisos({ borrar_llave: true });
    },

    async guardarAvisos(extra) {
      this.guardandoAvisos = true;
      this.avisosMsg = '';
      this.avisosErrorMsg = false;
      try {
        const r = await API.put('/api/avisos', {
          activo: !!this.avisos.activo,
          destinatarios: this.avisos.destinatarios || '',
          agrupar_min: Number(this.avisos.agrupar_min) || 15,
          remitente: this.avisos.remitente || '',
          llave: this.llaveNueva || '',
          ...(extra || {}),
        });
        // El servidor devuelve la lista ya limpia: se refleja para que nadie
        // crea que guardo un correo mal escrito que se descarto en silencio.
        this.avisos.destinatarios = r.destinatarios;
        this.avisos.llave_pista = r.llave_pista;
        this.avisos.remitente = r.remitente;
        this.avisos.hay_llave = r.hay_llave;
        this.avisos.cuenta_del_panel = r.cuenta_del_panel;
        // Se olvida en cuanto se guardo: no se queda escrita en la pagina.
        this.llaveNueva = '';
        this.avisos.ultimo_error = null;
        this.avisosMsg = 'Guardado.';
      } catch (err) {
        this.avisosErrorMsg = true;
        const cual = err?.body?.error;
        this.avisosMsg = cual === 'sin_destinatarios' ? 'Para encenderlos hace falta al menos un correo válido.'
          : cual === 'remitente_invalido' ? 'El remitente tiene que ser un correo, o «Nombre <correo@dominio>».'
          : cual === 'llave_invalida' ? 'Esa no parece una llave: va completa, sin espacios.'
          : 'No se pudo guardar.';
      }
      this.guardandoAvisos = false;
    },

    async probarAvisos() {
      // Se guarda primero: la prueba la manda el SERVIDOR a la lista guardada,
      // asi que probar sin guardar mandaria el correo a la direccion vieja y el
      // que acaba de teclear su correo no recibiria nada.
      await this.guardarAvisos();
      if (this.avisosErrorMsg) return;
      this.guardandoAvisos = true;
      this.avisosMsg = '';
      this.avisosErrorMsg = false;
      try {
        const r = await API.post('/api/avisos/prueba', {});
        this.avisosMsg = r.salida === 'registrado'
          ? 'Sin llave de correo: quedó escrito en el registro del servidor.'
          : 'Correo de prueba mandado a ' + r.para.join(', ') + '.';
        this.avisos.ultimo_error = null;
      } catch (err) {
        this.avisosErrorMsg = true;
        this.avisosMsg = err?.body?.detalle || 'No salió el correo de prueba.';
      }
      this.guardandoAvisos = false;
    },

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
