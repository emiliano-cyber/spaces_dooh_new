'use client'

import { useState } from 'react'
import { CheckCircle2, Users, ShieldCheck } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { ROLES, rolLabel } from '@/components/demo/shell/nav'
import { cn } from '@/lib/cn'
import {
  useUsuarios,
  useUsuario,
  useCambiarRolUsuario,
  type RolDemo,
} from '@/lib/data/client'

export default function AdministracionPage() {
  const usuarios = useUsuarios()
  const actual = useUsuario()
  const cambiarRol = useCambiarRolUsuario()
  const [toast, setToast] = useState<string | null>(null)

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl text-ink">Administración</h1>
        <p className="mt-1 text-[13px] text-muted">Usuarios y roles</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Users className="h-4 w-4 text-muted" />
          <CardTitle>Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {!usuarios ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">Usuario</th>
                    <th className="px-4 py-2 font-medium">Cargo</th>
                    <th className="px-4 py-2 font-medium">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const esActual = actual?.id === u.id
                    return (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-ink">{u.nombre}</span>
                            {esActual && (
                              <span className="rounded-full border border-accent/50 bg-[#f59e0b1a] px-1.5 py-0.5 text-[10px] font-medium text-[#9a6700]">
                                tú
                              </span>
                            )}
                          </div>
                          <div className="demo-num text-[11px] text-muted">{u.email}</div>
                        </td>
                        <td className="px-4 py-2.5 text-muted">{u.cargo}</td>
                        <td className="px-4 py-2.5">
                          {esActual ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-ink">
                              <ShieldCheck className="h-3.5 w-3.5 text-muted" />
                              {rolLabel(u.rol)}
                            </span>
                          ) : (
                            <select
                              value={u.rol}
                              onChange={(e) => {
                                cambiarRol(u.id, e.target.value as RolDemo)
                                notify(`${u.nombre}: rol cambiado a ${rolLabel(e.target.value as RolDemo)}`)
                              }}
                              className="h-8 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-[12px] text-muted">
        Cambiar el rol de un usuario ajusta al instante lo que verá al iniciar sesión: el menú
        lateral y las columnas que su rol no debe ver no se renderizan. (Tu propio rol no se edita
        aquí para evitar bloquearte el acceso.)
      </p>

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
          </span>
        </div>
      )}
    </div>
  )
}
