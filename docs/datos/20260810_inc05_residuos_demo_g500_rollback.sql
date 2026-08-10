-- ===========================================================================
--  ROLLBACK de 20260810_inc05_residuos_demo_g500.sql
--
--  Devuelve los tres rotulos a lo que decian antes. Los valores viejos son los
--  que el propio script exige encontrar en su WHERE para aplicarse, asi que si
--  corrio, esto es literalmente lo que habia. Aun asi, contrastar con la salida
--  del PASO 0 antes de usarlo.
--
--  No devuelve nada a la bitacora: es append-only por trigger y una entrada de
--  auditoria no se borra porque se deshaga lo que registro. Se deja, y este
--  rollback anade la suya.
-- ===========================================================================

begin;

select set_config('app.tenant_id', '4cdba4aa-444d-4238-a983-959d18b1a2bf', false);

update tenants
   set nombre_comercial = 'DEMO PIXELED.'
 where id = '4cdba4aa-444d-4238-a983-959d18b1a2bf';

update creatividades
   set nombre = 'upsivale 1920.jpg'
 where id = 'c8765a73-9391-4fad-80b7-9399db80a413';

update usuarios
   set nombre = 'DEMO'
 where id = '86174026-3701-4c64-8000-08d53037d5df';

insert into acciones (accion, entidad, usuario_nombre, tenant_id)
values ('Revirtio la limpieza de residuos de demo (INC-05)',
        'nombre comercial, creativo de KFC y usuario DEMO',
        'Sistema',
        '4cdba4aa-444d-4238-a983-959d18b1a2bf');

commit;

-- Nota: revertir NO rompe nada del codigo. Los tres son textos que se imprimen;
-- ninguna ruta los valida ni los usa como llave.
