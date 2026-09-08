import { NextResponse } from 'next/server'
import { usuarioActual } from '@/lib/server/auth'
import { generarLote, cuantosQuedan } from '@/lib/server/codigos-recuperacion-repo'
import { marcarCodigosVistos } from '@/lib/server/usuarios-repo'
import { exigirReautenticacionSiempre, respuestaDesbloqueo } from '@/lib/server/cambios'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { respuestaError } from '@/lib/server/errores'

// ============================================================================
//  Los códigos de recuperación del propio usuario.  (ADR 0028 · B2)
// ----------------------------------------------------------------------------
//  POST        genera un lote nuevo y lo devuelve EN CLARO. Una sola vez.
//  POST ?ya=1  confirma que los guardó, y con eso se abre la aplicación.
//
//  ─── Por qué resuelve con `usuarioActual()` y NO con `exigir()` ───────────
//  Porque ESTA es la salida del estado que `exigir()` cierra. Igual que
//  `/api/perfil` es la salida de la contraseña temporal (ADR 0009): si esta ruta
//  pasara por el guard, el usuario quedaría encerrado sin poder salir nunca —
//  cortado por no tener códigos, y sin forma de conseguirlos.
//
//  ─── Y por qué generar y confirmar son DOS pasos ──────────────────────────
//  Si confirmar fuera automático al generarlos, bastaría con que la pantalla se
//  cerrara —una pestaña, un corte de luz— para que el usuario quedara con la
//  aplicación abierta y sin códigos, creyendo que los tiene. La confirmación es
//  un acto explícito suyo, y hasta que llegue la puerta sigue cerrada.
//
//  ─── Y por qué el PRIMER lote no pide contraseña y el SEGUNDO sí ─────────
//  Son dos operaciones distintas con el mismo verbo (B6).
//
//  El primero es la SALIDA del cerrojo: quien llega aquí está cortado por
//  `exigir()` y no tiene otra cosa que hacer. Pedirle la contraseña lo
//  encerraría — y con el ADR 0028 puede ser justamente alguien que entró con
//  Google y todavía no tiene ninguna.
//
//  El segundo es un CAMBIO, y de los caros: invalida en silencio los códigos que
//  su dueño tiene guardados en papel. Es lo primero que haría quien se llevara
//  una sesión abierta — se fabrica una llave permanente y deja al dueño con una
//  lista muerta sin que nada avise. Así que va por
//  `exigirReautenticacionSiempre()`, el mismo guard que A7 puso para restablecer
//  la contraseña de un tercero: no depende del interruptor del tenant, que nace
//  apagado y en producción lo está en los cinco.
//
//  La frontera entre los dos casos es `codigos_vistos_en`: mientras sea null, el
//  usuario no ha confirmado ninguno todavía.
//
//  Los códigos NO se registran en ningún log: es el único momento en que existen
//  fuera de la base, y de ahí van a la pantalla de su dueño y a ningún otro
//  sitio (ADR 0028).
// ============================================================================

export async function POST(req: Request) {
  const u = await usuarioActual()
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  try {
    if (!u.tenantId) {
      return NextResponse.json(
        { error: 'Tu cuenta no pertenece a ninguna organización' },
        { status: 409 },
      )
    }

    const confirmar = new URL(req.url).searchParams.get('ya') === '1'

    if (confirmar) {
      // No se comprueba que existan códigos antes de marcar: quien llega aquí
      // acaba de verlos. Y si alguien confirmara sin haberlos generado, el
      // siguiente paso lo arregla — puede pedir otro lote desde su perfil.
      await marcarCodigosVistos(u.id, u.tenantId)
      return NextResponse.json(
        { ok: true, quedan: await cuantosQuedan(u.id, u.tenantId) },
        { headers: { 'cache-control': 'no-store' } },
      )
    }

    // Regenerar: es un cambio, y pide la contraseña. Generar el primero: no.
    const regenera = !!u.codigosVistosEn
    if (regenera) {
      const d = await exigirReautenticacionSiempre()
      if (!d.ok) return respuestaDesbloqueo(d)
    }

    const codigos = await generarLote(u.id, u.tenantId)

    // Queda en la bitácora, SIN los códigos. Que alguien regenere es lo que se
    // vería si le robaran la sesión, y es lo único que el dueño legítimo puede
    // reconocer como «yo no hice eso».
    if (regenera) {
      await registrarAccion(u, 'Regeneró sus códigos de recuperación', 'Los anteriores dejaron de valer')
    }

    return NextResponse.json(
      { codigos, aviso: 'Se muestran UNA sola vez. Guárdalos antes de continuar.' },
      // `no-store` no es decoración: son secretos, y un intermediario que los
      // cachee los deja donde no debe.
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return respuestaError(e)
  }
}
