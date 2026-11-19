# ADR 0052: Vallas — un módulo encima de `sitios`, con reglas de negocio enchufables

- **Fecha:** 2026-11-19
- **Estado:** **Propuesta.** Es ROJO R3 (migración `20261119_vallas_esqueleto.sql`). El dueño
  aprobó aplicarla en LOCAL (`spaces_hoy`) para probarla el 19/11; a servidores, pendiente.
- **Rama:** `feat/vallas-esqueleto`, desde `integra/18-11` `18cbad3e`.
- **Nota:** `vault/02-Backend/vallas.md`.

## Contexto

El dueño pidió un módulo de vallas publicitarias donde ir sumando reglas de negocio. Las dos
primeras: no poner marcas que compiten en la misma valla (o en el grupo que forma una imagen) en
las mismas fechas, y la doble numeración (por cuadro y por grupo, con su medida y su modo
«una sola imagen» o «separadas»).

El inventario ya tiene sitios de tipo `VALLA` con ancho, alto y caras, y las campañas ya tienen
`marca`. Las reservas son por sitio.

## Decisión

1. **Una valla es un cuadro dentro de un sitio**: tabla `vallas` con FK compuesta a
   `sitios(id, tenant_id)`. No se duplica nada del sitio. Los grupos (`vallas_grupos`) llevan su
   propio número, su medida total y su modo.
2. **La competencia es un catálogo de categorías con marcas en texto**
   (`competencia_categorias.marcas text[]`) que se compara normalizado contra `campanas.marca`.
   No se crea una tabla de marcas mientras la campaña guarde la marca como texto.
3. **Las reglas son código puro en `lib/vallas/reglas/`**, con un contrato común (`Regla` →
   `Hallazgo { nivel: 'bloqueo' | 'aviso' }`), un registro (`REGLAS`) y un evaluador que corre
   todas. Leer la base es trabajo del repo (`contextoParaVerificar`); decidir si algo se guarda es
   de quien llama.
4. **Permisos de `inventario`** y entrada en el grupo Inventario del menú. Sin módulo nuevo.
5. **La competencia no se engancha todavía a la reserva** (dinero, R4): se expone
   `POST /api/vallas/verificar` y la reserva se conecta cuando sepa en qué valla cae.

## Consecuencias

- Una regla nueva es un archivo y una línea en `REGLAS`, con su prueba unitaria sin base.
- Mientras las reservas sean por sitio, una reserva ocupa todas las vallas de su sitio: la regla
  puede avisar de más, nunca de menos.
- El nivel y el alcance viven en código; si cada organización debe poder cambiarlos, irán a
  `config_negocio` en otra migración.
