import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest, poolApp } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  AISLAMIENTO Y PERMISOS · casos 8–14 del plan.
//
//  Todo lo de aquí prueba el CASO NEGATIVO: que el acceso indebido FALLA. Una
//  prueba que solo comprueba que lo permitido funciona no dice nada sobre
//  seguridad — y varias de estas cubren defectos que la auditoría no vio porque
//  solo se demostró un tenant.
// ============================================================================

let alfa: Awaited<ReturnType<typeof sembrarTenant>>
let beta: Awaited<ReturnType<typeof sembrarTenant>>
let cAlfa: Cliente
let cBeta: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  alfa = await sembrarTenant('alfa')
  beta = await sembrarTenant('beta')
  await arrancarServidor()
  cAlfa = new Cliente(); await cAlfa.entrar(alfa.usuarioEmail, PASSWORD_DEMO)
  cBeta = new Cliente(); await cBeta.entrar(beta.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

describe('8 · una organización no ve ni toca lo de otra', () => {
  it('el estado de cada una trae SOLO lo suyo', async () => {
    const a = await cAlfa.pedir('/api/estado/')
    const b = await cBeta.pedir('/api/estado/')
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)

    const clientesA = (a.datos.clientes ?? []).map((x: any) => x.nombre)
    const clientesB = (b.datos.clientes ?? []).map((x: any) => x.nombre)
    expect(clientesA).toContain('Cliente alfa')
    expect(clientesA).not.toContain('Cliente beta')
    expect(clientesB).toContain('Cliente beta')
    expect(clientesB).not.toContain('Cliente alfa')
  })

  it('modificar el recurso de otra NO surte efecto, y no confirma que exista', async () => {
    // Dos propiedades, y las dos importan:
    //  · No se modifica (lo verifica el estado en la BD al final).
    //  · No se responde 403, que confirmaría que ese id existe en otra
    //    organización y permitiría enumerar.
    //
    // Quien lo impide aquí es la RLS: `cambiarEstatusPropuesta` hace
    // `update propuestas ... where id=$1` SIN filtro de tenant. En produccion
    // la app conecta con un rol NOBYPASSRLS, asi que la politica lo corta —
    // pero es UNA sola capa, no las dos que el propio codigo se exige en
    // `usuarios-repo` («si algun dia la app conectara con un rol BYPASSRLS,
    // esto sigue aislando»). Anotado como endurecimiento pendiente.
    const prop = await cAlfa.pedir('/api/propuestas/', {
      cuerpo: {
        clienteId: alfa.clienteId, nombre: 'Solo de alfa',
        fechaInicio: enDias(7), fechaFin: enDias(37),
        items: [{ sitioId: alfa.sitioId, precio: 45000, unidad: 'mensual', cantidad: 1 }],
      },
    })
    expect(prop.status).toBe(201)

    const intento = await cBeta.pedir(`/api/propuestas/${prop.datos.id}/`, {
      metodo: 'PATCH', cuerpo: { estatus: 'APROBADA' },
    })
    // No se fija un código exacto: el que sale hoy (409) viene de un guard de
    // negocio que se dispara porque beta NO VE los ítems de alfa. Lo invariante
    // es que no sea 200 ni 403.
    expect(intento.status).not.toBe(200)
    expect(intento.status).not.toBe(403)

    // Y sobre todo: la propuesta de alfa quedó INTACTA. Un rechazo que además
    // hubiera escrito algo no serviría de nada.
    const despues = await poolTest().query(
      'select estatus from propuestas where id = $1', [prop.datos.id],
    )
    expect(despues.rows[0].estatus).not.toBe('APROBADA')
  })
})

describe('9 · sin contexto de tenant, la base no devuelve nada (fail-closed)', () => {
  it('el rol de la app no ve filas de nadie si no se fija el tenant', async () => {
    // Se comprueba con DATOS presentes: un cero sobre una tabla vacía no
    // distingue «aislado» de «no hay nada».
    const hay = await poolTest().query('select count(*)::int n from clientes')
    expect(hay.rows[0].n).toBeGreaterThan(0)

    const sinTenant = await poolApp().query('select count(*)::int n from clientes')
    expect(sinTenant.rows[0].n).toBe(0)
  })
})

describe('10 · los ajustes de una no tocan los de otra (ADR 0011)', () => {
  it('cambiar el IVA en alfa deja el de beta como estaba', async () => {
    // El defecto real que arregló M5: `config_negocio` era UNA fila global y la
    // pantalla de Configuración escribía sobre ella.
    const antesB = await cBeta.pedir('/api/config/')
    expect(antesB.datos.ivaTasas).toEqual([16])

    const cambio = await cAlfa.pedir('/api/config/', {
      metodo: 'PATCH', cuerpo: { ivaTasas: [8] },
    })
    expect(cambio.status, JSON.stringify(cambio.datos)).toBe(200)

    const despuesA = await cAlfa.pedir('/api/config/')
    const despuesB = await cBeta.pedir('/api/config/')
    expect(despuesA.datos.ivaTasas).toEqual([8])
    expect(despuesB.datos.ivaTasas).toEqual([16])
  })

  it('el nombre de la empresa sale de una sola fuente', async () => {
    // M5: el sidebar decía «G500» y Configuración «RGB Catorce» porque había
    // dos columnas para lo mismo.
    const cfg = await cAlfa.pedir('/api/config/')
    expect(cfg.datos.nombreTenant).toBe('Org ALFA')
  })
})

describe('11 · COMERCIAL no reestructura el catálogo (ADR 0010)', () => {
  it('puede LEER el inventario pero no crear pantallas', async () => {
    const vendedora = await sembrarTenant('ventas', { rol: 'COMERCIAL' })
    const cv = new Cliente()
    await cv.entrar(vendedora.usuarioEmail, PASSWORD_DEMO)

    // Lectura: sí.
    const lee = await cv.pedir('/api/sitios/')
    expect(lee.status).toBe(200)

    // Escritura del catálogo: no. Vender no debería implicar poder
    // reestructurar el activo que se vende.
    const crea = await cv.pedir('/api/sitios/', {
      cuerpo: { nombre: 'Pantalla que no debería crearse' },
    })
    expect(crea.status).toBe(403)
  })
})

describe('12 y 13 · restablecer contraseña y el encierro posterior (A7)', () => {
  it('exige reautenticación, corta sesiones y fuerza el cambio', async () => {
    // Un segundo usuario de alfa al que restablecer.
    const p = poolTest()
    const bcrypt = (await import('bcryptjs')).default
    const otro = await p.query(
      `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
       values ('Otro','otro@alfa.test','COMERCIAL',$1,true,$2) returning id`,
      [await bcrypt.hash(PASSWORD_DEMO, 4), alfa.id],
    )
    const cOtro = new Cliente()
    await cOtro.entrar('otro@alfa.test', PASSWORD_DEMO)
    expect((await cOtro.pedir('/api/estado/')).status).toBe(200)

    // 1) Sin reautenticar, el restablecimiento NO pasa. Es lo que hacía inerte
    //    la protección: dependía de un interruptor apagado en los 5 tenants.
    const sinReaut = await cAlfa.pedir(`/api/usuarios/${otro.rows[0].id}/restablecer/`, { cuerpo: {} })
    expect(sinReaut.status).toBe(403)
    expect(sinReaut.datos.requiereDesbloqueo).toBe(true)

    // 2) Reautenticando con la contraseña PROPIA (no un secreto de equipo).
    const desbloqueo = await cAlfa.pedir('/api/cambios/desbloquear/', {
      cuerpo: { password: PASSWORD_DEMO },
    })
    expect(desbloqueo.status, JSON.stringify(desbloqueo.datos)).toBe(200)

    const reset = await cAlfa.pedir(`/api/usuarios/${otro.rows[0].id}/restablecer/`, { cuerpo: {} })
    expect(reset.status, JSON.stringify(reset.datos)).toBe(200)
    expect(typeof reset.datos.temporal).toBe('string')
    expect(reset.datos.temporal.length).toBeGreaterThan(8)

    // 3) Las sesiones del afectado quedaron cortadas: si le robaron la cuenta,
    //    dejarle la sesión abierta no arregla nada.
    expect((await cOtro.pedir('/api/estado/')).status).toBe(401)

    // 4) Con la temporal entra, pero queda ENCERRADO hasta cambiarla. `/api/estado`
    //    devuelve TODO el conjunto de datos del tenant: si no estuviera cortado,
    //    quien tuviera la temporal podría leerlo entero sin cambiarla.
    const cTemp = new Cliente()
    await cTemp.entrar('otro@alfa.test', reset.datos.temporal)
    const encerrado = await cTemp.pedir('/api/estado/')
    expect(encerrado.status).toBe(403)
    expect(String(encerrado.datos.error)).toMatch(/temporal/i)

    // 5) La salida: cambiarla por /api/perfil, que NO pasa por ese guard.
    const cambio = await cTemp.pedir('/api/perfil/', {
      metodo: 'PATCH',
      cuerpo: { password: 'NuevaClave123', passwordActual: reset.datos.temporal },
    })
    expect(cambio.status, JSON.stringify(cambio.datos)).toBe(200)
    expect((await cTemp.pedir('/api/estado/')).status).toBe(200)
  })
})

describe('14 · el autoregistro público (A6)', () => {
  // NO se puede comprobar aquí, y forzarlo daría una prueba que miente.
  //
  // `NEXT_PUBLIC_AUTOREGISTRO` la INLINEA Next en tiempo de BUILD, también en
  // el código de servidor. El bundle que reutilizan estas pruebas se compiló sin
  // la bandera, así que pasarla al arrancar no cambia nada: el `if` ya está
  // resuelto dentro del bundle. Probarlo de verdad exigiría un build dedicado
  // por cada valor de la bandera, que cuesta ~2 min y solo verifica un `if`.
  //
  // Dónde SÍ está cubierto: en el smoke de cada despliegue, con
  //   curl -X POST .../api/signup/  → 503
  // que es donde importa, porque comprueba la bandera REAL del entorno real.
  it.skip('requiere un build con la bandera de producción — se verifica en el despliegue', () => {})
})
