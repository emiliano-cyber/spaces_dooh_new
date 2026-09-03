import { NextResponse } from 'next/server'
import { registrarCuentaCtrl } from '@/lib/server/cuentas-controller'
import { respuestaError } from '@/lib/server/errores'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { autoregistroActivo } from '@/lib/entorno'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/signup → crea una CUENTA nueva: organización (CRM) + su usuario Dueño.
// Público (auto-registro desde el login). body: { organizacion, nombre, email, password }
//
// El auto-registro se enciende con AUTOREGISTRO=1 en el `.env` de la instancia
// (`lib/entorno.ts`), y se lee EN CADA PETICIÓN: la misma imagen sirve a toda la
// flota y cada instancia decide sin reconstruir nada.
//
// Y desde el 2026-08-20 no debe estar encendido en ninguna: la decisión P8 lo
// cerró en TODA la flota —DEMO incluida—, y la plantilla con la que el alta
// escribe el `.env` de una instancia envía `AUTOREGISTRO=0`
// (`infra/env/app.env.example:80`). El valor EFECTIVO de cada instancia vive en
// su `.env` del servidor y no se puede leer desde aquí: se comprueba con
// `GET /api/auth/metodos`, que devuelve `autoregistro: false` cuando está cerrado.
//
// El camino vivo es otro: una empresa nace por `/api/bootstrap`, UNA sola vez por
// instancia, y su Dueño da de alta a su equipo desde dentro (`/api/usuarios`, con
// permiso `administracion:crear`).
//
// Hasta el 2026-09-03 estas líneas decían que DEMO era «la única con el registro
// abierto». Era falso desde el 20/08, y no es una errata inofensiva: es la clase
// de frase que hace que alguien encienda la bandera creyendo que restaura lo
// normal, y que un ensayo de alta se corra sobre una instancia distinta de la que
// recibe un cliente.
//
// Se comprueba aquí y no solo en la UI: ocultar el botón del login dejaría este
// endpoint abierto, y cualquiera con la URL podría seguir creando organizaciones y
// usuarios Dueño en la base de esa instancia.
// Ausente = APAGADO: un `.env` que se quedó corto no abre el registro.
export async function POST(req: Request) {
  if (!autoregistroActivo()) {
    return NextResponse.json(
      { error: 'El registro de cuentas nuevas está deshabilitado. Contacta al administrador.' },
      { status: 503 },
    )
  }
  // Anti-abuso: máx. 5 registros por IP cada hora.
  const lim = limitar(`signup:${ipDe(req)}`, 5, 60 * 60_000)
  if (!lim.ok) {
    return NextResponse.json({ error: `Demasiados intentos. Espera ${lim.retrySeg}s.` }, { status: 429 })
  }
  try {
    const res = await registrarCuentaCtrl(await req.json().catch(() => ({})))
    return NextResponse.json(res, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
