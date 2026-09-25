import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  UNA IMAGEN PUBLICADA TIENE QUE PODER DECIR DE QUE COMMIT SALIO.
// ----------------------------------------------------------------------------
//  B36, abierta el 2026-09-25. El 14/09 el registry tenia DOS imagenes distintas
//  con la misma etiqueta `v0.5.0` (`d46c3aed…` y `60c7b194…`). El diagnostico
//  costo dos dias porque una imagen no llevaba encima su commit: no habia forma
//  de preguntarselo, hubo que deducirlo. El arreglo es que `release.yml` escriba
//  las etiquetas OCI estandar en el `docker build`.
//
//  CUAN FUERTE ES ESTA PRUEBA, dicho sin adornos: es DEBIL. Lee el texto de un
//  YAML y comprueba que las banderas estan escritas donde tienen que estar. NO
//  construye ninguna imagen, asi que NO puede demostrar que docker las aplique
//  ni que sobrevivan al `crane copy` de `promover.yml`. Lo unico que atrapa es
//  que alguien borre o desconecte las banderas al editar el workflow -- que es
//  precisamente el modo de fallo que esta advertencia deja detras, porque el
//  workflow solo se ejecuta al publicar y nadie lo ve fallar antes.
//
//  Lo que SI se midio de verdad, y esta escrito en B36: un `docker build` local
//  con estas mismas cuatro banderas, y las etiquetas leidas con
//  `docker inspect` sobre la imagen resultante.
//
//  Mismo criterio que `imagen-publicacion.test.ts`, que lee el `Dockerfile` por
//  el mismo motivo: no sustituye a construir, pero atrapa el olvido en
//  `npm test`, que es donde sale barato.
// ============================================================================

const RAIZ = join(__dirname, '..', '..', '..')
const RELEASE = readFileSync(join(RAIZ, '.github', 'workflows', 'release.yml'), 'utf8')

// El bloque del `docker build`, no el archivo entero: que la cadena aparezca en
// un comentario no vale de nada. Se toma desde `docker build \` hasta la linea
// que cierra la orden con el contexto (`.` a solas).
function ordenDeBuild(): string {
  const lineas = RELEASE.split(/\r?\n/)
  const inicio = lineas.findIndex((l) => /^\s*docker build\s*\\\s*$/.test(l))
  expect(inicio, 'no se encontro la orden `docker build \\` en release.yml').toBeGreaterThan(-1)
  const resto = lineas.slice(inicio)
  const fin = resto.findIndex((l, i) => i > 0 && /^\s*\.\s*$/.test(l))
  expect(fin, 'la orden `docker build` no cierra con el contexto `.`').toBeGreaterThan(0)
  return resto.slice(0, fin + 1).join('\n')
}

describe('la imagen publicada lleva encima de que commit salio (B36)', () => {
  it('el `docker build` sella el SHA del commit como `org.opencontainers.image.revision`', () => {
    // La imprescindible. Sin esta, B36 sigue abierta entera.
    expect(ordenDeBuild()).toMatch(
      /--label\s+"org\.opencontainers\.image\.revision=\$REVISION"/,
    )
  })

  it('`REVISION` sale de `github.sha` y no de un valor escrito a mano', () => {
    // El valor viaja como variable de entorno, no interpolado dentro del texto
    // del script: el motivo esta en la cabecera de `release.yml` y en
    // `deploy.yml:70-102`. Un `${{ }}` dentro de un `run:` se sustituye antes de
    // que exista el shell.
    expect(RELEASE).toMatch(/REVISION:\s*\$\{\{\s*github\.sha\s*\}\}/)
  })

  it('sella tambien la version, el repositorio de origen y el instante del build', () => {
    const orden = ordenDeBuild()
    // `version`: el nombre del tag SELLADO DENTRO. La etiqueta del registry se
    // puede mover -- la vieja `v0.5.0` acabo renombrada `v0.5.0-09sep` -- y esta
    // viaja con el digest, asi que delata el renombrado.
    expect(orden).toMatch(/--label\s+"org\.opencontainers\.image\.version=\$VERSION"/)
    // `source`: un SHA suelto no dice donde buscarlo, y este proyecto tiene DOS
    // remotos con uno muerto (`CLAUDE.md` §6).
    expect(orden).toMatch(/--label\s+"org\.opencontainers\.image\.source=\$FUENTE"/)
    // `created`: el registry guarda la hora del PUSH, que no es la del build.
    expect(orden).toMatch(/--label\s+"org\.opencontainers\.image\.created=\$CREADA"/)
  })

  it('el repositorio de origen se DERIVA del contexto: ningun valor real quemado', () => {
    // `CLAUDE.md` lo prohibe en archivos versionados: ni dominios, ni IPs, ni el
    // nombre del registry. Aqui el unico valor que parece una URL se arma con
    // `github.server_url` y `github.repository`.
    expect(RELEASE).toMatch(
      /FUENTE:\s*\$\{\{\s*github\.server_url\s*\}\}\/\$\{\{\s*github\.repository\s*\}\}/,
    )
    const orden = ordenDeBuild()
    expect(orden, 'hay una URL literal dentro del `docker build`').not.toMatch(/https?:\/\//)
  })

  it('ninguna etiqueta se publica con un relleno tipo `desconocida`', () => {
    // Una etiqueta que existe y no dice nada es PEOR que una ausente: la
    // ausencia significa «esta imagen no salio del pipeline», que es justo lo
    // que interesa distinguir. Es el motivo de no usar `ARG` con valor por
    // omision en el `Dockerfile`.
    const orden = ordenDeBuild()
    expect(orden).not.toMatch(/--label[^\n]*=\s*(desconocida|unknown|TODO)/i)
  })

  it('el workflow LEE la etiqueta que acaba de escribir, y antes de publicar', () => {
    // Este repositorio ya pago caro afirmar como hecho algo que nadie midio (el
    // cierre en falso de F2.4 el 01/09). La comprobacion va ANTES del push: un
    // rojo ahi no deja nada publicado a medias.
    expect(RELEASE).toMatch(/docker inspect[\s\S]{0,200}org\.opencontainers\.image\.revision/)
    expect(RELEASE).toMatch(/\[\s*"\$LEIDA"\s*!=\s*"\$REVISION"\s*\]/)

    const posInspect = RELEASE.indexOf('Comprobar que la imagen sabe de que commit salio')
    const posPush = RELEASE.indexOf('Publicar en el canal beta')
    expect(posInspect).toBeGreaterThan(-1)
    expect(posPush).toBeGreaterThan(-1)
    expect(posInspect, 'la comprobacion tiene que ir ANTES del push').toBeLessThan(posPush)
  })

  it('el `Dockerfile` NO declara las mismas etiquetas: una sola fuente', () => {
    // Dos sitios declarando lo mismo divergen, y aqui el perdedor seria el
    // `Dockerfile` (el `--label` del build gana). Si algun dia se decide
    // moverlas alli, esta prueba se cambia a proposito en vez de quedar el
    // repositorio con las dos.
    const dockerfile = readFileSync(join(RAIZ, 'Dockerfile'), 'utf8')
    expect(dockerfile).not.toMatch(/org\.opencontainers\.image\./)
  })
})
