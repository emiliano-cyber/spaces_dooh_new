-- ============================================================================
-- Unicidad del contrato de una PANTALLA SUELTA.
--
-- Regla del negocio: un predio tiene UN contrato que comparten todas sus
-- pantallas; una pantalla sin predio tiene el suyo. Un mismo espacio no puede
-- tener dos acuerdos vivos con su propietario al mismo tiempo.
--
-- Eso estaba garantizado a medias. Los índices existentes cubren:
--   · `contratos_predio_activo_uq`   → un solo contrato activo POR PREDIO.
--   · `contratos_sitio_incompleto_uq`→ un solo pendiente INCOMPLETO por pantalla.
--
-- Entre los dos quedaba un hueco: un contrato ACTIVO anclado a la pantalla
-- (`predio_id` NULL) no lo cubría ninguno, así que una pantalla suelta podía
-- acumular N contratos vigentes a la vez. Y era invisible: hasta el arreglo de
-- hoy el P&L ni siquiera leía esos contratos, de modo que la duplicación no
-- aparecía por ningún lado. El flujo de aprobar propuesta los crea
-- (`campanas-repo.ts`, cuando la propuesta trae la renta capturada), así que
-- el hueco era alcanzable desde la aplicación, no teórico.
--
-- Lo que este índice NO puede expresar: que una pantalla no tenga a la vez el
-- contrato de su predio y uno propio. Eso cruza filas y tablas, así que no cabe
-- en un índice ni en un CHECK. Se sostiene por dos lados: el escritor ya busca
-- cobertura por predio antes de crear nada, y el lector (`contratoVigentePorSitio`
-- en lib/data/derive.ts) le da precedencia al del predio, de forma que la renta
-- nunca se suma dos veces aunque quedara una fila huérfana del histórico.
--
-- Sin CONCURRENTLY a propósito: la tabla tiene decenas de filas, no millones.
-- El bloqueo dura microsegundos y así la migración corre dentro de la
-- transacción, que es lo que la hace reversible de un solo golpe.
--
-- Aditiva e idempotente. No reescribe ninguna fila.
-- ============================================================================
begin;

-- Prerrequisito: si ya hubiera duplicados, el índice no puede crearse y la
-- migración debe fallar aquí con un mensaje claro en vez de un error opaco de
-- «could not create unique index».
do $$
declare n int;
begin
  select count(*) into n from (
    select sitio_id from contratos_arrendamiento
     where predio_id is null and estatus in ('VIGENTE','POR_VENCER','RENOVADO')
     group by sitio_id having count(*) > 1
  ) v;
  if n > 0 then
    raise exception
      'Hay % pantalla(s) con más de un contrato activo sin predio. Resuélvelos (cancelar el sobrante o asignarle predio) antes de aplicar esta migración.', n;
  end if;
end $$;

create unique index if not exists contratos_pantalla_activo_uq
  on contratos_arrendamiento (sitio_id)
  where predio_id is null and estatus in ('VIGENTE','POR_VENCER','RENOVADO');

comment on index contratos_pantalla_activo_uq is
  'Una pantalla suelta (sin predio) no puede tener dos contratos activos a la vez. El equivalente de contratos_predio_activo_uq para el otro anclaje.';

commit;

-- Verificación
select 'indice_creado' k,
       coalesce((select indexname from pg_indexes
                  where tablename = 'contratos_arrendamiento'
                    and indexname = 'contratos_pantalla_activo_uq'), '(FALTA)') v
union all
-- Debe ser 0 siempre: es lo que el índice garantiza a partir de ahora.
select 'pantallas_con_contrato_activo_duplicado', count(*)::text from (
  select sitio_id from contratos_arrendamiento
   where predio_id is null and estatus in ('VIGENTE','POR_VENCER','RENOVADO')
   group by sitio_id having count(*) > 1
) v
union all
select 'contratos_activos_por_pantalla', count(*)::text from contratos_arrendamiento
 where predio_id is null and estatus in ('VIGENTE','POR_VENCER','RENOVADO')
union all
select 'contratos_activos_por_predio', count(*)::text from contratos_arrendamiento
 where predio_id is not null and estatus in ('VIGENTE','POR_VENCER','RENOVADO')
union all
-- Los tres guardarraíles del módulo, para verlos juntos.
select 'indices_unicos_del_modulo', string_agg(indexname, ', ' order by indexname)
  from pg_indexes where tablename = 'contratos_arrendamiento' and indexdef like '%UNIQUE%';
