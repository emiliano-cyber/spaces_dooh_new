import type { PrismaClient } from '@prisma/client'

type Nivel = 'critico' | 'alerta' | 'aviso'

function calcNivel(diasRestantes: number): Nivel {
  if (diasRestantes < 7) return 'critico'
  if (diasRestantes <= 15) return 'alerta'
  return 'aviso'
}

function diasHasta(fecha: Date): number {
  return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86_400_000)
}

export async function getAlertasVencimiento(prisma: PrismaClient, diasUmbral = 30) {
  const ahora = new Date()
  const limite = new Date(ahora.getTime() + diasUmbral * 24 * 60 * 60 * 1000)

  const [contratos, licencias, pagos] = await Promise.all([
    (prisma as any).contratoArrendamiento.findMany({
      where: {
        estatus: 'VIGENTE',
        fechaFin: { lte: limite },
      },
      include: { sitio: { select: { id: true, nombre: true, claveInterna: true } }, arrendador: true },
      orderBy: { fechaFin: 'asc' },
    }),
    (prisma as any).licenciaPermiso.findMany({
      where: {
        fechaVencimiento: { lte: limite },
        estatus: 'VIGENTE',
      },
      include: { sitio: { select: { id: true, nombre: true, claveInterna: true } } },
      orderBy: { fechaVencimiento: 'asc' },
    }),
    (prisma as any).pagoRenta.findMany({
      where: { estatus: 'PENDIENTE' },
      include: {
        contrato: {
          include: { sitio: { select: { id: true, nombre: true, claveInterna: true } } },
        },
      },
      orderBy: { creadoEn: 'asc' },
    }),
  ])

  // Pagos vencidos: periodo en formato YYYY-MM que ya pasó
  const pagosPendientesVencidos = pagos.filter((p: any) => {
    if (!p.periodo) return false
    const match = String(p.periodo).match(/^(\d{4})-(\d{2})$/)
    if (!match) return false
    const periodoFin = new Date(Number(match[1]), Number(match[2]), 1) // primer día del mes siguiente
    return periodoFin < ahora
  })

  return {
    contratos: contratos.map((c: any) => {
      const diasRestantes = diasHasta(c.fechaFin)
      return { ...c, diasRestantes, nivel: calcNivel(diasRestantes) }
    }),
    licencias: licencias.map((l: any) => {
      const diasRestantes = diasHasta(l.fechaVencimiento)
      return { ...l, diasRestantes, nivel: calcNivel(diasRestantes) }
    }),
    pagos: pagosPendientesVencidos.map((p: any) => {
      const diasRestantes = 0
      return { ...p, diasRestantes, nivel: calcNivel(diasRestantes) }
    }),
  }
}
