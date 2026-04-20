/**
 * Date/time utilities shared across API and web packages.
 */

/** Days remaining until a future date (negative = already passed) */
export function diasHasta(fecha: Date | string): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000)
}

/** Add N days to a date */
export function addDays(date: Date | string, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Format a date as 'DD MMM YYYY' in Spanish (e.g. '15 ene 2026') */
export function formatDateEs(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Return true if two date ranges overlap */
export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)
}

/** Format duration as human-readable string (e.g. '3 días', '2 semanas') */
export function formatDuration(days: number): string {
  if (days === 0) return 'hoy'
  if (days < 0) return `hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`
  if (days < 7) return `${days} día${days !== 1 ? 's' : ''}`
  if (days < 30) {
    const weeks = Math.round(days / 7)
    return `${weeks} semana${weeks !== 1 ? 's' : ''}`
  }
  const months = Math.round(days / 30)
  return `${months} mes${months !== 1 ? 'es' : ''}`
}

/** Return the ISO week number (1-53) for a given date */
export function isoWeek(date: Date | string): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return (
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  )
}
