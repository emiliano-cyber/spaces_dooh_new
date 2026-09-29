import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  ADR 0040 · La forma de las dos migraciones, comprobada SIN base de datos.
// ----------------------------------------------------------------------------
//  La regla que las parte en dos no se puede probar leyendo: hace falta un
//  PostgreSQL. Lo que SÍ se puede fijar aquí, y corre en CI sin Docker, es que
//  el reparto siga siendo el que hace que aquello funcione:
//
//    · el archivo del ENUM solo AÑADE valores y no USA ninguno;
//    · el archivo de la MATRIZ los usa y no añade ninguno.
//
//  Si alguien junta las dos cosas en un archivo «para simplificar», la
//  migración muere con «unsafe use of new value» — y muere en el droplet, que
//  es donde más caro sale. Esta prueba lo caza antes.
// ============================================================================

const DIR = join(__dirname, '..', '..', '..', 'db', 'migrations')
const ENUM = '20260929_roles_de_venta_enum.sql'
const MATRIZ = '20260929_roles_de_venta_matriz.sql'
const COSTEAR = '20260929_roles_operaciones_costear.sql'

const leer = (archivo: string) => readFileSync(join(DIR, archivo), 'utf8')

// Las líneas de SQL de verdad: sin comentarios. Un `toContain` sobre el archivo
// entero casa con la prosa, y la prosa de estas dos migraciones habla
// largamente de lo que NO hacen.
function sqlDe(archivo: string): string {
  return leer(archivo)
    .split('\n')
    .filter((l) => !/^\s*--/.test(l))
    .join('\n')
}

// SOLO el `insert into rol_permisos … on conflict`, sin la lista del `raise
// exception` que viene después.
//
// Hace falta porque las dos escriben las MISMAS tripletas: el insert las siembra
// y el assert comprueba que estén. Una expectativa sobre el archivo entero casa
// con cualquiera de las dos, así que una prueba que quiera decir «esta fila se
// SIEMBRA» tiene que mirar aquí. Lo enseñó el mutante M29, que borró la fila del
// Dueño del insert y sobrevivió.
function insertDe(sql: string): string {
  const i = sql.indexOf('insert into rol_permisos')
  const j = sql.indexOf('on conflict', i)
  expect(i, 'no se encontró el insert de rol_permisos').toBeGreaterThan(-1)
  expect(j, 'no se encontró el cierre del insert').toBeGreaterThan(i)
  return sql.slice(i, j)
}

const ROLES_NUEVOS = ['ADMINISTRADOR', 'DIRECTOR_COMERCIAL', 'GERENTE_VENTAS', 'VENDEDOR']

describe('1 · el archivo del enum solo añade valores', () => {
  const sql = sqlDe(ENUM)

  it('añade los cuatro roles del ADR', () => {
    for (const rol of ROLES_NUEVOS) {
      expect(sql, rol).toMatch(new RegExp(`alter type rol_demo add value[^;]*'${rol}'`, 'i'))
    }
  })

  it('no USA ninguno de ellos: ni en un insert, ni en un update, ni en un default', () => {
    // El valor recién añadido no se puede usar en la misma transacción. Este
    // archivo es la transacción que lo añade, así que aquí no cabe ningún uso.
    expect(sql).not.toMatch(/insert\s+into/i)
    expect(sql).not.toMatch(/update\s+usuarios/i)
    expect(sql).not.toMatch(/set\s+default/i)
  })

  it('es transaccional, como todas las de este repositorio', () => {
    expect(sql).toMatch(/^\s*begin\s*;/im)
    expect(sql).toMatch(/^\s*commit\s*;/im)
  })
})

describe('2 · el archivo de la matriz los usa y no añade ninguno', () => {
  const sql = sqlDe(MATRIZ)

  it('no añade valores al enum', () => {
    expect(sql).not.toMatch(/alter\s+type\s+rol_demo\s+add\s+value/i)
  })

  it('siembra los cuatro roles en rol_permisos', () => {
    for (const rol of ROLES_NUEVOS) expect(sql, rol).toContain(`'${rol}'`)
  })

  it('cambia el DEFAULT de usuarios.rol a VENDEDOR', () => {
    // Sin esto, cada usuario nuevo sin rol explícito nace COMERCIAL — un rol
    // que a partir de esta migración no autoriza NADA. El síntoma sería «entro
    // y no veo ninguna pantalla», que no señala la causa.
    expect(sql).toMatch(/alter\s+table\s+usuarios\s+alter\s+column\s+rol\s+set\s+default\s+'VENDEDOR'/i)
  })

  it('migra a VENDEDOR los usuarios que hoy son COMERCIAL', () => {
    expect(sql).toMatch(/update\s+usuarios\s+set\s+rol\s*=\s*'VENDEDOR'/i)
  })

  it('le quita a COMERCIAL sus filas de permisos', () => {
    expect(sql).toMatch(/delete\s+from\s+rol_permisos[\s\S]*COMERCIAL/i)
  })

  it('exige un rol que SALTE la RLS antes de tocar `usuarios`', () => {
    // `usuarios` es fail-closed + FORCE. Si el runner corriera con un rol que
    // no salta la RLS, el `update` no fallaría: afectaría a CERO filas EN
    // SILENCIO y los COMERCIAL se quedarían sin permisos y sin rol nuevo. Es el
    // modo de fallo de la zona R2, y por eso la migración se niega a empezar.
    //
    // ⚠️ Esta comprobación decía `/rolsuper|rolbypassrls/` y el MUTANTE M12 la
    // sobrevivió: quitar la condición entera del `where` dejaba las dos palabras
    // en la FRASE del `raise exception`, que no es un comentario y por tanto
    // `sqlDe()` no la quita. Es exactamente el fallo que este repositorio ya
    // tiene escrito —un `toContain` que casa con otra cosa— y aquí casaba con el
    // mensaje del error en vez de con el guard. Se exige la CONDICIÓN.
    expect(sql).toMatch(/rolname\s*=\s*current_user\s+and\s*\(\s*rolsuper\s+or\s+rolbypassrls\s*\)/i)
  })

  it('es transaccional', () => {
    expect(sql).toMatch(/^\s*begin\s*;/im)
    expect(sql).toMatch(/^\s*commit\s*;/im)
  })
})

describe('3 · la migración de `operaciones.costear` (encargo del 29/09)', () => {
  const sql = sqlDe(COSTEAR)

  it('no añade valores al enum: los usa', () => {
    expect(sql).not.toMatch(/alter\s+type\s+rol_demo\s+add\s+value/i)
  })

  it('le da `costear` a los CUATRO roles, y el DUEÑO va explícito', () => {
    // El dueño NO tiene bypass: `tienePermiso` consulta la tabla sin excepción
    // para nadie. Una acción nueva sin su fila lo deja fuera de su propia
    // instancia, y el síntoma —«yo, que soy el dueño, no puedo»— no señala la
    // causa. Es el mismo vicio que el default de `usuarios.rol`.
    //
    // ⚠️ Se mira SOLO EL `insert`, y esto lo enseñó el mutante M29. La versión
    // anterior buscaba la tripleta en el archivo entero y **sobrevivía a que se
    // borrara la fila del Dueño del insert**: la misma tripleta aparece más
    // abajo, en la lista del `raise exception` que comprueba que esté. O sea que
    // casaba con la comprobación en vez de con lo comprobado — el mismo fallo
    // que M12, dos veces en el mismo archivo.
    for (const rol of ['DUENO', 'ADMINISTRADOR', 'OPERACIONES', 'FINANZAS']) {
      expect(insertDe(sql), rol).toMatch(
        new RegExp(`\\('${rol}',\\s*'operaciones',\\s*'costear'\\)`, 'i'),
      )
    }
  })

  it('y a FINANZAS además `operaciones.ver`: no se costea lo que no se abre', () => {
    // La tarjeta de captura vive dentro de la vista de la OT, y `GET /api/ot`
    // exige `operaciones.ver`. Sin esta fila, Finanzas tendría el permiso de
    // escribir y ninguna forma de llegar a la pantalla.
    //
    // Sobre el INSERT y no sobre el archivo, por lo mismo que arriba: el
    // mutante M34 movió esta fila a otro módulo y sobrevivía, porque la
    // tripleta seguía apareciendo en la lista del `raise exception`.
    expect(insertDe(sql)).toMatch(/\('FINANZAS',\s*'operaciones',\s*'ver'\)/i)
  })

  it('NUNCA le da `operaciones.crear` a FINANZAS', () => {
    // La salida fácil que esta migración existe para no tomar: `crear` en
    // Operaciones es crear y CERRAR órdenes de trabajo, no capturar un importe.
    expect(sql).not.toMatch(/\('FINANZAS',\s*'operaciones',\s*'crear'\)/i)
  })

  it('se niega a correr si el enum todavía no tiene ADMINISTRADOR', () => {
    // El guard que convierte el orden lexicográfico en un contrato.
    expect(sql).toMatch(/enumlabel\s*=\s*'ADMINISTRADOR'/i)
  })

  it('es transaccional', () => {
    expect(sql).toMatch(/^\s*begin\s*;/im)
    expect(sql).toMatch(/^\s*commit\s*;/im)
  })
})

describe('4 · la matriz le da al director la LECTURA de finanzas, y nada más', () => {
  const sql = sqlDe(MATRIZ)

  it('siembra `DIRECTOR_COMERCIAL | finanzas | ver`', () => {
    // Sobre el INSERT: la misma tripleta vive también en la lista del assert, y
    // una expectativa sobre el archivo entero casaría con ésa aunque la fila se
    // hubiera caído del sembrado. Lo enseñaron los mutantes M29 y M34.
    expect(insertDe(sql)).toMatch(/\('DIRECTOR_COMERCIAL',\s*'finanzas',\s*'ver'\)/i)
  })

  it('y NO le da `crear` ni `facturar`', () => {
    // `facturar` es dinero irreversible (zona R4) y `crear` es registrar pagos.
    // Lo que el dueño contestó el 29/09 es que VEA el margen para no firmar a
    // ciegas, no que cobre.
    expect(sql).not.toMatch(/\('DIRECTOR_COMERCIAL',\s*'finanzas',\s*'crear'\)/i)
    expect(sql).not.toMatch(/\('DIRECTOR_COMERCIAL',\s*'finanzas',\s*'facturar'\)/i)
  })

  it('y el GERENTE de ventas no recibe finanzas: es la única diferencia', () => {
    expect(sql).not.toMatch(/\('GERENTE_VENTAS',\s*'finanzas'/i)
  })
})

describe('5 · ninguna de las TRES se salta sola', () => {
  it('ninguna lleva la marca `@tipo: datos`', () => {
    // Con esa marca el runner las omite salvo `--con-datos`. La matriz reescribe
    // filas de `usuarios`, así que la tentación es marcarla — y sería el error:
    // una instancia se actualizaría con el enum puesto y la matriz sin sembrar,
    // o sea con cuatro roles que existen y no autorizan nada. Mismo criterio que
    // `20260819_semilla_rol_permisos.sql`, que lo dice en su cabecera.
    for (const archivo of [ENUM, MATRIZ, COSTEAR]) {
      expect(leer(archivo).split('\n', 1)[0], archivo).not.toMatch(/@tipo:\s*datos/i)
    }
  })
})
