import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { validarPassword, passwordDeAlta } from './auth'
import { googleHabilitado } from './google-oauth'
import { esEmailValido } from '@/lib/validacion'
import { crearTenant } from './tenant'
import { withTxBootstrap } from './db'
import { crearUsuario, emailExiste } from './usuarios-repo'
import type { Moneda } from '@/lib/i18n/dinero'
import { monedaPedida, resolverMonedaDeAlta } from './moneda-alta'
import { recordarMonedaDeLaInstancia } from './moneda-instancia'
import type { Idioma } from '@/lib/i18n/idiomas'
import { idiomaDocumentosPedido, resolverIdiomaDocumentosDeAlta } from './idioma-alta'
import { recordarIdiomaDeLaInstancia } from './idioma-instancia'

// ============================================================================
//  lib/server/cuentas-controller.ts — Alta de organizaciones (CRM) + su Dueño.
//  Lo comparten el auto-registro público (signup) y la creación por super-admin
//  (tenants). Valida org/admin/contraseña, verifica correo y crea tenant+usuario.
// ============================================================================

const signupSchema = z.object({
  organizacion: z.string().trim().min(1, 'La organización es requerida'),
  nombre: z.string().trim().min(1, 'El nombre es requerido'),
  email: z.string().trim().refine(esEmailValido, 'Correo inválido'),
  // Opcional desde A3.1: el bootstrap de una instancia ya no manda ninguna. En
  // `/api/signup` sigue siendo obligatoria de hecho -- `passwordDeAlta` la exige
  // cuando no se entra con Google -- pero la exige el resolutor compartido, que
  // es donde vive esa regla para las TRES altas.
  password: z.string().optional(),
  // ADR 0048 · MXN o USD. Solo decide en la PRIMERA organizacion de la instancia.
  moneda: z.unknown().optional(),
  // ADR 0049 · es, en o it: el idioma de los DOCUMENTOS (contrato, constancia).
  // Igual que la moneda: solo decide en la primera, y solo desde el bootstrap.
  idiomaDocumentos: z.unknown().optional(),
})

const orgSchema = z.object({
  nombre: z.string().trim().min(1, 'Falta el nombre de la organización'),
  slug: z.string().trim().optional(),
  admin: z.object({
    nombre: z.string().trim().min(1, 'Falta el nombre del administrador'),
    email: z.string().trim().refine(esEmailValido, 'Correo inválido'),
    // Opcional desde el ADR 0012: con `entraConGoogle` no se manda ninguna.
    password: z.string().optional(),
    entraConGoogle: z.boolean().optional(),
    cargo: z.string().trim().optional(),
  }),
  // ADR 0048 · se acepta para poder RECHAZAR una distinta a la de la instancia.
  moneda: z.unknown().optional(),
  // ADR 0049 · igual: se acepta para poder rechazar uno distinto.
  idiomaDocumentos: z.unknown().optional(),
})

// Exportada desde el ADR 0012: el alta de empresa con Google la reutiliza en
// vez de reimplementar la creación. Es la MISMA función que usa `/api/signup` y
// el alta de CRM del super-admin, así que las tres crean organizaciones
// idénticas — con su Dueño, su rol y sus comprobaciones de correo repetido.
// Duplicarla habría sido la forma segura de que las tres divergieran.
export async function crearOrgConDueno(args: {
  org: string
  slug?: string
  nombre: string
  email: string
  password: string
  cargo?: string
  // Lo enciende quien genero la contrasena en nombre de otro. Ver `crearUsuario`.
  debeCambiarPassword?: boolean
  // ADR 0028: la contrasena de esta cuenta NO abre la puerta. Lo enciende el
  // bootstrap de una instancia, donde el Dueno entra solo con Google.
  soloGoogle?: boolean
  // ADR 0048 · la moneda pedida, ya validada. Ver `resolverMonedaDeAlta`.
  moneda?: Moneda
  // ADR 0049 · el idioma de documentos pedido. Ver `resolverIdiomaDocumentosDeAlta`.
  idiomaDocumentos?: Idioma
}) {
  const errPass = validarPassword(args.password)
  if (errPass) throw new AppError(errPass, 400)
  if (await emailExiste(args.email)) throw new AppError('Ese correo ya está registrado', 409)
  // F5.1 — LOS DOS INSERT EN UNA SOLA TRANSACCIÓN.
  //
  // Antes eran dos llamadas sueltas, y si la segunda fallaba el tenant
  // sobrevivía: quedaba una organización sin nadie dentro, que nadie podía
  // administrar y que ocupaba su slug para siempre.
  //
  // `fijarTenant` va EN MEDIO, y ese es el punto: la transacción empieza sin
  // tenant —todavía no existe— y el GUC se fija en cuanto el id aparece, justo
  // antes del INSERT de `usuarios`, que es fail-closed y lo necesita.
  //
  // La forma de retorno NO cambia (`{ tenant, usuario }`): devolver la URL está
  // descartado (§4, T5 del plan).
  let monedaElegida: Moneda | null = null
  let idiomaElegido: Idioma | null = null
  const res = await withTxBootstrap(async ({ client, fijarTenant }) => {
    // Dentro de la transaccion: la lectura y el INSERT van juntos.
    const { rows } = await client.query(
      'select moneda, idioma_documentos from tenants order by creado_en asc limit 1',
    )
    const moneda = resolverMonedaDeAlta(args.moneda, rows[0]?.moneda ?? null)
    const idioma = resolverIdiomaDocumentosDeAlta(args.idiomaDocumentos, rows[0]?.idioma_documentos ?? null)
    const tenant = await crearTenant(args.org, args.slug ?? args.org, client, moneda, idioma)
    monedaElegida = moneda
    idiomaElegido = idioma
    await fijarTenant(tenant.id)
    const usuario = await crearUsuario(
      {
        nombre: args.nombre,
        email: args.email,
        cargo: args.cargo ?? 'Dueño',
        rol: 'DUENO',
        password: args.password,
        tenantId: tenant.id,
        debeCambiarPassword: args.debeCambiarPassword,
        soloGoogle: args.soloGoogle,
      },
      client,
    )
    return { tenant, usuario }
  })
  // ADR 0048 · DESPUES del commit: si la transaccion se deshace no hay
  // organizacion, y recordar su moneda pintaria la de una instancia que no la
  // tiene. Sustituye el MXN «de nadie» que el proceso tuviera de antes.
  if (monedaElegida) recordarMonedaDeLaInstancia(monedaElegida)
  // ADR 0049 · lo mismo con el idioma de los documentos.
  if (idiomaElegido) recordarIdiomaDeLaInstancia(idiomaElegido)
  return res
}

// Auto-registro público (body plano).
// `opciones` existe porque esta funcion la comparten DOS rutas con contratos
// opuestos: `/api/signup`, donde la persona elige su propia contrasena --y
// obligarla a cambiarla seria absurdo--, y `/api/bootstrap`, donde la genera el
// operador del alta. Por eso el forzado es un parametro y no una regla fija.
export async function registrarCuentaCtrl(
  body: unknown,
  opciones?: {
    debeCambiarPassword?: boolean
    entraConGoogle?: boolean
    eligeMoneda?: boolean
    eligeIdiomaDocumentos?: boolean
  },
) {
  const d = validar(signupSchema, body)
  // ADR 0048 · la moneda de la instancia SOLO la elige el bootstrap, que es la
  // puerta con token. `/api/signup` es anonima: con AUTOREGISTRO=1 y la base
  // vacia, un visitante cualquiera decidiria la moneda de toda la instancia
  // para siempre. Se rechaza en vez de ignorarse, para que nadie crea que la
  // eligio; sin `moneda`, el alta hereda la de la instancia (o MXN si no hay).
  if (!opciones?.eligeMoneda && d.moneda !== undefined) {
    throw new AppError('La moneda de la instancia solo se elige al darla de alta', 400)
  }
  const moneda = monedaPedida(d.moneda)
  // ADR 0049 · el idioma de los documentos, con la MISMA regla: solo lo elige
  // el bootstrap; en `/api/signup` (anonima) se rechaza en vez de ignorarse.
  if (!opciones?.eligeIdiomaDocumentos && d.idiomaDocumentos !== undefined) {
    throw new AppError('El idioma de los documentos de la instancia solo se elige al darla de alta', 400)
  }
  const idiomaDocumentos = idiomaDocumentosPedido(d.idiomaDocumentos)

  // A3.1 — quien nace entrando con Google NO trae contraseña, y mandar una se
  // RECHAZA en vez de ignorarse. Ignorarla sería lo peor de los dos mundos: una
  // tarjeta vieja imprimiría una clave en la pantalla del operador, él creería
  // habérsela entregado al Dueño, y la cuenta habría nacido con otra distinta.
  if (opciones?.entraConGoogle && d.password) {
    throw new AppError(
      'Esta alta no lleva contraseña: el Dueño entra con Google (ADR 0028). Quita ' +
        '`password` del cuerpo. Si estás siguiendo una tarjeta que la genera, esa tarjeta ' +
        'es anterior al 2026-09-07.',
      400,
    )
  }

  // El MISMO resolutor que el alta de CRM del super-admin. Con `entraConGoogle`
  // devuelve una aleatoria que no verá nadie, y comprueba que Google esté
  // disponible: sin esa comprobación se crearían cuentas incapaces de entrar.
  const r = passwordDeAlta({
    entraConGoogle: opciones?.entraConGoogle,
    password: d.password,
    googleDisponible: googleHabilitado(),
  })
  if ('error' in r) throw new AppError(r.error, 400)

  return crearOrgConDueno({
    org: d.organizacion, nombre: d.nombre, email: d.email, password: r.password,
    debeCambiarPassword: opciones?.debeCambiarPassword,
    soloGoogle: opciones?.entraConGoogle,
    moneda,
    idiomaDocumentos,
  })
}

// Alta de CRM por super-admin (nombre/slug + objeto admin).
export async function crearOrganizacionCtrl(body: unknown) {
  const d = validar(orgSchema, body)
  const moneda = monedaPedida(d.moneda)
  const idiomaDocumentos = idiomaDocumentosPedido(d.idiomaDocumentos)
  // El Dueño de la organización nueva puede nacer entrando con Google, igual
  // que un usuario suelto (ADR 0012, enmienda E1). Misma resolución para las
  // dos altas, para que no diverjan.
  const r = passwordDeAlta({
    entraConGoogle: d.admin.entraConGoogle,
    password: d.admin.password,
    googleDisponible: googleHabilitado(),
  })
  if ('error' in r) throw new AppError(r.error, 400)

  return crearOrgConDueno({
    org: d.nombre,
    slug: d.slug,
    nombre: d.admin.nombre,
    email: d.admin.email,
    password: r.password,
    cargo: d.admin.cargo,
    moneda,
    idiomaDocumentos,
  })
}
