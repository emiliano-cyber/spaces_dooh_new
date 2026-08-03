// frontend/src/js/pages/scheduler.js
requireAuth();

// Lo que pesa una foto en promedio, para estimar el consumo antes de crear la
// programacion. Medido sobre las 91 fotos que ya subieron los equipos: 1.52 MB
// de promedio, 3.7 MB la mas pesada.
const MB_POR_FOTO = 1.5;

function schedulerPage() {
  return {
    schedules: [],
    equipos: [],
    campanas: [],
    mostrarForm: false,
    guardando: false,
    form: formVacio(),

    async init() {
      await Promise.all([this.cargar(), this.cargarCatalogos()]);
    },

    async cargar() {
      try {
        const data = await API.get('/api/schedules');
        this.schedules = data.schedules || [];
      } catch (err) {
        toast('No se pudieron cargar las programaciones', 'error');
      }
    },

    async cargarCatalogos() {
      // Si falla un catalogo, el formulario sigue sirviendo para el resto.
      try { this.equipos = (await API.get('/api/devices')).devices || []; } catch { this.equipos = []; }
      try { this.campanas = (await API.get('/api/campaigns')).campaigns || []; } catch { this.campanas = []; }
    },

    // --- Formulario ---------------------------------------------------------

    abrirNueva() {
      this.form = formVacio();
      this.mostrarForm = true;
    },

    editar(s) {
      this.form = {
        id: s.id,
        name: s.name || '',
        destino: s.device_id ? 'device' : (s.campaign_id ? 'campaign' : 'todos'),
        device_id: s.device_id || null,
        group_id: s.group_id || null,
        campaign_id: s.campaign_id || null,
        frequency_type: s.frequency_type || 'random_windows',
        interval_minutes: s.interval_minutes || 60,
        specific_times: comoLista(s.specific_times, ['12:00']),
        windows: comoLista(s.windows, [{ ini: '08:00', fin: '10:00' }]),
        valid_from: soloFecha(s.valid_from),
        valid_until: soloFecha(s.valid_until),
      };
      this.mostrarForm = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async guardar() {
      const f = this.form;

      if (!f.name.trim()) return toast('Ponle un nombre a la programacion', 'error');
      if (f.destino === 'device' && !f.device_id) return toast('Elige el equipo', 'error');
      if (f.destino === 'campaign' && !f.campaign_id) return toast('Elige la campana', 'error');

      if (f.frequency_type === 'random_windows') {
        if (!f.windows.length) return toast('Agrega al menos una franja de horario', 'error');
        const mala = f.windows.find(v => !v.ini || !v.fin || v.ini === v.fin);
        if (mala) return toast('Hay una franja sin horas o con la misma hora de inicio y fin', 'error');
      }
      if (f.frequency_type === 'specific_times' && !f.specific_times.filter(Boolean).length) {
        return toast('Agrega al menos una hora', 'error');
      }
      if (f.frequency_type === 'interval' && (!f.interval_minutes || f.interval_minutes < 5)) {
        return toast('El intervalo minimo es de 5 minutos', 'error');
      }

      const cuerpo = {
        name: f.name.trim(),
        frequency_type: f.frequency_type,
        device_id: f.destino === 'device' ? f.device_id : null,
        campaign_id: f.destino === 'campaign' ? f.campaign_id : null,
        group_id: null,
        valid_from: f.valid_from || null,
        valid_until: f.valid_until || null,
      };
      if (f.frequency_type === 'random_windows') cuerpo.windows = f.windows;
      if (f.frequency_type === 'specific_times') cuerpo.specific_times = f.specific_times.filter(Boolean);
      if (f.frequency_type === 'interval') cuerpo.interval_minutes = f.interval_minutes;

      this.guardando = true;
      try {
        if (f.id) {
          await API.put(`/api/schedules/${f.id}`, cuerpo);
          toast('Programacion actualizada', 'success');
        } else {
          await API.post('/api/schedules', cuerpo);
          toast('Programacion creada', 'success');
        }
        this.mostrarForm = false;
        await this.cargar();
      } catch (err) {
        toast(mensajeDeError(err), 'error');
      } finally {
        this.guardando = false;
      }
    },

    async alternar(s) {
      try {
        await API.put(`/api/schedules/${s.id}`, { active: !s.active });
        await this.cargar();
      } catch {
        toast('No se pudo cambiar el estado', 'error');
      }
    },

    async eliminar(s) {
      const ok = await confirmarEscribiendo({
        titulo: 'Eliminar programacion',
        mensaje: `Se eliminara "${s.name}"`,
        detalle: 'Las fotos que ya se tomaron se conservan; lo que se pierde es la programacion futura.',
        palabra: 'ELIMINAR',
      });
      if (!ok) return;
      try {
        await API.delete(`/api/schedules/${s.id}`);
        toast('Programacion eliminada', 'success');
        await this.cargar();
      } catch {
        toast('No se pudo eliminar', 'error');
      }
    },

    // --- Textos de la tabla -------------------------------------------------

    destinoTexto(s) {
      if (s.device_name) return s.device_name;
      if (s.campaign_name) return `Campana: ${s.campaign_name}`;
      if (s.group_name) return `Grupo: ${s.group_name}`;
      return 'Todos los equipos';
    },

    cuandoTexto(s) {
      if (s.frequency_type === 'random_windows') {
        const v = comoLista(s.windows, []);
        if (!v.length) return 'Sin franjas';
        return v.map(x => `${x.ini}-${x.fin}`).join(', ') + ' (al azar)';
      }
      if (s.frequency_type === 'specific_times') {
        return comoLista(s.specific_times, []).join(', ');
      }
      if (s.frequency_type === 'interval') {
        const m = s.interval_minutes;
        return m >= 60 && m % 60 === 0 ? `Cada ${m / 60} h` : `Cada ${m} min`;
      }
      return s.cron_expression || s.frequency_type;
    },

    proximaTexto(s) {
      if (!s.active) return '—';
      if (!s.next_fire_at) return 'Sin calcular';
      const d = new Date(s.next_fire_at);
      const faltan = d.getTime() - Date.now();
      const fecha = d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      if (faltan < 0) return `${fecha} (en cola)`;
      const horas = Math.floor(faltan / 3600000);
      if (horas < 1) return `${fecha} (en ${Math.max(1, Math.round(faltan / 60000))} min)`;
      if (horas < 24) return `${fecha} (en ${horas} h)`;
      return fecha;
    },

    // --- Estimacion de consumo ---------------------------------------------
    // El costo de datos moviles es la razon por la que esto se configura con
    // cuidado, asi que se muestra ANTES de guardar, no despues de la factura.

    fotosPorDia() {
      const f = this.form;
      if (f.frequency_type === 'random_windows') return f.windows.length;
      if (f.frequency_type === 'specific_times') return f.specific_times.filter(Boolean).length;
      if (f.frequency_type === 'interval') return f.interval_minutes > 0 ? 1440 / f.interval_minutes : 0;
      return 0;
    },

    fotosPorDiaTexto() {
      const n = this.fotosPorDia();
      if (!n) return 'sin fotos';
      const r = Math.round(n * 10) / 10;
      return `${r} ${r === 1 ? 'foto' : 'fotos'} al dia`;
    },

    consumoMesTexto() {
      const mb = this.fotosPorDia() * 30 * MB_POR_FOTO;
      if (!mb) return '—';
      return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB al mes` : `${Math.round(mb)} MB al mes`;
    },
  };
}

function formVacio() {
  return {
    id: null,
    name: '',
    destino: 'todos',
    device_id: null,
    group_id: null,
    campaign_id: null,
    frequency_type: 'random_windows',
    interval_minutes: 60,
    specific_times: ['12:00'],
    windows: [{ ini: '08:00', fin: '10:00' }, { ini: '13:00', fin: '15:00' }, { ini: '18:00', fin: '20:00' }],
    valid_from: '',
    valid_until: '',
  };
}

/** Los campos JSON pueden llegar como texto o ya parseados. */
function comoLista(valor, porDefecto) {
  if (!valor) return porDefecto;
  if (Array.isArray(valor)) return valor.length ? valor : porDefecto;
  try {
    const p = JSON.parse(valor);
    return Array.isArray(p) && p.length ? p : porDefecto;
  } catch {
    return porDefecto;
  }
}

/** Los DATE llegan como ISO completo y el <input type="date"> solo acepta YYYY-MM-DD. */
function soloFecha(v) {
  return v ? String(v).slice(0, 10) : '';
}

function mensajeDeError(err) {
  const clave = err && err.body && err.body.error;
  const textos = {
    faltan_franjas: 'Revisa las franjas: alguna tiene una hora invalida',
    faltan_horas: 'Agrega al menos una hora',
    falta_intervalo: 'Falta el intervalo en minutos',
    falta_cron: 'Falta la expresion de programacion',
    invalid_input: 'Hay un dato invalido en el formulario',
  };
  return textos[clave] || 'No se pudo guardar la programacion';
}
