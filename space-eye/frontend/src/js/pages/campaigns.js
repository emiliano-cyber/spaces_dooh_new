// frontend/src/js/pages/campaigns.js
requireAuth();

function campaignsPage() {
  return {
    campaigns: [],
    equipos: [],
    mostrarForm: false,
    guardando: false,
    form: formVacio(),
    // La imagen elegida todavia no subida, y su vista previa.
    archivoNuevo: null,
    vistaPrevia: '',
    creativoActual: '',

    async init() {
      await Promise.all([this.cargar(), this.cargarEquipos()]);
    },

    async cargar() {
      try {
        this.campaigns = (await API.get('/api/campaigns')).campaigns || [];
      } catch {
        toast('No se pudieron cargar las campañas', 'error');
      }
    },

    async cargarEquipos() {
      try { this.equipos = (await API.get('/api/devices')).devices || []; } catch { this.equipos = []; }
    },

    // --- Formulario ---------------------------------------------------------

    abrirNueva() {
      this.form = formVacio();
      this.archivoNuevo = null;
      this.vistaPrevia = '';
      this.creativoActual = '';
      this.mostrarForm = true;
    },

    async editar(c) {
      this.form = {
        id: c.id,
        name: c.name || '',
        advertiser: c.advertiser || '',
        start_date: soloFecha(c.start_date),
        end_date: soloFecha(c.end_date),
        verification_enabled: !!c.verification_enabled,
        device_ids: [],
      };
      this.archivoNuevo = null;
      this.creativoActual = c.creative_path || '';
      this.vistaPrevia = c.creative_path || '';
      this.mostrarForm = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Los equipos asignados vienen en el detalle, no en la lista.
      try {
        const d = await API.get(`/api/campaigns/${c.id}`);
        this.form.device_ids = (d.devices || []).map((x) => x.id);
      } catch { /* se queda vacio; al guardar se puede volver a elegir */ }
    },

    alternarEquipo(id) {
      const i = this.form.device_ids.indexOf(id);
      if (i >= 0) this.form.device_ids.splice(i, 1);
      else this.form.device_ids.push(id);
    },

    elegirArchivo(evt) {
      const f = evt.target.files && evt.target.files[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) {
        toast('La imagen pesa más de 20 MB', 'error');
        return;
      }
      this.archivoNuevo = f;
      // Vista previa local: no se sube nada hasta pulsar Guardar.
      const lector = new FileReader();
      lector.onload = (e) => { this.vistaPrevia = e.target.result; };
      lector.readAsDataURL(f);
    },

    async guardar() {
      const f = this.form;
      if (!f.name.trim()) return toast('Ponle un nombre a la campaña', 'error');
      if (!f.start_date || !f.end_date) return toast('Faltan las fechas de la campaña', 'error');
      if (f.end_date < f.start_date) return toast('La fecha de fin es anterior a la de inicio', 'error');

      this.guardando = true;
      try {
        const cuerpo = {
          name: f.name.trim(),
          advertiser: f.advertiser.trim() || null,
          start_date: f.start_date,
          end_date: f.end_date,
          verification_enabled: !!f.verification_enabled,
          device_ids: f.device_ids,
        };

        const id = f.id
          ? (await API.put(`/api/campaigns/${f.id}`, cuerpo), f.id)
          : (await API.post('/api/campaigns', cuerpo)).campaign_id;

        // La imagen va aparte: es un archivo, no cabe en el JSON.
        if (this.archivoNuevo) {
          await this._subirCreatividad(id, this.archivoNuevo);
        }

        toast(f.id ? 'Campaña actualizada' : 'Campaña creada', 'success');
        this.mostrarForm = false;
        await this.cargar();
      } catch (err) {
        toast(mensajeDeError(err), 'error');
      } finally {
        this.guardando = false;
      }
    },

    // Subida con FormData: API.post manda JSON, asi que aqui se usa fetch
    // directo con el token, igual que hace la subida de fotos.
    async _subirCreatividad(campaignId, archivo) {
      const fd = new FormData();
      fd.append('creative', archivo);
      const res = await fetch(`${window.location.origin}/api/campaigns/${campaignId}/creative`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        body: fd,
      });
      if (!res.ok) {
        const e = new Error('upload_failed');
        e.status = res.status;
        try { e.body = await res.json(); } catch (_) {}
        throw e;
      }
    },

    periodo(c) {
      const f = (v) => (v ? String(v).slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '—');
      return `${f(c.start_date)} – ${f(c.end_date)}`;
    },
  };
}

function formVacio() {
  return {
    id: null,
    name: '',
    advertiser: '',
    start_date: '',
    end_date: '',
    verification_enabled: false,
    device_ids: [],
  };
}

/** Los DATE llegan como ISO completo y el <input type="date"> solo acepta YYYY-MM-DD. */
function soloFecha(v) {
  return v ? String(v).slice(0, 10) : '';
}

function mensajeDeError(err) {
  const clave = err && err.body && err.body.error;
  const textos = {
    sin_archivo: 'No se recibió la imagen',
    not_found: 'La campaña ya no existe',
    invalid_input: 'Hay un dato inválido en el formulario',
    forbidden: 'No tienes permiso para esto',
  };
  if (err && err.status === 403) return 'No tienes permiso para esto';
  return textos[clave] || 'No se pudo guardar la campaña';
}
