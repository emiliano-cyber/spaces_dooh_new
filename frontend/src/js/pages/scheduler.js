// frontend/src/js/pages/scheduler.js
requireAuth();

function schedulerPage() {
  return {
    schedules: [],
    showForm: false,
    form: {
      name: '',
      frequency_type: 'interval',
      interval_minutes: 30,
      cron_expression: '',
      specific_times_input: '',
      device_id: null,
    },

    async init() {
      await this.loadSchedules();
    },

    async loadSchedules() {
      try {
        const data = await API.get('/api/schedules');
        this.schedules = data.schedules;
      } catch (err) {
        console.error('Failed to load schedules:', err);
      }
    },

    async createSchedule() {
      try {
        const body = {
          name: this.form.name,
          frequency_type: this.form.frequency_type,
        };
        if (this.form.frequency_type === 'interval') {
          body.interval_minutes = this.form.interval_minutes;
        } else if (this.form.frequency_type === 'cron') {
          body.cron_expression = this.form.cron_expression;
        } else if (this.form.frequency_type === 'specific_times') {
          body.specific_times = this.form.specific_times_input.split(',').map(s => s.trim());
        }
        if (this.form.device_id) body.device_id = this.form.device_id;

        await API.post('/api/schedules', body);
        this.showForm = false;
        await this.loadSchedules();
      } catch (err) {
        alert('Error al crear schedule');
      }
    },

    async toggleSchedule(schedule) {
      try {
        await API.put(`/api/schedules/${schedule.id}`, { active: !schedule.active });
        await this.loadSchedules();
      } catch (err) {
        alert('Error al actualizar schedule');
      }
    },

    async deleteSchedule(id) {
      if (!confirm('Eliminar este schedule?')) return;
      try {
        await API.delete(`/api/schedules/${id}`);
        await this.loadSchedules();
      } catch (err) {
        alert('Error al eliminar schedule');
      }
    },
  };
}
