// Helper para agrupar elementos (fotos, comentarios, etc.) por día en zona local.
// Se usa para mostrar "Hoy / Ayer / 5 de mayo" como encabezados.

export function dayKey(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function dayLabel(key: string): string {
  const [yyyy, mm, dd] = key.split('-').map(Number)
  const d = new Date(yyyy, mm - 1, dd)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff > 0 && diff < 7) return d.toLocaleDateString('es-MX', { weekday: 'long' })
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function groupByDay<T>(items: T[], getDate: (item: T) => string | Date | null | undefined): { key: string; label: string; items: T[] }[] {
  const map = new Map<string, T[]>()
  for (const it of items) {
    const raw = getDate(it)
    if (!raw) continue
    const date = raw instanceof Date ? raw : new Date(raw)
    if (isNaN(date.getTime())) continue
    const key = dayKey(date)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({ key, label: dayLabel(key), items }))
}
