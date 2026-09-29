import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { tenantActual } from '@/lib/server/tenant'
import { q } from '@/lib/server/db'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/organizacion → renombra la organización (empresa) del CRM actual.
// Se refleja en el sidebar (el nombre que se muestra a la izquierda).
//
// Renombrar la organización NO basta con `administracion.crear`: ese permiso
// vive en `rol_permisos`, así que concedérselo a otro rol —algo que se hace sin
// tocar código— le daría también la capacidad de renombrar la empresa. El nombre
// identifica al negocio en toda la aplicación, así que el guard va contra el
// ROL, que no es configurable.
//
// ADR 0040 · desde el 2026-09-29 son DOS roles, no uno. «El administrador puede
// hacer las mismas cosas que el dueño», y editar los datos de la empresa entra;
// lo que NO entra es cambiar de organización (`lib/server/tenant.ts`), que es
// de flota y sigue siendo exclusivo del Dueño.
//
// Se abre AQUÍ y en `configuracion/page.tsx` en el mismo commit, a propósito:
// abrir solo la pantalla dejaría al administrador con un formulario que
// contesta 403 al guardar — el «encierro» que este repositorio ya documentó dos
// veces.
const ROLES_EMPRESA = ['DUENO', 'ADMINISTRADOR']
const LARGO_MAX = 80

export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  if (!ROLES_EMPRESA.includes(g.usuario.rol)) {
    return NextResponse.json(
      { error: 'Solo el Dueño o un administrador pueden cambiar el nombre de la organización.' },
      { status: 403 },
    )
  }
  const body = await req.json().catch(() => ({}))
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  if (!nombre) return NextResponse.json({ error: 'El nombre de la empresa es requerido' }, { status: 400 })
  if (nombre.length > LARGO_MAX) {
    return NextResponse.json(
      { error: `El nombre no puede pasar de ${LARGO_MAX} caracteres.` },
      { status: 400 },
    )
  }

  // Guardamos el nombre anterior para que la bitácora diga de qué a qué cambió:
  // "Renombró la empresa" a secas no permite reconstruir el histórico.
  const previo = (await q<{ nombre: string }>('select nombre from tenants where id = $1', [await tenantActual()]))[0]
  await q('update tenants set nombre = $1 where id = $2', [nombre, await tenantActual()])
  await registrarAccion(g.usuario, 'Renombró la empresa', `${previo?.nombre ?? '—'} → ${nombre}`)
  return NextResponse.json({ ok: true, nombre })
}
