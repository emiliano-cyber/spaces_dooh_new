-- @tipo: esquema
-- ============================================================================
--  VEND-01 · quien HIZO la propuesta, para poder medir sus descuentos.
-- ----------------------------------------------------------------------------
--  Un dueno pregunto si puede medir los descuentos que hace cada vendedor. La
--  auditoria midio la respuesta: no faltaba un reporte, FALTABA EL DATO.
--
--    · `propuestas` tenia 16 columnas y NINGUNA apuntaba a `usuarios`.
--    · `campanas` tenia 23 y tampoco.
--    · `usuario_id` existia en todo el esquema en DOS sitios: `sesiones` y la
--      bitacora `acciones`.
--
--  Usuarios y roles ya existian y funcionaban. Lo que faltaba era atar la
--  propuesta a quien la hizo.
--
--  ─── QUIEN ES EL VENDEDOR: QUIEN CREA LA PROPUESTA ────────────────────────
--  Decision del dueno, 2026-09-28. Se toma de la SESION en el servidor
--  (`propuestas-repo.ts`, por `usuarioActual()`, el mismo camino que
--  `tenantActual()`) y NUNCA del cuerpo de la peticion. Si viajara en el JSON,
--  cualquiera con permiso de `comercial.crear` podria atribuirse una venta
--  ajena --o cargarle a otro un descuento del 80 %-- con un `curl`, y no daria
--  ningun error: la propuesta se crearia igual y solo cambiaria el nombre en la
--  tabla del reporte.
--
--  Automatico, sin campo que rellenar y no falseable. Lo fijan
--  `propuestas-vendedor.test.ts` y `vendedor-en-propuesta.e2e.test.ts`.
--
--  ─── NULLABLE, Y ES LA DECISION QUE MAS IMPORTA ───────────────────────────
--  TODO lo ya capturado queda SIN VENDEDOR PARA SIEMPRE, y no hay de donde
--  deducirlo: la bitacora `acciones` guarda el NOMBRE de la propuesta como
--  texto libre (`entidad`), no su id, asi que ni siquiera un backfill a mano
--  podria casarlos sin inventar.
--
--  Por eso NO lleva DEFAULT ni NOT NULL. Rellenar con "alguien" --el primer
--  DUENO, el que corre la migracion-- convertiria una laguna en una AFIRMACION
--  FALSA, y encima sobre dinero: le acreditaria a una persona las ventas y los
--  descuentos de todos los demas. El reporte sabe pintar el hueco: sale en
--  «Sin vendedor», con su importe, y el aviso de cobertura dice cuanto es y que
--  NO se puede recuperar. Mismo criterio que el DEFAULT de tenant que retiro
--  `20260812_sin_default_tenant.sql`: un valor por omision inventado es la
--  deriva que nadie ve.
--
--  ─── `on delete set null` Y NO `restrict` ─────────────────────────────────
--  Se sigue el criterio que YA usa el esquema: las CINCO claves ajenas hacia
--  `usuarios` que no son la sesion --`acciones.usuario_id` (schema.sql:578),
--  `incidencias.reportado_por_usuario` (:320), `ordenes_trabajo.asignado_a`
--  (:483) y `.supervisor` (:484), `evidencias_ot.uploaded_by` (:510)-- son
--  todas `on delete set null`. Solo `sesiones` cascadea, y ahi la fila no
--  significa nada sin su usuario.
--
--  Y hay una razon dura, ademas de la coherencia: `borrarUsuario()` existe y se
--  usa (`usuarios-repo.ts:143`). Con `restrict`, el primer vendedor que hiciera
--  una propuesta quedaria IMBORRABLE y la pantalla de usuarios devolveria un
--  500 sin explicar por que. Con `set null` la atribucion se degrada a «Sin
--  vendedor» --el mismo hueco que el historico, pintado por el mismo
--  mecanismo-- en vez de bloquear una operacion legitima de administracion.
--
--  Lo que eso CUESTA, dicho con todas las letras: un vendedor que se va y se
--  borra SE LLEVA su atribucion. No se denormaliza su nombre --como si hace
--  `acciones.usuario_nombre`-- porque una propuesta es un registro VIVO y no
--  una linea de bitacora congelada: el nombre debe seguir al usuario cuando se
--  corrige, y una copia seria una segunda verdad que envejece. En la practica
--  la baja de un usuario es LOGICA (`usuarios.activo`), y una baja logica NO
--  toca esta columna. Queda como pregunta abierta para el dueno.
--
--  ─── LA FK ES PLANA (id), NO COMPUESTA (id, tenant_id) ────────────────────
--  El repositorio tiene el precedente contrario --`20260918_entidad_tenant_
--  compuesto.sql` repunto tres FK a la pareja porque una FK plana se comprueba
--  con los privilegios del DUENO de la tabla y ELUDE la RLS-- y aqui NO se
--  sigue, a proposito y con el motivo escrito:
--
--   1. Esa migracion exige `-- @pg-min: 15` por el `on delete set null
--      (columna)`, que es sintaxis de PostgreSQL 15. La flota NO esta toda en
--      15: g500 corre 14.24, y el guard del runner (codigo de salida 4) PARA
--      LA COLA ENTERA de esa base. Anadir un segundo bloqueo a 16 dias del
--      lanzamiento no compra seguridad, compra un despliegue imposible.
--   2. El agujero que la FK compuesta cierra aqui NO ES ALCANZABLE: `usuario_id`
--      no entra por el cuerpo de la peticion, sale de `usuarioActual()`, que es
--      la MISMA sesion de la que sale `tenantActual()`. Escribir un vendedor de
--      otra organizacion exigiria que las dos funciones discreparan sobre quien
--      esta conectado.
--   3. Y la LECTURA esta cerrada por su lado: el reporte lee `usuarios` con
--      `and tenant_id = $1`, y un `usuario_id` que apunte fuera NO llega a la
--      lista de vendedores --cae en «Sin vendedor» y ni su id se pinta--. Hay
--      prueba de eso (`reportes.vendedor.test.ts`, «R2 · el vendedor de otra
--      organizacion no existe para este reporte»).
--
--  `usuario_id` NO ES UNA FRONTERA DE SEGURIDAD. La unica sigue siendo
--  `tenant_id` con RLS. Cuando toda la flota este en PostgreSQL 15 esta FK
--  DEBE repuntarse a `(id, tenant_id)`; queda anotado en la bóveda.
--
--  ─── `campanas` NO LLEVA COLUMNA ──────────────────────────────────────────
--  Una campana nace de una propuesta (`campanas.propuesta_id`, schema.sql:392,
--  indexado en :407) pero tambien puede nacer suelta desde Comercial. El
--  vendedor se DEDUCE por ese join y no se copia:
--
--   · Copiarlo daria DOS verdades sobre el mismo hecho, y divergirian el dia
--     que alguien reasigne una propuesta o regenere una campana. Es el error de
--     raiz que este repo documenta en `lib/server/tenant.ts:87-89`.
--   · Y para la campana nacida en Comercial no habria a quien copiar: estampar
--     ahi a quien la TECLEO atribuiria una venta a un operador o a finanzas.
--     Eso es exactamente el dato falseable que esta tarea existe para evitar,
--     solo que falseado por descuido en vez de a proposito.
--
--  Esas campanas salen en «Sin vendedor», contadas aparte de las historicas,
--  porque sus dos huecos tienen causas distintas: una se arregla vendiendo por
--  propuesta, la otra no se arregla nunca.
--
--  Aditiva e idempotente. NO toca ninguna fila existente ni `db/schema.sql`, y
--  no edita ninguna migracion anterior. No mueve ni un importe.
-- ============================================================================
begin;

alter table propuestas
  add column if not exists usuario_id uuid;

-- La FK se crea aparte del `add column` para que la migracion sea idempotente
-- tambien a medias: si una corrida anterior murio entre las dos, la segunda no
-- falla por restriccion duplicada.
do $$ begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'propuestas_usuario_id_fkey'
       and conrelid = 'propuestas'::regclass
  ) then
    alter table propuestas
      add constraint propuestas_usuario_id_fkey
      foreign key (usuario_id) references usuarios (id) on delete set null;
  end if;
end $$;

-- El reporte por vendedor agrupa por esta columna dentro de una organizacion, y
-- `borrarUsuario()` obliga a recorrerla entera para poner los nulos. Compuesto
-- con `tenant_id` porque TODA lectura de este repo lleva su `and tenant_id`:
-- un indice solo sobre `usuario_id` no serviria a esa consulta.
create index if not exists idx_propuestas_usuario
  on propuestas (usuario_id, tenant_id);

comment on column propuestas.usuario_id is
  'VEND-01. El VENDEDOR: el usuario en cuya sesion se creo la propuesta. Lo estampa propuestas-repo.ts desde usuarioActual(), NUNCA desde el cuerpo de la peticion. NULL = propuesta anterior al 2026-09-28, o vendedor borrado: no se puede recuperar, y el reporte lo pinta como «Sin vendedor» con su aviso de cobertura, nunca como un cero.';

commit;

-- ─── Verificacion ──────────────────────────────────────────────────────────
-- La tercera fila es la que importa el dia del despliegue: dice CUANTAS
-- propuestas se quedan sin vendedor para siempre. No es un error, es la cifra
-- que el aviso de cobertura del reporte va a enseñar.
select 'propuestas.usuario_id existe' k, count(*)::text v
  from information_schema.columns
 where table_name = 'propuestas' and column_name = 'usuario_id'
union all
select 'la FK es on delete set null',
       count(*)::text
  from pg_constraint
 where conname = 'propuestas_usuario_id_fkey'
   and confdeltype = 'n'
union all
select 'propuestas historicas SIN vendedor (no se puede recuperar)',
       count(*)::text
  from propuestas where usuario_id is null;
