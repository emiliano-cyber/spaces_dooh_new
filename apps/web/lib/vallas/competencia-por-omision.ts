// ============================================================================
//  lib/vallas/competencia-por-omision.ts — LAS CATEGORÍAS QUE TRAE CADA
//  ORGANIZACIÓN (decisión del dueño, 19/11).
// ----------------------------------------------------------------------------
//  Marcas que compiten en México, para que la regla de competencia
//  (`reglas/competencia-marcas.ts`) avise desde el primer día. Son un punto de
//  partida: el Dueño las edita, añade o da de baja en /vallas.
//
//  La lista vive DOS veces, y es a propósito:
//   · aquí, para las organizaciones NUEVAS: `crearOrgConDueno`
//     (`lib/server/cuentas-controller.ts`) las siembra dentro de la misma
//     transacción del alta (`sembrarCompetenciaPorOmision`, vallas-repo);
//   · en `db/migrations/20261119_vallas_sembrar_competencia_por_omision.sql`, para las
//     organizaciones que YA existían. Una migración no puede importar TS.
//  `competencia-por-omision.test.ts` compara las dos: si una cambia sin la
//  otra, la prueba se pone roja. Y la migración ya aplicada NO se edita: si
//  la lista cambia, las organizaciones existentes la reciben por otra
//  migración nueva.
// ============================================================================

export type CategoriaPorOmision = { nombre: string; marcas: readonly string[] }

export const CATEGORIAS_COMPETENCIA_POR_OMISION: readonly CategoriaPorOmision[] = [
  { nombre: 'Refrescos de cola', marcas: ['Coca-Cola', 'Pepsi'] },
  { nombre: 'Tiendas departamentales', marcas: ['El Palacio de Hierro', 'Liverpool', 'Sears'] },
  { nombre: 'Telefonía', marcas: ['Telcel', 'AT&T', 'Movistar'] },
  { nombre: 'Bancos', marcas: ['BBVA', 'Banorte', 'Santander', 'Citibanamex', 'HSBC'] },
  { nombre: 'Cerveza', marcas: ['Grupo Modelo', 'Heineken México'] },
  { nombre: 'Comida rápida', marcas: ["McDonald's", 'Burger King', 'KFC', "Carl's Jr."] },
  { nombre: 'Pizzas', marcas: ["Domino's", 'Pizza Hut', 'Little Caesars'] },
  { nombre: 'Autoservicio', marcas: ['Walmart', 'Soriana', 'Chedraui', 'La Comer'] },
  { nombre: 'Tiendas de conveniencia', marcas: ['OXXO', '7-Eleven', 'Circle K'] },
  { nombre: 'Automotriz', marcas: ['Nissan', 'Volkswagen', 'Chevrolet', 'Toyota', 'KIA'] },
  { nombre: 'Streaming', marcas: ['Netflix', 'Disney+', 'Prime Video', 'Max'] },
  { nombre: 'Aerolíneas', marcas: ['Aeroméxico', 'Volaris', 'Viva Aerobus'] },
]
