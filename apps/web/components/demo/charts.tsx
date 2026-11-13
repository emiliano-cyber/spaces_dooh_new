'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import type { PuntoOcupacion } from '@/lib/data/client'
import { formatMonto, formatMontoCorto } from '@/lib/data/derive'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'

// Gráficas de la demo con los tokens de color de SET. Planas, sin sombras.

const INFO = '#0a66ff'
const AMBAR = '#f59e0b'
const VERDE = '#10b981'
const BORDER = '#e4e4e7'
const MUTED = '#71717a'

const ejeTick = { fontSize: 11, fill: MUTED }

// `formato` decide cómo se lee la cifra. Sin él, número redondeado con coma de
// miles. Antes pintaba `Math.round(valor)` crudo, y en la gráfica de dinero de
// Inicio salía «212500», sin $ ni coma (estándar del 08/10).
function TooltipBox({ active, payload, label, suffix, formato }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-none">
      <div className="text-muted">{label}</div>
      <div className="demo-num font-medium text-ink">
        {formato ? formato(payload[0].value) : formatNumero(Math.round(payload[0].value))}
        {suffix}
      </div>
    </div>
  )
}

// `alto="100%"` (DASH-ALINEADO, 13/11): la gráfica llena la tarjeta cuando la
// vecina de la fila es más alta, en vez de dejar un blanco debajo. Quien la usa
// así la pone en un contenedor con altura propia (`absolute inset-0`): si el
// alto saliera del contenido, la gráfica y su caja se empujarían una a otra.
export function OcupacionChart({ puntos, alto = 180 }: { puntos: PuntoOcupacion[]; alto?: number | '100%' }) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <AreaChart data={puntos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={INFO} stopOpacity={0.18} />
            <stop offset="100%" stopColor={INFO} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={BORDER} vertical={false} />
        <XAxis dataKey="label" tick={ejeTick} tickLine={false} axisLine={{ stroke: BORDER }} />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 50, 100]}
          tick={ejeTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip content={<TooltipBox suffix="%" />} cursor={{ stroke: BORDER }} />
        <Area
          type="monotone"
          dataKey="pct"
          stroke={INFO}
          strokeWidth={2}
          fill="url(#occ)"
          dot={false}
          activeDot={{ r: 3, fill: INFO }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function ReservasChart({
  tentativo,
  confirmado,
}: {
  tentativo: number
  confirmado: number
}) {
  // I18N (2026-11-02) · los rotulos de las barras y el dinero, en el idioma
  // de la pantalla. Hoy ninguna pagina monta esta grafica (el Dashboard la
  // sustituyo por el pipeline); se deja lista por si vuelve.
  const { t, idioma } = useIdioma()
  const data = [
    { name: t('inicio.grafica.tentativas'), valor: tentativo, color: AMBAR },
    { name: t('inicio.grafica.confirmadas'), valor: confirmado, color: VERDE },
  ]
  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={28}>
        <CartesianGrid stroke={BORDER} vertical={false} />
        <XAxis dataKey="name" tick={ejeTick} tickLine={false} axisLine={{ stroke: BORDER }} />
        <YAxis
          tick={ejeTick}
          tickLine={false}
          axisLine={false}
          // Dinero compacto con su coma: «$ 2,500k» salía como «2500k».
          tickFormatter={(v) => formatMontoCorto(v, idioma)}
        />
        <Tooltip content={<TooltipBox suffix="" formato={(n: number) => formatMonto(n, idioma)} />} cursor={{ fill: '#0000000a' }} />
        <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
