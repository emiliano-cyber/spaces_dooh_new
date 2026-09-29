import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, PASSWORD_DEMO, enDias } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  ADR 0040 · Los cuatro roles, su matriz y los DOS guards del Dueño.
// ----------------------------------------------------------------------------
//  Esto NO lo pueden ver las unitarias, y no es una formalidad:
//
//   1. **Que las dos migraciones se apliquen de verdad, y en ese orden.** El
//      valor de enum recién añadido no se puede usar en la misma transacción.
//      La unitaria mira el texto de los archivos; aquí se aplican contra un
//      Postgres real, que es lo único que demuestra que la partición funciona.
//   2. **Que el catálogo de permisos quede como dice el ADR.** `tienePermiso`
//      es fail-closed y consulta la tabla sin excepción para ningún rol: si la
//      matriz sale mal, el síntoma es «entro y no veo nada», que no señala la
//      causa.
//   3. **Que los guards NO SE PUEDAN RODEAR.** Esconder el botón no es una
//      regla: aquí se manda el PATCH y el DELETE por la red, con la sesión de
//      un administrador de verdad.
//   4. **La carrera.** Dos peticiones simultáneas desactivando a los dos
//      últimos Dueños pasan las dos comprobaciones si el conteo no va detrás de
//      un `for update`. Eso no lo ve ninguna unitaria: hace falta un Postgres y
//      dos peticiones HTTP de verdad.
//
//  NO se llama a `asegurarPermisos()` a propósito. Ese ayudante siembra las
//  cinco filas de COMERCIAL, y aquí lo que se mide es justo que COMERCIAL ya no
//  tenga ninguna. El catálogo entero llega de las migraciones, que es de donde
//  llega en una instancia de verdad.
// ============================================================================

const RAIZ = join(process.cwd(), '..', '..')
const MATRIZ = join(RAIZ, 'db', 'migrations', '20260929_roles_de_venta_matriz.sql')

let org: Awaited<ReturnType<typeof sembrarTenant>>
// Los actores. `d1` es el Dueño que siembra `sembrarTenant`; los demás se
// añaden aquí porque el ADR reparte poder entre personas, y con un solo usuario
// no se puede probar ninguna de las dos reglas.
let d1: string
let d2: string
let d3: string
let adminId: string
let vendedorId: string
let directorId: string

const correo = (quien: string) => `${quien}@roles.test`

async function sembrarUsuario(nombre: string, quien: string, rol: string): Promise<string> {
  const r = await poolTest().query(
    `insert into usuarios (nombre, email, cargo, rol, password_hash, activo, tenant_id)
     values ($1,$2,$3,$4::rol_demo,$5,true,$6) returning id`,
    [nombre, correo(quien), nombre, rol, await bcrypt.hash(PASSWORD_DEMO, 4), org.id],
  )
  return r.rows[0].id as string
}

async function entrar(quien: string): Promise<Cliente> {
  const c = new Cliente()
  await c.entrar(correo(quien), PASSWORD_DEMO)
  return c
}

// El candado de cambios sensibles (ADR 0036) está ENCENDIDO por defecto desde el
// 28/08, y las escrituras del catálogo de precio van por `exigirCambioSensible`.
//
// Esto importa aquí más que en otros archivos, y apareció midiendo: el primer
// intento daba 403 al DIRECTOR COMERCIAL creando un cupón, o sea el MISMO código
// que al vendedor — y por un motivo completamente distinto. `exigirCambioSensible`
// comprueba el permiso PRIMERO y el candado después, así que los dos 403 se
// parecen y solo la frase los separa. Se desbloquea para que el rojo del vendedor
// no pueda ser el del candado, y además se mira el mensaje.
async function desbloquear(c: Cliente): Promise<void> {
  await c.pedir('/api/cambios/desbloquear/', { cuerpo: { password: PASSWORD_DEMO } })
}

// Una cotización mínima que el esquema acepta. Va aquí y no dentro de cada
// prueba para que el rojo de un permiso no se confunda con el de un cuerpo mal
// formado: si esto estuviera mal, el 403 y el 400 se parecerían demasiado.
function cotizacion(nombre: string) {
  return {
    nombre,
    clienteId: org.clienteId,
    fechaInicio: enDias(1),
    fechaFin: enDias(30),
    items: [{ sitioId: org.sitioId, precio: 10_000 }],
  }
}

async function duenosActivos(): Promise<number> {
  const r = await poolTest().query(
    "select count(*)::int n from usuarios where tenant_id = $1 and rol = 'DUENO' and activo",
    [org.id],
  )
  return r.rows[0].n
}

async function estadoDe(id: string): Promise<{ rol: string; activo: boolean }> {
  const r = await poolTest().query(
    'select rol::text as rol, activo from usuarios where id = $1',
    [id],
  )
  return r.rows[0]
}

beforeAll(async () => {
  await recrearEsquema()
  org = await sembrarTenant('roles')
  d1 = (
    await poolTest().query('select id from usuarios where lower(email) = lower($1)', [
      org.usuarioEmail,
    ])
  ).rows[0].id
  d2 = await sembrarUsuario('Dueno dos', 'd2', 'DUENO')
  d3 = await sembrarUsuario('Dueno tres', 'd3', 'DUENO')
  adminId = await sembrarUsuario('Administradora', 'admin', 'ADMINISTRADOR')
  vendedorId = await sembrarUsuario('Vendedor', 'vendedor', 'VENDEDOR')
  directorId = await sembrarUsuario('Directora comercial', 'director', 'DIRECTOR_COMERCIAL')
  await sembrarUsuario('Gerente de ventas', 'gerente', 'GERENTE_VENTAS')
  // El rol retirado. Se crea a mano porque la API ya no lo acepta: el valor
  // sigue en el enum de Postgres y una instancia vieja puede tenerlo.
  await sembrarUsuario('Comercial de antes', 'comercial', 'COMERCIAL')
  await arrancarServidor()
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ───────────────────────────────────────────────────────────────────────────
describe('1 · las dos migraciones dejaron el enum y la matriz como manda el ADR', () => {
  it('el enum `rol_demo` admite los cuatro roles nuevos', async () => {
    const r = await poolTest().query(
      `select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = 'rol_demo' order by enumlabel`,
    )
    const valores = r.rows.map((x: any) => x.enumlabel)
    for (const rol of ['ADMINISTRADOR', 'DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']) {
      expect(valores, rol).toContain(rol)
    }
    // Y COMERCIAL sigue ahí: un valor de enum no se quita. Se retira DE USO.
    expect(valores).toContain('COMERCIAL')
  })

  it('el ADMINISTRADOR lleva EXACTAMENTE los permisos del Dueño', async () => {
    const r = await poolTest().query(
      `select rol::text as rol, modulo || '.' || accion as permiso
         from rol_permisos where rol in ('DUENO','ADMINISTRADOR') order by 2`,
    )
    const dueno = r.rows.filter((x: any) => x.rol === 'DUENO').map((x: any) => x.permiso)
    const admin = r.rows.filter((x: any) => x.rol === 'ADMINISTRADOR').map((x: any) => x.permiso)
    expect(admin).toEqual(dueno)
    expect(admin.length).toBeGreaterThan(0)
  })

  it('COMERCIAL se queda con CERO filas: existe y no autoriza nada', async () => {
    const r = await poolTest().query(
      "select count(*)::int n from rol_permisos where rol = 'COMERCIAL'",
    )
    expect(r.rows[0].n).toBe(0)
  })

  it('el catálogo completo: 8 roles con filas, y COMERCIAL fuera', async () => {
    const r = await poolTest().query(
      'select rol::text as rol, count(*)::int n from rol_permisos group by 1 order by 1',
    )
    expect(r.rows).toEqual([
      { rol: 'ADMINISTRADOR', n: 26 },
      { rol: 'DIRECTOR_COMERCIAL', n: 8 },
      { rol: 'DUENO', n: 26 },
      { rol: 'FINANZAS', n: 4 },
      { rol: 'GERENTE_VENTAS', n: 8 },
      { rol: 'IMPRENTA', n: 3 },
      { rol: 'OPERACIONES', n: 5 },
      { rol: 'VENDEDOR', n: 6 },
    ])
  })

  it('el VENDEDOR ve el catálogo de precio pero NO lo escribe', async () => {
    const r = await poolTest().query(
      `select accion from rol_permisos where rol = 'VENDEDOR' and modulo = 'precios' order by 1`,
    )
    expect(r.rows.map((x: any) => x.accion)).toEqual(['ver'])
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('2 · un usuario nuevo sin rol explícito NO nace COMERCIAL', () => {
  it('el DEFAULT de la columna es VENDEDOR', async () => {
    const r = await poolTest().query(
      `select column_default from information_schema.columns
        where table_name = 'usuarios' and column_name = 'rol'`,
    )
    expect(r.rows[0].column_default).toContain('VENDEDOR')
  })

  it('y un insert sin rol lo demuestra: nace VENDEDOR', async () => {
    // El default de la columna se mide insertando, no leyendo el catálogo: es
    // lo que hace cualquier script suelto que no nombre la columna.
    const r = await poolTest().query(
      `insert into usuarios (nombre, email, password_hash, activo, tenant_id)
       values ('Sin rol','sinrol@roles.test','x',true,$1) returning rol::text as rol`,
      [org.id],
    )
    expect(r.rows[0].rol).toBe('VENDEDOR')
  })

  it('el alta por la API tampoco: sin rol, el usuario nace VENDEDOR', async () => {
    // El repo tenía `input.rol ?? 'COMERCIAL'` escrito a mano, que es un
    // SEGUNDO default por encima del de la columna. Cambiar solo la columna
    // habría dejado este camino intacto y el alta real seguiría creando
    // COMERCIALes sin permisos.
    const c = await entrar('d2')
    const r = await c.pedir('/api/usuarios/', {
      cuerpo: { nombre: 'Alta sin rol', email: 'altasinrol@roles.test', password: 'Prueba1234' },
    })
    expect(r.status).toBe(201)
    expect(r.datos?.rol).toBe('VENDEDOR')
  })

  it('la API ya no acepta COMERCIAL como rol', async () => {
    const c = await entrar('d2')
    const r = await c.pedir('/api/usuarios/', {
      cuerpo: {
        nombre: 'Comercial nuevo',
        email: 'comercialnuevo@roles.test',
        password: 'Prueba1234',
        rol: 'COMERCIAL',
      },
    })
    expect(r.status).toBe(400)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('3 · COMERCIAL ya no autoriza NADA', () => {
  it('entra, y se come un 403 en el módulo que antes era suyo', async () => {
    // Entra: la cuenta no está bloqueada. Lo que ya no tiene es permiso.
    const c = await entrar('comercial')
    const r = await c.pedir('/api/propuestas/', { cuerpo: cotizacion('Del comercial') })
    expect(r.status).toBe(403)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('4 · el VENDEDOR cotiza pero no crea códigos', () => {
  it('NO puede crear un código promocional, y el 403 es POR PERMISO', async () => {
    const c = await entrar('vendedor')
    await desbloquear(c)
    const r = await c.pedir('/api/codigos-promocionales/', {
      cuerpo: { codigo: 'VENDEDOR10', descuentoPct: 10 },
    })
    expect(r.status).toBe(403)
    // La frase importa tanto como el número: con el candado encendido, el mismo
    // 403 significaría «teclea tu contraseña» y esta prueba pasaría sin probar
    // nada del ADR 0040.
    expect(String(r.datos?.error)).toMatch(/permiso/i)
  })

  it('tampoco un paquete cerrado ni una escala de volumen', async () => {
    const c = await entrar('vendedor')
    await desbloquear(c)
    expect((await c.pedir('/api/paquetes/', { cuerpo: { nombre: 'X', precio: 1 } })).status).toBe(403)
    expect(
      (await c.pedir('/api/volumen/escalas/', { cuerpo: { desdeSpots: 1, descuentoPct: 5 } })).status,
    ).toBe(403)
  })

  it('pero SÍ ve el catálogo: los aplica, no los crea', async () => {
    // Control positivo. Sin esto, los 403 de arriba podrían venir de que el
    // vendedor no tenga NINGÚN permiso, y la prueba diría lo que no es.
    const c = await entrar('vendedor')
    expect((await c.pedir('/api/codigos-promocionales/')).status).toBe(200)
    expect((await c.pedir('/api/paquetes/')).status).toBe(200)
  })

  it('y SÍ puede cotizar', async () => {
    const c = await entrar('vendedor')
    const r = await c.pedir('/api/propuestas/', { cuerpo: cotizacion('Del vendedor') })
    expect([200, 201]).toContain(r.status)
  })

  it('el DIRECTOR COMERCIAL sí crea códigos', async () => {
    // El otro lado del mismo guard: si esto fallara, el módulo `precios` estaría
    // cerrado para todos y el 403 del vendedor no probaría nada.
    const c = await entrar('director')
    await desbloquear(c)
    const r = await c.pedir('/api/codigos-promocionales/', {
      cuerpo: { codigo: 'DIRECTOR10', descuentoPct: 10 },
    })
    expect(r.status).not.toBe(403)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('5 · GUARD 1 — un ADMINISTRADOR no toca a ningún DUEÑO', () => {
  it('no lo puede desactivar', async () => {
    const c = await entrar('admin')
    const r = await c.pedir(`/api/usuarios/${d3}/`, { metodo: 'PATCH', cuerpo: { activo: false } })
    expect(r.status).toBe(403)
    expect(String(r.datos?.error)).toMatch(/administrador/i)
    expect((await estadoDe(d3)).activo).toBe(true)
  })

  it('no lo puede degradar', async () => {
    const c = await entrar('admin')
    const r = await c.pedir(`/api/usuarios/${d3}/`, {
      metodo: 'PATCH',
      cuerpo: { rol: 'VENDEDOR' },
    })
    expect(r.status).toBe(403)
    expect((await estadoDe(d3)).rol).toBe('DUENO')
  })

  it('tampoco lo puede ELIMINAR', async () => {
    const c = await entrar('admin')
    const r = await c.pedir(`/api/usuarios/${d3}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(403)
    expect((await estadoDe(d3)).rol).toBe('DUENO')
  })

  it('pero SÍ puede desactivar a un vendedor', async () => {
    // Control positivo: el administrador administra de verdad. Sin esto, los
    // tres 403 de arriba podrían venir de que no puede tocar a NADIE.
    const c = await entrar('admin')
    const r = await c.pedir(`/api/usuarios/${vendedorId}/`, {
      metodo: 'PATCH',
      cuerpo: { activo: false },
    })
    expect(r.status).toBe(200)
    expect((await estadoDe(vendedorId)).activo).toBe(false)
    // Se deja como estaba: las pruebas de abajo lo usan.
    await poolTest().query('update usuarios set activo = true where id = $1', [vendedorId])
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('6 · GUARD 2 — la organización nunca se queda sin Dueño activo', () => {
  it('con tres Dueños, desactivar a uno se permite', async () => {
    expect(await duenosActivos()).toBe(3)
    const c = await entrar('d2')
    const r = await c.pedir(`/api/usuarios/${d3}/`, { metodo: 'PATCH', cuerpo: { activo: false } })
    expect(r.status).toBe(200)
    expect(await duenosActivos()).toBe(2)
  })

  it('al ÚLTIMO Dueño activo no lo desactiva nadie — ni quien administra', async () => {
    // Quien lo intenta no es el administrador (ése cae en el guard 1) sino un
    // DIRECTOR COMERCIAL al que se le ha concedido `administracion` a mano. Es
    // un caso real: `rol_permisos` es DATOS, y un Dueño puede repartir ese
    // permiso sin tocar código. Si el guard viviera en el rol y no en la regla,
    // esta puerta quedaría abierta.
    await poolTest().query(
      `insert into rol_permisos (rol, modulo, accion)
       values ('DIRECTOR_COMERCIAL','administracion','ver'),
              ('DIRECTOR_COMERCIAL','administracion','crear')
       on conflict do nothing`,
    )
    // Se baja a UN solo Dueño activo, por la base y no por la API: lo que se
    // prueba es el último paso, no el camino hasta él.
    await poolTest().query('update usuarios set activo = false where id = $1', [d2])
    expect(await duenosActivos()).toBe(1)

    const c = await entrar('director')
    const r = await c.pedir(`/api/usuarios/${d1}/`, {
      metodo: 'PATCH',
      cuerpo: { activo: false },
    })
    expect(r.status).toBe(409)
    expect(String(r.datos?.error)).toMatch(/sin ning/i)
    expect(await duenosActivos()).toBe(1)
  })

  it('tampoco lo degrada, ni lo elimina', async () => {
    const c = await entrar('director')
    const degradar = await c.pedir(`/api/usuarios/${d1}/`, {
      metodo: 'PATCH',
      cuerpo: { rol: 'ADMINISTRADOR' },
    })
    expect(degradar.status).toBe(409)
    const borrar = await c.pedir(`/api/usuarios/${d1}/`, { metodo: 'DELETE' })
    expect(borrar.status).toBe(409)
    expect(await duenosActivos()).toBe(1)
  })

  it('un Dueño YA inactivo sí se puede eliminar: no quita a nadie', async () => {
    const c = await entrar('director')
    const r = await c.pedir(`/api/usuarios/${d3}/`, { metodo: 'DELETE' })
    expect(r.status).toBe(200)
    expect(await duenosActivos()).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('7 · LA CARRERA — dos peticiones a la vez sobre los dos últimos Dueños', () => {
  it('exactamente una gana, y la organización se queda con un Dueño', async () => {
    // El camino ingenuo —contar, comprobar, escribir— la pierde SIEMPRE: las
    // dos peticiones leen «hay 2 activos», las dos concluyen que pueden, y la
    // organización se queda con CERO Dueños. Se resuelve bloqueando las filas
    // de los Dueños activos ANTES de contarlas, y el orden ES el mecanismo.
    await poolTest().query('update usuarios set activo = true where id = $1', [d2])
    expect(await duenosActivos()).toBe(2)

    // Un solo actor para las dos peticiones, y que no sea ninguno de los dos
    // Dueños: si el actor fuera uno de ellos, perder la carrera le cerraría la
    // sesión y el resultado no diría nada del bloqueo.
    const c = await entrar('director')
    const [a, b] = await Promise.all([
      c.pedir(`/api/usuarios/${d1}/`, { metodo: 'PATCH', cuerpo: { activo: false } }),
      c.pedir(`/api/usuarios/${d2}/`, { metodo: 'PATCH', cuerpo: { activo: false } }),
    ])

    const ganadores = [a, b].filter((r) => r.status === 200)
    expect(ganadores).toHaveLength(1)
    // La invariante de verdad, y la que hay que mirar aunque los códigos
    // cambien: NUNCA se queda sin Dueño.
    expect(await duenosActivos()).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('8 · lo que el ADMINISTRADOR sí puede, y lo que no (fuera de la matriz)', () => {
  it('SÍ puede renombrar la empresa', async () => {
    // `configuracion/page.tsx:25` y `/api/organizacion` exigían ROL === DUENO.
    // Abrir solo la pantalla habría dejado al administrador con un formulario
    // que contesta 403 al guardar — el «encierro» que este repo documenta.
    const c = await entrar('admin')
    const r = await c.pedir('/api/organizacion/', {
      metodo: 'PATCH',
      cuerpo: { nombre: 'Org renombrada por el admin' },
    })
    expect(r.status).toBe(200)
  })

  it('NO puede cambiar de organización — eso es de flota, no de empresa', async () => {
    const c = await entrar('admin')
    expect((await c.pedir('/api/tenants/')).status).toBe(403)
  })

  it('y un rol de venta tampoco renombra la empresa', async () => {
    const c = await entrar('director')
    const r = await c.pedir('/api/organizacion/', {
      metodo: 'PATCH',
      cuerpo: { nombre: 'No deberia' },
    })
    expect(r.status).toBe(403)
  })
})

// ───────────────────────────────────────────────────────────────────────────
describe('9 · la migración se lleva por delante a los COMERCIAL que encuentre', () => {
  it('un usuario COMERCIAL pasa a VENDEDOR al reaplicarla, y no hay ninguno después', async () => {
    // El caso de g500: la instancia YA tiene gente con ese rol cuando la
    // migración llega. Aquí se reproduce al revés —se mete el COMERCIAL y se
    // vuelve a aplicar el archivo— porque es lo que demuestra que el `update`
    // corre de verdad y no afecta a cero filas en silencio, que es el modo de
    // fallo de la zona R2.
    const id = await sembrarUsuario('Comercial tardio', 'comercial2', 'COMERCIAL')
    expect((await estadoDe(id)).rol).toBe('COMERCIAL')

    await poolTest().query(readFileSync(MATRIZ, 'utf8'))

    expect((await estadoDe(id)).rol).toBe('VENDEDOR')
    const r = await poolTest().query(
      "select count(*)::int n from usuarios where rol = 'COMERCIAL'",
    )
    expect(r.rows[0].n).toBe(0)
  })

  it('y reaplicarla no cambia el catálogo (idempotente)', async () => {
    const antes = await poolTest().query(
      "select rol::text || '|' || modulo || '|' || accion as f from rol_permisos order by 1",
    )
    await poolTest().query(readFileSync(MATRIZ, 'utf8'))
    const despues = await poolTest().query(
      "select rol::text || '|' || modulo || '|' || accion as f from rol_permisos order by 1",
    )
    expect(despues.rows).toEqual(antes.rows)
  })
})
