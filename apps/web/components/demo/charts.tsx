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

// Gráficas de la demo con los tokens de color de SET. Planas, sin sombras.

const INFO = '#0a66ff'
const AMBAR = '#f59e0b'
const VERDE = '#10b981'
const BORDER = '#e4e4e7'
const MUTED = '#71717a'

const ejeTick = { fontSize: 11, fill: MUTED }

function TooltipBox({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-1.5 text-[12px] shadow-none">
      <div className="text-muted">{label}</div>
      <div className="demo-num font-medium text-ink">
        {Math.round(payload[0].value)}
        {suffix}
      </div>
    </div>
  )
}

export function OcupacionChart({ puntos }: { puntos: PuntoOcupacion[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
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
  const data = [
    { name: 'Tentativas', valor: tentativo, color: AMBAR },
    { name: 'Confirmadas', valor: confirmado, color: VERDE },
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
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
        />
        <Tooltip content={<TooltipBox suffix="" />} cursor={{ fill: '#0000000a' }} />
        <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
