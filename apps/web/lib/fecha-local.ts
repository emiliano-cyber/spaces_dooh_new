// «Hoy» (o la fecha que se pase) en la hora del NAVEGADOR, como AAAA-MM-DD,
// para los campos <input type="date">. NO `toISOString().slice(0, 10)`: eso da
// el día en UTC, y en México a partir de las 18:00 ya es mañana.
export function fechaLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
