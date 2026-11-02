# Tabla de revisión · lote de inglés «Space Eyes»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/spaceeyes.ts` y de
los usos en el código (búsqueda literal de la clave). **984 claves**
(`spaceeyes.*`), rama `feat/ingles-space-eyes` (sale de `integra/ingles`,
`ec427a66`).

- **español** es la copia literal de lo que decía el componente antes del lote,
  comprobado comparando el HTML rendido de **95 estados de pantalla** con las
  fuentes de `ec427a66` y con las del lote, con la MISMA prueba
  (`lib/i18n/pantallas-spaceeyes.test.ts`, que con `I18N_VOLCAR=<carpeta>`
  vuelca el HTML español de cada estado): `diff -rq` vacío, 95 de 95.
- `␣` marca un espacio al principio o al final: es intencional, el texto va
  pegado a otro nodo.
- Los huecos `{nombre}` se rellenan en tiempo de ejecución con datos o con
  elementos (`interpolarNodos`). Ninguna cifra de dinero vive en el
  diccionario (el lote no pinta dinero).
- «qué es» lo asigna una heurística sobre cada línea de uso; si discrepa de lo
  que se ve en pantalla, manda la pantalla. «sin uso directo» son claves que se
  eligen desde un mapa (`ESTADO`, `ORIGENES`, `FRECUENCIA`…) declarado en el
  mismo archivo, o el texto de `comoSeActualiza`.
- Las fechas pasan por `fechaHora(…, idioma)` (`piezas.tsx`): en inglés usa
  `formatFechaHora(…, 'en')`, «Dec 1, 2026, 3:45 PM»; el español sigue
  «02 nov 2026, 18:00». Las horas de las gráficas y la próxima foto usan
  `en-US` / `es-MX`. No están en el diccionario.
- Claves de otros lotes que el lote reutiliza (no salen en esta tabla):
  `comercial.eye.confianza`, `comercial.eye.correcto`, `comercial.eye.no-coincide`, `comun.cancelar`, `comun.cargando`, `comun.cerrar`, `comun.guardar`. El veredicto de la foto usa las de `comercial.eye.*` a propósito:
  la misma foto dice lo mismo en la ficha comercial y en la de Space Eyes.

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `spaceeyes.hace.nunca` | `components/demo/space-eyes/piezas.tsx:26` | texto de una función (lib o componente) | nunca | never |
| `spaceeyes.hace.segundos` | `components/demo/space-eyes/piezas.tsx:30` | texto de una función (lib o componente) | hace segundos | seconds ago |
| `spaceeyes.hace.min` | `components/demo/space-eyes/piezas.tsx:31` | texto de una función (lib o componente) | hace {n} min | {n} min ago |
| `spaceeyes.hace.h` | `components/demo/space-eyes/piezas.tsx:33` | texto de una función (lib o componente) | hace {n} h | {n} h ago |
| `spaceeyes.hace.d` | `components/demo/space-eyes/piezas.tsx:35` | texto de una función (lib o componente) | hace {n} d | {n} d ago |
| `spaceeyes.hace.semanas` | `components/demo/space-eyes/piezas.tsx:36` | texto de una función (lib o componente) | hace {n} semanas | {n} weeks ago |
| `spaceeyes.comun.sin-dato` | `components/demo/space-eyes/EquipoAdmin.tsx:489`<br>`components/demo/space-eyes/FichaEquipo.tsx:793`<br>`components/demo/space-eyes/FichaEquipo.tsx:803`<br>`components/demo/space-eyes/Historial.tsx:265`<br>`components/demo/space-eyes/Historial.tsx:286`<br>`components/demo/space-eyes/Historial.tsx:287`<br>… | texto de una función (lib o componente) · texto en pantalla | sin dato | no data |
| `spaceeyes.senal.buena` | `components/demo/space-eyes/DemoSpaceEyes.tsx:123`<br>`components/demo/space-eyes/piezas.tsx:92` | etiqueta de un valor (mapa de claves) · texto de una función (lib o componente) | buena | good |
| `spaceeyes.senal.regular` | `components/demo/space-eyes/DemoSpaceEyes.tsx:124`<br>`components/demo/space-eyes/piezas.tsx:93` | etiqueta de un valor (mapa de claves) · texto de una función (lib o componente) | regular | fair |
| `spaceeyes.senal.debil` | `components/demo/space-eyes/piezas.tsx:94` | texto de una función (lib o componente) | débil | weak |
| `spaceeyes.senal.movil` | `components/demo/space-eyes/DemoSpaceEyes.tsx:263`<br>`components/demo/space-eyes/FichaEquipo.tsx:616`<br>`components/demo/space-eyes/Graficas.tsx:520`<br>`components/demo/space-eyes/piezas.tsx:115` | texto en pantalla | Móvil | Mobile |
| `spaceeyes.conexion.en-linea` | `components/demo/space-eyes/DemoSpaceEyes.tsx:247`<br>`components/demo/space-eyes/ListaEquipos.tsx:163`<br>`components/demo/space-eyes/piezas.tsx:146` | rótulo · texto en pantalla | En línea | Online |
| `spaceeyes.conexion.pendiente` | `components/demo/space-eyes/piezas.tsx:146` | texto en pantalla | Pendiente de vincular | Pending pairing |
| `spaceeyes.conexion.sin` | `components/demo/space-eyes/DemoSpaceEyes.tsx:247`<br>`components/demo/space-eyes/ListaEquipos.tsx:168`<br>`components/demo/space-eyes/piezas.tsx:146` | rótulo · texto en pantalla | Sin comunicación | Not reporting |
| `spaceeyes.visor.completo` | `components/demo/space-eyes/piezas.tsx:308` | texto en pantalla | Abrir en tamaño completo | Open full size |
| `spaceeyes.sin-respuesta.titulo` | `components/demo/space-eyes/SinRespuesta.tsx:26` | rótulo | El servicio de cámaras no responde en este momento | The camera service is not responding right now |
| `spaceeyes.sin-respuesta.texto` | `components/demo/space-eyes/SinRespuesta.tsx:28` | texto en pantalla | Tus equipos siguen trabajando en los sitios: lo que tomen mientras tanto aparecerá aquí en cuanto el servicio vuelva. Suele resolverse solo en unos minutos (por ejemplo, durante una actualización). | Your devices keep working on site: anything they capture in the meantime will show up here as soon as the service is back. It usually sorts itself out within a few minutes (for example, during an update). |
| `spaceeyes.sin-respuesta.reintentar` | `components/demo/space-eyes/SinRespuesta.tsx:41` | texto en pantalla | Volver a intentar | Try again |
| `spaceeyes.sin-respuesta.soporte` | `components/demo/space-eyes/SinRespuesta.tsx:43` | texto en pantalla | Si sigue así más de una hora, avisa a soporte desde Administración › Configuración › Soporte. | If it stays like this for more than an hour, contact support from Settings › Configuration › Support. |
| `spaceeyes.solicitudes.titulo` | `components/demo/space-eyes/SolicitudesActivacion.tsx:68` | rótulo | Solicitudes de activación de Space Eyes | Space Eyes activation requests |
| `spaceeyes.solicitudes.ninguna` | `components/demo/space-eyes/SolicitudesActivacion.tsx:71` | texto en pantalla | Ninguna pendiente | None pending |
| `spaceeyes.solicitudes.pendientes.uno` | `components/demo/space-eyes/SolicitudesActivacion.tsx:72` | texto en pantalla | {n} pendiente(s) | {n} pending |
| `spaceeyes.solicitudes.pendientes.otros` | `components/demo/space-eyes/SolicitudesActivacion.tsx:72` | texto en pantalla | {n} pendiente(s) | {n} pending |
| `spaceeyes.solicitudes.vacio` | `components/demo/space-eyes/SolicitudesActivacion.tsx:77` | texto en pantalla | Cuando una empresa pida Space Eyes desde su demostración, aparece aquí con la orden para activarlo. | When a company requests Space Eyes from its demo, it shows up here with the command to activate it. |
| `spaceeyes.solicitudes.folio` | `components/demo/space-eyes/SolicitudesActivacion.tsx:87` | texto en pantalla | ␣· folio {folio} | ␣· ticket {folio} |
| `spaceeyes.solicitudes.copiada` | `components/demo/space-eyes/SolicitudesActivacion.tsx:99` | texto en pantalla | Copiada | Copied |
| `spaceeyes.solicitudes.copiar` | `components/demo/space-eyes/SolicitudesActivacion.tsx:99` | texto en pantalla | Copiar orden | Copy command |
| `spaceeyes.solicitudes.pie` | `components/demo/space-eyes/SolicitudesActivacion.tsx:106` | texto en pantalla | La orden se corre en el padre y pide la frase de paso de la llave de licencias. La empresa ve Space Eyes en unos 15 minutos. Después, cierra su ticket en el {panel}. | The command runs on the parent server and asks for the license key passphrase. The company sees Space Eyes in about 15 minutes. Then close its ticket in the {panel}. |
| `spaceeyes.solicitudes.panel` | `components/demo/space-eyes/SolicitudesActivacion.tsx:109` | texto en pantalla | panel de tickets | ticket panel |
| `spaceeyes.ficha.no-encontrado` | `components/demo/space-eyes/FichaEquipo.tsx:246`<br>`app/(app)/(shell)/space-eyes/[id]/page.tsx:17` | texto en pantalla | Equipo no encontrado | Device not found |
| `spaceeyes.pagina.id-invalido` | `app/(app)/(shell)/space-eyes/[id]/page.tsx:18` | texto en pantalla | La dirección no corresponde a ningún equipo Space Eyes. | This address does not match any Space Eyes device. |
| `spaceeyes.demo.ejemplo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:51` | texto en pantalla | EJEMPLO | EXAMPLE |
| `spaceeyes.demo.anuncio.a1` | `components/demo/space-eyes/DemoSpaceEyes.tsx:64` | texto en pantalla | TU MARCA | YOUR BRAND |
| `spaceeyes.demo.anuncio.a2` | `components/demo/space-eyes/DemoSpaceEyes.tsx:64` | texto en pantalla | AQUÍ | HERE |
| `spaceeyes.demo.anuncio.b1` | `components/demo/space-eyes/DemoSpaceEyes.tsx:65` | texto en pantalla | OFERTA | SEASONAL |
| `spaceeyes.demo.anuncio.b2` | `components/demo/space-eyes/DemoSpaceEyes.tsx:65` | texto en pantalla | DE TEMPORADA | OFFER |
| `spaceeyes.demo.anuncio.c1` | `components/demo/space-eyes/DemoSpaceEyes.tsx:66` | texto en pantalla | NUEVO | NEW |
| `spaceeyes.demo.anuncio.c2` | `components/demo/space-eyes/DemoSpaceEyes.tsx:66` | texto en pantalla | LANZAMIENTO | LAUNCH |
| `spaceeyes.demo.ilustracion` | `components/demo/space-eyes/DemoSpaceEyes.tsx:72` | etiqueta accesible (aria-label) | Ilustración de un espectacular de ejemplo | Illustration of a sample billboard |
| `spaceeyes.demo.falla-franja` | `components/demo/space-eyes/DemoSpaceEyes.tsx:104` | texto en pantalla | Varios gabinetes apagados · Gabinetes 4, 9 (2 de 15) | Several cabinets off · Cabinets 4, 9 (2 of 15) |
| `spaceeyes.demo.equipo.a` | `components/demo/space-eyes/DemoSpaceEyes.tsx:123` | etiqueta de un valor (mapa de claves) | Av. Principal 120 · Cara A | 120 Main Ave. · Side A |
| `spaceeyes.demo.equipo.b` | `components/demo/space-eyes/DemoSpaceEyes.tsx:124` | etiqueta de un valor (mapa de claves) | Blvd. del Parque · Cara B | Park Blvd. · Side B |
| `spaceeyes.demo.equipo.c` | `components/demo/space-eyes/DemoSpaceEyes.tsx:125` | etiqueta de un valor (mapa de claves) | Glorieta Norte | North Roundabout |
| `spaceeyes.demo.ciudad` | `components/demo/space-eyes/DemoSpaceEyes.tsx:256` | texto en pantalla | Ciudad de ejemplo | Sample city |
| `spaceeyes.demo.hace.2min` | `components/demo/space-eyes/DemoSpaceEyes.tsx:123`<br>`components/demo/space-eyes/DemoSpaceEyes.tsx:145` | etiqueta de un valor (mapa de claves) · texto en pantalla | hace 2 min | 2 min ago |
| `spaceeyes.demo.hace.5min` | `components/demo/space-eyes/DemoSpaceEyes.tsx:124` | etiqueta de un valor (mapa de claves) | hace 5 min | 5 min ago |
| `spaceeyes.demo.hace.2h` | `components/demo/space-eyes/DemoSpaceEyes.tsx:125` | etiqueta de un valor (mapa de claves) | hace 2 h | 2 h ago |
| `spaceeyes.demo.historial.1` | `components/demo/space-eyes/DemoSpaceEyes.tsx:129` | etiqueta de un valor (mapa de claves) | Foto programada tomada | Scheduled photo taken |
| `spaceeyes.demo.historial.2` | `components/demo/space-eyes/DemoSpaceEyes.tsx:130` | etiqueta de un valor (mapa de claves) | Creativo nuevo detectado en la pantalla: se guardó su foto | New creative detected on the screen: its photo was saved |
| `spaceeyes.demo.historial.3` | `components/demo/space-eyes/DemoSpaceEyes.tsx:131` | etiqueta de un valor (mapa de claves) | Falla: 2 gabinetes apagados (con foto de evidencia) | Fault: 2 cabinets off (with an evidence photo) |
| `spaceeyes.demo.historial.4` | `components/demo/space-eyes/DemoSpaceEyes.tsx:132` | etiqueta de un valor (mapa de claves) | Falla recuperada: el equipo vio la pantalla completa otra vez | Fault cleared: the device saw the whole screen again |
| `spaceeyes.demo.historial.5` | `components/demo/space-eyes/DemoSpaceEyes.tsx:133` | etiqueta de un valor (mapa de claves) | Foto pedida desde la oficina, recibida en 9 segundos | Photo requested from the office, received in 9 seconds |
| `spaceeyes.demo.beneficio.1.titulo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:137` | rótulo | Prueba de exhibición | Proof of display |
| `spaceeyes.demo.beneficio.1.texto` | `components/demo/space-eyes/DemoSpaceEyes.tsx:137` | rótulo | Fotos con fecha, hora y ubicación de cada anuncio al aire, listas para enviar al cliente. | Photos with the date, time and location of every ad on air, ready to send to the client. |
| `spaceeyes.demo.beneficio.2.titulo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:138` | rótulo | Fallas antes que el cliente | Faults before the client sees them |
| `spaceeyes.demo.beneficio.2.texto` | `components/demo/space-eyes/DemoSpaceEyes.tsx:138` | rótulo | El equipo detecta gabinetes apagados o una pantalla congelada y avisa con la foto del problema. | The device detects cabinets that are off or a frozen screen and alerts you with a photo of the problem. |
| `spaceeyes.demo.beneficio.3.titulo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:139` | rótulo | Menos visitas al sitio | Fewer site visits |
| `spaceeyes.demo.beneficio.3.texto` | `components/demo/space-eyes/DemoSpaceEyes.tsx:139` | rótulo | Foto o vista en vivo desde la oficina cuando la necesites, sin mandar a nadie. | A photo or the live view from the office whenever you need it, without sending anyone. |
| `spaceeyes.demo.beneficio.4.titulo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:140` | rótulo | Qué estuvo al aire | What was on air |
| `spaceeyes.demo.beneficio.4.texto` | `components/demo/space-eyes/DemoSpaceEyes.tsx:140` | rótulo | Cada creativo nuevo que aparece en la pantalla queda registrado con su foto. | Every new creative that appears on the screen is logged with its photo. |
| `spaceeyes.demo.estado.conexion` | `components/demo/space-eyes/DemoSpaceEyes.tsx:144` | texto en pantalla | Conexión | Connection |
| `spaceeyes.demo.estado.conexion.v` | `components/demo/space-eyes/DemoSpaceEyes.tsx:144` | texto en pantalla | En línea · Móvil, señal buena | Online · Mobile, good signal |
| `spaceeyes.demo.estado.ultima` | `components/demo/space-eyes/DemoSpaceEyes.tsx:145` | texto en pantalla | Última comunicación | Last report |
| `spaceeyes.demo.estado.bateria` | `components/demo/space-eyes/DemoSpaceEyes.tsx:146` | texto en pantalla | Batería | Battery |
| `spaceeyes.demo.estado.bateria.v` | `components/demo/space-eyes/DemoSpaceEyes.tsx:146` | texto en pantalla | 92 % · cargando | 92% · charging |
| `spaceeyes.demo.estado.temperatura` | `components/demo/space-eyes/DemoSpaceEyes.tsx:147` | texto en pantalla | Temperatura | Temperature |
| `spaceeyes.demo.estado.temperatura.v` | `components/demo/space-eyes/DemoSpaceEyes.tsx:147` | texto en pantalla | 38 °C | 38 °C |
| `spaceeyes.demo.estado.datos` | `components/demo/space-eyes/DemoSpaceEyes.tsx:148` | texto en pantalla | Datos este mes | Data this month |
| `spaceeyes.demo.estado.datos.v` | `components/demo/space-eyes/DemoSpaceEyes.tsx:148` | texto en pantalla | 312 MB | 312 MB |
| `spaceeyes.demo.estado.vigilancia` | `components/demo/space-eyes/DemoSpaceEyes.tsx:149` | texto en pantalla | Vigilancia de la pantalla | Screen monitoring |
| `spaceeyes.demo.estado.vigilancia.v` | `components/demo/space-eyes/DemoSpaceEyes.tsx:149` | texto en pantalla | Encendida · 15 gabinetes | On · 15 cabinets |
| `spaceeyes.demo.enviada` | `components/demo/space-eyes/DemoSpaceEyes.tsx:187` | texto en pantalla | Solicitud enviada | Request sent |
| `spaceeyes.demo.solicitar` | `components/demo/space-eyes/DemoSpaceEyes.tsx:187` | texto en pantalla | Solicitar activación | Request activation |
| `spaceeyes.demo.sin-permiso` | `components/demo/space-eyes/DemoSpaceEyes.tsx:190` | texto en pantalla | Para activarlo, pide a un administrador de tu empresa que lo solicite desde esta misma pantalla. | To activate it, ask an admin at your company to request it from this same screen. |
| `spaceeyes.demo.listo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:194` | texto en pantalla | Listo: recibimos tu solicitud y te contactaremos. Puedes seguirla en Administración › Configuración › Soporte. | Done: we received your request and will get in touch. You can follow it in Settings › Configuration › Support. |
| `spaceeyes.demo.listo.folio` | `components/demo/space-eyes/DemoSpaceEyes.tsx:194` | texto en pantalla | Listo: recibimos tu solicitud (folio {folio}) y te contactaremos. Puedes seguirla en Administración › Configuración › Soporte. | Done: we received your request (ticket {folio}) and will get in touch. You can follow it in Settings › Configuration › Support. |
| `spaceeyes.demo.error` | `components/demo/space-eyes/DemoSpaceEyes.tsx:197` | texto en pantalla | No se pudo enviar la solicitud. Inténtalo de nuevo en unos minutos. | The request could not be sent. Try again in a few minutes. |
| `spaceeyes.demo.aviso` | `components/demo/space-eyes/DemoSpaceEyes.tsx:207` | texto en pantalla | Estás viendo una {demo} con datos de ejemplo. Tu empresa todavía no tiene Space Eyes activado; ninguno de estos equipos es tuyo. | You are viewing a {demo} with sample data. Your company does not have Space Eyes activated yet; none of these devices are yours. |
| `spaceeyes.demo.aviso.demo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:207` | texto en pantalla | demostración | demo |
| `spaceeyes.demo.titulo` | `components/demo/space-eyes/DemoSpaceEyes.tsx:217` | rótulo | Tus pantallas, vistas desde el sitio, sin ir al sitio | Your screens, seen from the site, without going to the site |
| `spaceeyes.demo.lema.1` | `components/demo/space-eyes/DemoSpaceEyes.tsx:219` | texto en pantalla | Incidencias reportadas antes de que voltee a ver el sitio. | Issues reported before anyone looks at the site. |
| `spaceeyes.demo.lema.2` | `components/demo/space-eyes/DemoSpaceEyes.tsx:221` | texto en pantalla | Campaña programática comprobada en cuanto se reproduce. | Programmatic campaigns verified as soon as they play. |
| `spaceeyes.demo.equipos` | `components/demo/space-eyes/DemoSpaceEyes.tsx:233` | texto en pantalla | Así se ven tus equipos | This is how your devices look |
| `spaceeyes.demo.caido` | `components/demo/space-eyes/DemoSpaceEyes.tsx:268` | texto en pantalla | Sin comunicación desde hace 2 h. Así se ve cuando un equipo deja de reportar: nunca se da por funcionando solo por estar registrado. | Not reporting for 2 h. This is how it looks when a device stops reporting: it is never assumed to be working just because it is registered. |
| `spaceeyes.demo.detalle` | `components/demo/space-eyes/DemoSpaceEyes.tsx:279` | texto en pantalla | El detalle de un equipo | A device up close |
| `spaceeyes.demo.captura` | `components/demo/space-eyes/DemoSpaceEyes.tsx:288` | texto en pantalla | Captura · 08:12 · con fecha, hora y nombre del sitio | Capture · 08:12 · with date, time and site name |
| `spaceeyes.demo.evidencia` | `components/demo/space-eyes/DemoSpaceEyes.tsx:297` | texto en pantalla | Evidencia de una falla, marcada por el propio equipo | Evidence of a fault, marked by the device itself |
| `spaceeyes.demo.estado` | `components/demo/space-eyes/DemoSpaceEyes.tsx:303` | texto en pantalla | Estado del equipo | Device status |
| `spaceeyes.demo.historial` | `components/demo/space-eyes/DemoSpaceEyes.tsx:318` | texto en pantalla | Historial y alertas de un día | A day of history and alerts |
| `spaceeyes.demo.beneficios` | `components/demo/space-eyes/DemoSpaceEyes.tsx:335` | texto en pantalla | Para qué le sirve a tu operación | What it does for your operation |
| `spaceeyes.demo.cierre` | `components/demo/space-eyes/DemoSpaceEyes.tsx:350` | texto en pantalla | ¿Lo quieres para tus pantallas? | Want it for your screens? |
| `spaceeyes.demo.cierre.texto` | `components/demo/space-eyes/DemoSpaceEyes.tsx:352` | texto en pantalla | Al activarlo, esta sección se convierte en la de tus equipos reales. No hay que configurar nada de tu empresa. | Once activated, this section becomes the one for your real devices. Nothing in your company needs to be configured. |
| `spaceeyes.comun.actualizar` | `components/demo/space-eyes/AltaDispositivo.tsx:607`<br>`components/demo/space-eyes/CampanasEyes.tsx:334`<br>`components/demo/space-eyes/EquipoAdmin.tsx:964`<br>`components/demo/space-eyes/FallasFlota.tsx:216`<br>`components/demo/space-eyes/Galeria.tsx:289`<br>`components/demo/space-eyes/Graficas.tsx:345`<br>… | etiqueta accesible (aria-label) · texto en pantalla | Actualizar | Refresh |
| `spaceeyes.comun.no-consultar` | `components/demo/space-eyes/AjustarTexto.tsx:160`<br>`components/demo/space-eyes/AjustarTexto.tsx:253`<br>`components/demo/space-eyes/FichaEquipo.tsx:113`<br>`components/demo/space-eyes/Graficas.tsx:242`<br>`components/demo/space-eyes/Graficas.tsx:359`<br>`components/demo/space-eyes/ListaEquipos.tsx:62`<br>… | mensaje de error · rótulo · texto en pantalla | No se pudo consultar Space Eyes | Could not reach Space Eyes |
| `spaceeyes.comun.sin-equipos` | `components/demo/space-eyes/AjustarTexto.tsx:259`<br>`components/demo/space-eyes/Graficas.tsx:371`<br>`components/demo/space-eyes/ListaEquipos.tsx:249` | texto en pantalla | Todavía no hay equipos Space Eyes dados de alta para esta cuenta. | There are no Space Eyes devices registered for this account yet. |
| `spaceeyes.comun.sin-pantalla` | `components/demo/space-eyes/FichaEquipo.tsx:286`<br>`components/demo/space-eyes/ListaEquipos.tsx:354` | texto en pantalla | sin pantalla asignada | no screen assigned |
| `spaceeyes.lista.descripcion` | `components/demo/space-eyes/ListaEquipos.tsx:125` | texto en pantalla | Los equipos que vigilan tus pantallas: qué están viendo y cómo están. | The devices that watch your screens: what they see and how they are doing. |
| `spaceeyes.alta.titulo` | `components/demo/space-eyes/AltaDispositivo.tsx:296`<br>`components/demo/space-eyes/ListaEquipos.tsx:140` | rótulo | Agregar dispositivo | Add device |
| `spaceeyes.lista.no-configurado` | `components/demo/space-eyes/ListaEquipos.tsx:148` | texto en pantalla | La integración con Space Eyes no está configurada en este entorno. | The Space Eyes integration is not configured in this environment. |
| `spaceeyes.lista.kpi.de-equipos` | `components/demo/space-eyes/ListaEquipos.tsx:165` | texto en pantalla | de {n} equipos | of {n} devices |
| `spaceeyes.lista.kpi.mas-10` | `components/demo/space-eyes/ListaEquipos.tsx:168` | rótulo | más de 10 min | over 10 min |
| `spaceeyes.lista.kpi.bateria` | `components/demo/space-eyes/ListaEquipos.tsx:170` | rótulo | Batería crítica | Critical battery |
| `spaceeyes.lista.kpi.bajo-20` | `components/demo/space-eyes/ListaEquipos.tsx:172` | texto en pantalla | bajo 20% | under 20% |
| `spaceeyes.lista.kpi.ultima` | `components/demo/space-eyes/ListaEquipos.tsx:176` | rótulo | Última captura | Last capture |
| `spaceeyes.lista.kpi.flota` | `components/demo/space-eyes/ListaEquipos.tsx:178` | texto en pantalla | de toda la flota | across the fleet |
| `spaceeyes.lista.kpi.sin-fotos` | `components/demo/space-eyes/ListaEquipos.tsx:178` | texto en pantalla | sin fotos todavía | no photos yet |
| `spaceeyes.lista.filtro.todos` | `components/demo/space-eyes/ListaEquipos.tsx:187` | texto en pantalla | Todos · {n} | All · {n} |
| `spaceeyes.lista.filtro.linea` | `components/demo/space-eyes/ListaEquipos.tsx:190` | texto en pantalla | En línea · {n} | Online · {n} |
| `spaceeyes.lista.filtro.atencion` | `components/demo/space-eyes/ListaEquipos.tsx:193` | texto en pantalla | Con atención · {n} | Need attention · {n} |
| `spaceeyes.lista.filtro.manual` | `components/demo/space-eyes/ListaEquipos.tsx:196` | texto en pantalla | Se actualizan a mano · {n} | Manual updates · {n} |
| `spaceeyes.lista.empresa` | `components/demo/space-eyes/ListaEquipos.tsx:203` | texto en pantalla | Empresa | Company |
| `spaceeyes.lista.empresas` | `components/demo/space-eyes/ListaEquipos.tsx:211` | texto en pantalla | Todas las empresas | All companies |
| `spaceeyes.lista.buscar` | `components/demo/space-eyes/ListaEquipos.tsx:227`<br>`components/demo/space-eyes/ListaEquipos.tsx:233` | texto de ejemplo (placeholder) · texto en pantalla | Buscar equipo o pantalla | Search device or screen |
| `spaceeyes.lista.sin-coincidencias` | `components/demo/space-eyes/ListaEquipos.tsx:250` | texto en pantalla | Ningún equipo coincide con el filtro. | No devices match the filter. |
| `spaceeyes.lista.alt-captura` | `components/demo/space-eyes/ListaEquipos.tsx:327` | texto alternativo de imagen | Última captura de {nombre} | Last capture from {nombre} |
| `spaceeyes.lista.sin-capturas` | `components/demo/space-eyes/ListaEquipos.tsx:331` | texto en pantalla | Sin capturas todavía | No captures yet |
| `spaceeyes.lista.actualizar.visita` | `components/demo/space-eyes/ListaEquipos.tsx:366` | texto en pantalla | Para actualizar necesita una visita | Needs a site visit to update |
| `spaceeyes.lista.actualizar.toque` | `components/demo/space-eyes/ListaEquipos.tsx:366` | texto en pantalla | Para actualizar pide un toque | Needs a confirmation on the phone to update |
| `spaceeyes.comun.equipo` | `components/demo/space-eyes/AjustarTexto.tsx:266`<br>`components/demo/space-eyes/AltaDispositivo.tsx:623`<br>`components/demo/space-eyes/FallasFlota.tsx:195`<br>`components/demo/space-eyes/FallasFlota.tsx:286`<br>`components/demo/space-eyes/FallasFlota.tsx:397`<br>`components/demo/space-eyes/FichaEquipo.tsx:361`<br>… | etiqueta accesible (aria-label) · etiqueta de un valor (mapa de claves) · rótulo · texto en pantalla | Equipo | Device |
| `spaceeyes.comun.modelo` | `components/demo/space-eyes/EquipoAdmin.tsx:313`<br>`components/demo/space-eyes/FichaEquipo.tsx:654` | rótulo · texto en pantalla | Modelo | Model |
| `spaceeyes.comun.almacenamiento` | `components/demo/space-eyes/EquipoAdmin.tsx:323`<br>`components/demo/space-eyes/FichaEquipo.tsx:657` | rótulo · texto en pantalla | Almacenamiento libre | Free storage |
| `spaceeyes.comun.descargar` | `components/demo/space-eyes/FichaEquipo.tsx:504`<br>`components/demo/space-eyes/Galeria.tsx:692` | etiqueta accesible (aria-label) · texto en pantalla | Descargar | Download |
| `spaceeyes.comun.tomar-foto` | `components/demo/space-eyes/FichaEquipo.tsx:311`<br>`components/demo/space-eyes/VistaEnVivo.tsx:767`<br>`components/demo/space-eyes/VistaEnVivo.tsx:768` | etiqueta accesible (aria-label) · texto en pantalla · título / tooltip | Tomar foto | Take photo |
| `spaceeyes.comun.pidiendo` | `components/demo/space-eyes/FichaEquipo.tsx:310`<br>`components/demo/space-eyes/VistaEnVivo.tsx:657` | texto en pantalla | Pidiendo… | Requesting… |
| `spaceeyes.comun.no-pedir-foto` | `components/demo/space-eyes/FichaEquipo.tsx:189`<br>`components/demo/space-eyes/VistaEnVivo.tsx:579` | aviso emergente (toast) · aviso en pantalla | No se pudo pedir la foto | Could not request the photo |
| `spaceeyes.ficha.llego` | `components/demo/space-eyes/FichaEquipo.tsx:170` | texto en pantalla | Llegó la foto: es la que estás viendo. | The photo arrived: it is the one you are looking at. |
| `spaceeyes.ficha.no-llego` | `components/demo/space-eyes/FichaEquipo.tsx:184` | aviso en pantalla | La foto no ha llegado todavía. La orden sigue en pie: el equipo la subirá en cuanto pueda. | The photo has not arrived yet. The request still stands: the device will upload it as soon as it can. |
| `spaceeyes.ficha.no-leer-imagen` | `components/demo/space-eyes/FichaEquipo.tsx:211` | mensaje de error | No se pudo leer la imagen | Could not read the image |
| `spaceeyes.ficha.no-subir` | `components/demo/space-eyes/FichaEquipo.tsx:222` | aviso en pantalla | No se pudo subir la foto | Could not upload the photo |
| `spaceeyes.ficha.no-abrir` | `components/demo/space-eyes/FichaEquipo.tsx:245` | texto en pantalla | No se pudo abrir el equipo | Could not open the device |
| `spaceeyes.ficha.esperando` | `components/demo/space-eyes/FichaEquipo.tsx:308` | texto en pantalla | Esperando la foto… | Waiting for the photo… |
| `spaceeyes.ficha.subir.sin-pantalla` | `components/demo/space-eyes/FichaEquipo.tsx:328` | título / tooltip | Este equipo no tiene una pantalla asignada donde guardar la foto | This device has no assigned screen to store the photo |
| `spaceeyes.ficha.subir` | `components/demo/space-eyes/FichaEquipo.tsx:331` | texto en pantalla | Subir foto | Upload photo |
| `spaceeyes.ficha.actualizar-estado` | `components/demo/space-eyes/FichaEquipo.tsx:333` | etiqueta accesible (aria-label) | Actualizar estado | Refresh status |
| `spaceeyes.ficha.tab.fotos` | `components/demo/space-eyes/CampanasEyes.tsx:625`<br>`components/demo/space-eyes/FichaEquipo.tsx:358`<br>`components/demo/space-eyes/Programacion.tsx:506` | etiqueta de un valor (mapa de claves) · rótulo · texto en pantalla | Fotos | Photos |
| `spaceeyes.ficha.tab.creativos` | `components/demo/space-eyes/FichaEquipo.tsx:360` | etiqueta de un valor (mapa de claves) | Creativos | Creatives |
| `spaceeyes.ficha.captura` | `components/demo/space-eyes/FichaEquipo.tsx:375`<br>`components/demo/space-eyes/FichaEquipo.tsx:411`<br>`components/demo/space-eyes/FichaEquipo.tsx:484` | texto en pantalla | Captura Space Eyes | Space Eyes capture |
| `spaceeyes.ficha.cliente` | `components/demo/space-eyes/FichaEquipo.tsx:378`<br>`components/demo/space-eyes/FichaEquipo.tsx:403`<br>`components/demo/space-eyes/FichaEquipo.tsx:484` | texto en pantalla | Foto del cliente | Client photo |
| `spaceeyes.ficha.comparar` | `components/demo/space-eyes/FichaEquipo.tsx:386` | texto en pantalla | Comparar | Compare |
| `spaceeyes.ficha.subida` | `components/demo/space-eyes/FichaEquipo.tsx:406`<br>`components/demo/space-eyes/FichaEquipo.tsx:489` | texto en pantalla | Subida a la galería de la pantalla | Uploaded to the screen gallery |
| `spaceeyes.ficha.alt-cliente` | `components/demo/space-eyes/FichaEquipo.tsx:408`<br>`components/demo/space-eyes/FichaEquipo.tsx:434` | texto alternativo de imagen | Foto del cliente de {nombre} | Client photo of {nombre} |
| `spaceeyes.ficha.alt-captura` | `components/demo/space-eyes/FichaEquipo.tsx:417`<br>`components/demo/space-eyes/FichaEquipo.tsx:427` | texto alternativo de imagen | Captura de Space Eyes de {nombre} | Space Eyes capture of {nombre} |
| `spaceeyes.ficha.sin-capturas-min` | `components/demo/space-eyes/FichaEquipo.tsx:415` | texto en pantalla | sin capturas | no captures |
| `spaceeyes.ficha.sin-fotos` | `components/demo/space-eyes/FichaEquipo.tsx:431` | texto en pantalla | Este equipo todavía no ha subido ninguna foto. | This device has not uploaded any photos yet. |
| `spaceeyes.ficha.cliente.vacio` | `components/demo/space-eyes/FichaEquipo.tsx:439` | texto en pantalla | Nadie ha subido todavía una foto de esta pantalla. Usa «Subir foto». | Nobody has uploaded a photo of this screen yet. Use “Upload photo”. |
| `spaceeyes.ficha.cliente.sin-pantalla` | `components/demo/space-eyes/FichaEquipo.tsx:440` | texto en pantalla | Este equipo no tiene una pantalla asignada, así que no hay galería donde guardar la foto del cliente. | This device has no assigned screen, so there is no gallery to store the client photo. |
| `spaceeyes.ficha.barra.conexion` | `components/demo/space-eyes/FichaEquipo.tsx:449` | texto en pantalla | Última conexión {valor} | Last connection {valor} |
| `spaceeyes.ficha.barra.bateria` | `components/demo/space-eyes/FichaEquipo.tsx:454` | texto en pantalla | Batería {valor} | Battery {valor} |
| `spaceeyes.ficha.barra.red` | `components/demo/space-eyes/FichaEquipo.tsx:461` | texto en pantalla | Red | Network |
| `spaceeyes.ficha.barra.captura` | `components/demo/space-eyes/FichaEquipo.tsx:467` | texto en pantalla | Última captura {valor} | Last capture {valor} |
| `spaceeyes.ficha.origen.demanda` | `components/demo/space-eyes/FichaEquipo.tsx:488` | texto en pantalla | a demanda | on demand |
| `spaceeyes.ficha.origen.programada` | `components/demo/space-eyes/FichaEquipo.tsx:488` | texto en pantalla | programada | scheduled |
| `spaceeyes.ficha.ampliar` | `components/demo/space-eyes/FichaEquipo.tsx:494` | etiqueta accesible (aria-label) | Ampliar | Enlarge |
| `spaceeyes.ficha.ampliar-sello` | `components/demo/space-eyes/FichaEquipo.tsx:759` | etiqueta accesible (aria-label) | Ampliar: {sello} | Enlarge: {sello} |
| `spaceeyes.ficha.velo` | `components/demo/space-eyes/FichaEquipo.tsx:517` | texto en pantalla | Pidiéndole la foto al equipo… | Asking the device for the photo… |
| `spaceeyes.ficha.velo.tarda` | `components/demo/space-eyes/FichaEquipo.tsx:518` | texto en pantalla | Suele tardar entre 5 y 20 segundos | It usually takes 5 to 20 seconds |
| `spaceeyes.ficha.sin-capturas` | `components/demo/space-eyes/FichaEquipo.tsx:527` | texto en pantalla | Sin capturas | No captures |
| `spaceeyes.ficha.recientes` | `components/demo/space-eyes/FichaEquipo.tsx:545` | texto en pantalla | Recientes | Recent |
| `spaceeyes.ficha.captura-del` | `components/demo/space-eyes/FichaEquipo.tsx:554` | etiqueta accesible (aria-label) | Captura del {fecha} | Capture from {fecha} |
| `spaceeyes.ficha.energia` | `components/demo/space-eyes/FichaEquipo.tsx:571` | rótulo | Energía | Power |
| `spaceeyes.ficha.cargando` | `components/demo/space-eyes/FichaEquipo.tsx:578` | texto en pantalla | cargando | charging |
| `spaceeyes.ficha.sin-cargar` | `components/demo/space-eyes/FichaEquipo.tsx:578` | texto en pantalla | sin cargar | not charging |
| `spaceeyes.ficha.temp-bateria` | `components/demo/space-eyes/FichaEquipo.tsx:594` | rótulo | Temp. batería | Battery temp. |
| `spaceeyes.ficha.temp-equipo` | `components/demo/space-eyes/FichaEquipo.tsx:595` | rótulo | Temp. equipo | Device temp. |
| `spaceeyes.ficha.conexion` | `components/demo/space-eyes/FichaEquipo.tsx:599` | rótulo | Conexión | Connection |
| `spaceeyes.ficha.datos-mes` | `components/demo/space-eyes/FichaEquipo.tsx:610` | texto en pantalla | Datos de este mes | Data this month |
| `spaceeyes.ficha.pantalla` | `components/demo/space-eyes/FichaEquipo.tsx:623` | rótulo | Pantalla asociada | Linked screen |
| `spaceeyes.ficha.abrir-ficha` | `components/demo/space-eyes/FichaEquipo.tsx:636` | texto en pantalla | Abrir la ficha → | Open the profile → |
| `spaceeyes.ficha.sin-sitio` | `components/demo/space-eyes/FichaEquipo.tsx:642` | texto en pantalla | Ningún sitio de tu inventario tiene el código {codigo}, así que este equipo no está enlazado a una pantalla. | No site in your inventory has the code {codigo}, so this device is not linked to a screen. |
| `spaceeyes.ficha.detalles` | `components/demo/space-eyes/FichaEquipo.tsx:652` | rótulo | Detalles del equipo | Device details |
| `spaceeyes.ficha.version-agente` | `components/demo/space-eyes/FichaEquipo.tsx:655` | rótulo | Versión del agente | Agent version |
| `spaceeyes.ficha.capturas` | `components/demo/space-eyes/FichaEquipo.tsx:660` | rótulo | Capturas guardadas | Saved captures |
| `spaceeyes.ficha.alt-fotografia` | `components/demo/space-eyes/FichaEquipo.tsx:695` | texto alternativo de imagen | Fotografía de {nombre} | Photo of {nombre} |
| `spaceeyes.ficha.sin-fotografia` | `components/demo/space-eyes/FichaEquipo.tsx:763` | texto en pantalla | Sin fotografía | No photo |
| `spaceeyes.ficha.ia-pendiente` | `components/demo/space-eyes/FichaEquipo.tsx:834` | texto en pantalla | Verificación de IA pendiente | AI verification pending |
| `spaceeyes.historial.no-leer` | `components/demo/space-eyes/Historial.tsx:57` | mensaje de error | No se pudo leer el histórico | Could not read the history |
| `spaceeyes.historial.titulo` | `components/demo/space-eyes/Historial.tsx:78` | rótulo | Histórico del equipo | Device history |
| `spaceeyes.historial.reportes.uno` | `components/demo/space-eyes/Historial.tsx:105` | texto en pantalla | {n} reportes | {n} report |
| `spaceeyes.historial.reportes.otros` | `components/demo/space-eyes/Historial.tsx:105` | texto en pantalla | {n} reportes | {n} reports |
| `spaceeyes.historial.vacio` | `components/demo/space-eyes/Historial.tsx:118` | texto en pantalla | Este equipo no reportó nada en el rango elegido, así que no hay nada que dibujar. Prueba con un rango más amplio. | This device reported nothing in the chosen range, so there is nothing to plot. Try a wider range. |
| `spaceeyes.historial.bateria` | `components/demo/space-eyes/Historial.tsx:123`<br>`components/demo/space-eyes/Historial.tsx:169` | rótulo · texto en pantalla | Batería | Battery |
| `spaceeyes.historial.senal` | `components/demo/space-eyes/Historial.tsx:133`<br>`components/demo/space-eyes/Historial.tsx:170` | rótulo · texto en pantalla | Señal | Signal |
| `spaceeyes.historial.umbral.bateria` | `components/demo/space-eyes/Historial.tsx:129` | texto en pantalla | 20% · batería baja | 20% · low battery |
| `spaceeyes.historial.umbral.senal` | `components/demo/space-eyes/Historial.tsx:139` | texto en pantalla | −105 dBm · señal débil | −105 dBm · weak signal |
| `spaceeyes.historial.ver-datos` | `components/demo/space-eyes/Historial.tsx:162` | texto en pantalla | Ver los datos | Show the data |
| `spaceeyes.historial.caption` | `components/demo/space-eyes/Historial.tsx:165` | texto en pantalla | Batería y señal por hora | Battery and signal per hour |
| `spaceeyes.historial.hora` | `components/demo/space-eyes/Historial.tsx:168` | texto en pantalla | Hora | Time |
| `spaceeyes.historial.peor` | `components/demo/space-eyes/Historial.tsx:264` | texto en pantalla | peor {valor} | worst {valor} |
| `spaceeyes.historial.aria` | `components/demo/space-eyes/Historial.tsx:281` | etiqueta accesible (aria-label) | {titulo} por hora. Peor valor del rango: {valor}. | {titulo} per hour. Worst value in the range: {valor}. |
| `spaceeyes.comun.estado` | `components/demo/space-eyes/AltaDispositivo.tsx:625`<br>`components/demo/space-eyes/EquipoAdmin.tsx:305`<br>`components/demo/space-eyes/FallasFlota.tsx:400`<br>`components/demo/space-eyes/Graficas.tsx:457`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:189`<br>`components/demo/space-eyes/Programacion.tsx:507` | texto en pantalla | Estado | Status |
| `spaceeyes.comun.encendida` | `components/demo/space-eyes/PantallaConfig.tsx:456`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:124` | texto en pantalla | Encendida de {inicio} a {fin} | On from {inicio} to {fin} |
| `spaceeyes.pantalla.titulo` | `components/demo/space-eyes/FichaEquipo.tsx:359`<br>`components/demo/space-eyes/PantallaConfig.tsx:401`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:96` | rótulo | Pantalla y fallas | Screen and faults |
| `spaceeyes.vigilancia.aprendiendo` | `components/demo/space-eyes/CreativosConfig.tsx:283`<br>`components/demo/space-eyes/PantallaConfig.tsx:414`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:303` | texto en pantalla | Aprendiendo | Learning |
| `spaceeyes.vigilancia.vigilando` | `components/demo/space-eyes/CreativosConfig.tsx:286`<br>`components/demo/space-eyes/PantallaConfig.tsx:415`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:304` | texto en pantalla | Vigilando | Monitoring |
| `spaceeyes.falla.estado.abierta` | `components/demo/space-eyes/FallasFlota.tsx:63`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:36` | etiqueta de un valor (mapa de claves) | Abierta | Open |
| `spaceeyes.falla.estado.recuperada` | `components/demo/space-eyes/FallasFlota.tsx:64`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:37` | etiqueta de un valor (mapa de claves) | Recuperada | Cleared |
| `spaceeyes.falla.estado.descartada` | `components/demo/space-eyes/FallasFlota.tsx:65`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:38` | etiqueta de un valor (mapa de claves) | No era falla | Not a fault |
| `spaceeyes.falla.ver-evidencia` | `components/demo/space-eyes/FallasFlota.tsx:274`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:151` | título / tooltip | Ver la foto de evidencia | View the evidence photo |
| `spaceeyes.falla.alt-evidencia` | `components/demo/space-eyes/FallasFlota.tsx:277`<br>`components/demo/space-eyes/FallasFlota.tsx:454`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:154` | texto alternativo de imagen | Evidencia de la falla | Fault evidence |
| `spaceeyes.falla.detectada` | `components/demo/space-eyes/FallasFlota.tsx:294`<br>`components/demo/space-eyes/FallasFlota.tsx:396`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:186` | rótulo · texto en pantalla | Detectada | Detected |
| `spaceeyes.falla.falla` | `components/demo/space-eyes/FallasFlota.tsx:398`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:187` | texto en pantalla | Falla | Fault |
| `spaceeyes.falla.evidencia` | `components/demo/space-eyes/FallasFlota.tsx:402`<br>`components/demo/space-eyes/FallasFlota.tsx:453`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:191` | texto en pantalla · título / tooltip | Evidencia | Evidence |
| `spaceeyes.falla.a-mano` | `components/demo/space-eyes/FallasFlota.tsx:366`<br>`components/demo/space-eyes/FallasFlota.tsx:424`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:207` | texto en pantalla | ␣· a mano | ␣· by hand |
| `spaceeyes.falla.al-detectar` | `components/demo/space-eyes/FallasFlota.tsx:430`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:213` | texto en pantalla | al detectar | when detected |
| `spaceeyes.falla.al-recuperar` | `components/demo/space-eyes/FallasFlota.tsx:439`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:222` | texto en pantalla | al recuperar | when cleared |
| `spaceeyes.creativo.alt` | `components/demo/space-eyes/CreativosConfig.tsx:415`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:269` | texto alternativo de imagen | Creativo detectado | Detected creative |
| `spaceeyes.creativo.aparecio` | `components/demo/space-eyes/CreativosConfig.tsx:432`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:273` | texto en pantalla | Apareció {fecha} | First seen {fecha} |
| `spaceeyes.creativo.visto.uno` | `components/demo/space-eyes/CreativosConfig.tsx:434`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:275` | texto en pantalla | Visto {n} veces · último {hace} | Seen {n} time · last {hace} |
| `spaceeyes.creativo.visto.otros` | `components/demo/space-eyes/CreativosConfig.tsx:434`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:275` | texto en pantalla | Visto {n} veces · último {hace} | Seen {n} times · last {hace} |
| `spaceeyes.creativo.ninguno` | `components/demo/space-eyes/CreativosConfig.tsx:458`<br>`components/demo/space-eyes/PantallaYCreativos.tsx:286` | texto en pantalla | Todavía no ha detectado creativos nuevos. | No new creatives detected yet. |
| `spaceeyes.pyc.error` | `components/demo/space-eyes/PantallaYCreativos.tsx:74` | texto en pantalla | No se pudo leer lo que el equipo vio en su pantalla: {error} | Could not read what the device saw on its screen: {error} |
| `spaceeyes.pyc.leyendo` | `components/demo/space-eyes/PantallaYCreativos.tsx:81` | texto en pantalla | Leyendo la vigilancia de la pantalla… | Reading the screen monitoring… |
| `spaceeyes.pyc.historial` | `components/demo/space-eyes/PantallaYCreativos.tsx:96` | rótulo | Historial de fallas | Fault history |
| `spaceeyes.pyc.descripcion` | `components/demo/space-eyes/PantallaYCreativos.tsx:98` | texto en pantalla | El equipo revisa su pantalla y avisa solo cuando confirma una falla o cuando se arregla. | The device checks its screen and only alerts when it confirms a fault or when it is fixed. |
| `spaceeyes.pyc.pantalla` | `components/demo/space-eyes/PantallaYCreativos.tsx:112` | texto en pantalla | Pantalla: {valor} | Screen: {valor} |
| `spaceeyes.pyc.gabinetes` | `components/demo/space-eyes/PantallaYCreativos.tsx:116` | texto en pantalla | {n} gabinetes | {n} cabinets |
| `spaceeyes.pyc.sin-marcar` | `components/demo/space-eyes/PantallaYCreativos.tsx:117` | texto en pantalla | sin marcar | not marked |
| `spaceeyes.pyc.ultima-revision` | `components/demo/space-eyes/PantallaYCreativos.tsx:131` | texto en pantalla | Última revisión: {valor} | Last check: {valor} |
| `spaceeyes.pyc.ninguna` | `components/demo/space-eyes/PantallaYCreativos.tsx:134` | texto en pantalla | todavía ninguna | none yet |
| `spaceeyes.pyc.detectada` | `components/demo/space-eyes/PantallaYCreativos.tsx:163` | texto en pantalla | Detectada {fecha} · confianza {pct} | Detected {fecha} · confidence {pct} |
| `spaceeyes.pyc.sin-abiertas` | `components/demo/space-eyes/PantallaYCreativos.tsx:176` | texto en pantalla | Sin fallas abiertas. | No open faults. |
| `spaceeyes.pyc.donde` | `components/demo/space-eyes/PantallaYCreativos.tsx:188` | texto en pantalla | Dónde | Where |
| `spaceeyes.pyc.cerrada` | `components/demo/space-eyes/PantallaYCreativos.tsx:190` | texto en pantalla | Cerrada | Closed |
| `spaceeyes.pyc.sin-vigilar` | `components/demo/space-eyes/PantallaYCreativos.tsx:235` | texto en pantalla | Este equipo no está vigilando su pantalla. Se enciende en Space Eye (necesita la app 0.15 o posterior). | This device is not monitoring its screen. It is turned on in Space Eye (requires app 0.15 or later). |
| `spaceeyes.pyc.sin-datos` | `components/demo/space-eyes/PantallaYCreativos.tsx:238` | texto en pantalla | Space Eye no tiene datos de pantalla de este equipo. | Space Eye has no screen data for this device. |
| `spaceeyes.pyc.creativos` | `components/demo/space-eyes/PantallaYCreativos.tsx:247` | texto en pantalla | Creativos detectados | Detected creatives |
| `spaceeyes.pyc.creativos.texto` | `components/demo/space-eyes/PantallaYCreativos.tsx:248` | texto en pantalla | Cada anuncio distinto que ha pasado por la pantalla, reconocido por el propio equipo. | Every distinct ad that has played on the screen, recognized by the device itself. |
| `spaceeyes.pyc.sin-vigilar-creativos` | `components/demo/space-eyes/PantallaYCreativos.tsx:286` | texto en pantalla | Este equipo no está vigilando los creativos de su pantalla. | This device is not monitoring the creatives on its screen. |
| `spaceeyes.pyc.sin-datos-corto` | `components/demo/space-eyes/PantallaYCreativos.tsx:299` | texto en pantalla | Sin datos | No data |
| `spaceeyes.pyc.apagada` | `components/demo/space-eyes/PantallaYCreativos.tsx:301` | texto en pantalla | Apagada | Off |
| `spaceeyes.comun.sin-permiso-cambiar` | `components/demo/space-eyes/CreativosConfig.tsx:133`<br>`components/demo/space-eyes/PantallaConfig.tsx:143` | texto de una función (lib o componente) | No tienes permiso para cambiar esto. | You do not have permission to change this. |
| `spaceeyes.comun.no-guardar` | `components/demo/space-eyes/CreativosConfig.tsx:200`<br>`components/demo/space-eyes/EquipoAdmin.tsx:267`<br>`components/demo/space-eyes/PantallaConfig.tsx:223` | aviso en pantalla · mensaje de error | No se pudo guardar: {motivo} | Could not save: {motivo} |
| `spaceeyes.comun.apagado` | `components/demo/space-eyes/CreativosConfig.tsx:281`<br>`components/demo/space-eyes/PantallaConfig.tsx:516` | rótulo · texto en pantalla | Apagado | Off |
| `spaceeyes.comun.frecuencia` | `components/demo/space-eyes/CreativosConfig.tsx:337`<br>`components/demo/space-eyes/PantallaConfig.tsx:494` | texto en pantalla | Frecuencia | Frequency |
| `spaceeyes.comun.ver-grande` | `components/demo/space-eyes/CreativosConfig.tsx:424` | título / tooltip | Ver en grande | View larger |
| `spaceeyes.frecuencia.30` | `components/demo/space-eyes/CreativosConfig.tsx:75`<br>`components/demo/space-eyes/PantallaConfig.tsx:122` | etiqueta de un valor (mapa de claves) | Cada 30 min | Every half hour |
| `spaceeyes.frecuencia.60` | `components/demo/space-eyes/CreativosConfig.tsx:76`<br>`components/demo/space-eyes/PantallaConfig.tsx:123` | etiqueta de un valor (mapa de claves) | Cada hora | Every hour |
| `spaceeyes.frecuencia.120` | `components/demo/space-eyes/CreativosConfig.tsx:77`<br>`components/demo/space-eyes/PantallaConfig.tsx:124` | etiqueta de un valor (mapa de claves) | Cada 2 horas | Every two hours |
| `spaceeyes.frecuencia.180` | `components/demo/space-eyes/CreativosConfig.tsx:78`<br>`components/demo/space-eyes/PantallaConfig.tsx:125` | etiqueta de un valor (mapa de claves) | Cada 3 horas | Every three hours |
| `spaceeyes.frecuencia.360` | `components/demo/space-eyes/CreativosConfig.tsx:79` | etiqueta de un valor (mapa de claves) | Cada 6 horas | Every six hours |
| `spaceeyes.frecuencia.720` | `components/demo/space-eyes/CreativosConfig.tsx:80` | etiqueta de un valor (mapa de claves) | Cada 12 horas | Every twelve hours |
| `spaceeyes.frecuencia.otra` | `components/demo/space-eyes/CreativosConfig.tsx:349`<br>`components/demo/space-eyes/Programacion.tsx:152` | texto de una función (lib o componente) · texto en pantalla | Cada {n} min | Every {n} min |
| `spaceeyes.creativos.frecuencia.0` | `components/demo/space-eyes/CreativosConfig.tsx:74` | etiqueta de un valor (mapa de claves) | Continuo (avisa al minuto) | Continuous (alerts within a minute) |
| `spaceeyes.creativos.envio.0` | `components/demo/space-eyes/CreativosConfig.tsx:63` | etiqueta de un valor (mapa de claves) | Al momento | Right away |
| `spaceeyes.creativos.envio.120` | `components/demo/space-eyes/CreativosConfig.tsx:64` | etiqueta de un valor (mapa de claves) | Juntas cada 2 horas | Batched every two hours |
| `spaceeyes.creativos.envio.240` | `components/demo/space-eyes/CreativosConfig.tsx:65` | etiqueta de un valor (mapa de claves) | Juntas cada 4 horas | Batched every four hours |
| `spaceeyes.creativos.envio.480` | `components/demo/space-eyes/CreativosConfig.tsx:66` | etiqueta de un valor (mapa de claves) | Juntas cada 8 horas | Batched every eight hours |
| `spaceeyes.creativos.envio.720` | `components/demo/space-eyes/CreativosConfig.tsx:67` | etiqueta de un valor (mapa de claves) | Juntas cada 12 horas | Batched every twelve hours |
| `spaceeyes.creativos.envio.otra` | `components/demo/space-eyes/CreativosConfig.tsx:383` | texto en pantalla | Juntas cada {n} min | Batched every {n} min |
| `spaceeyes.creativos.mes` | `components/demo/space-eyes/CreativosConfig.tsx:107`<br>`components/demo/space-eyes/CreativosConfig.tsx:119` | etiqueta accesible (aria-label) · texto en pantalla | Datos del chip este mes | SIM data this month |
| `spaceeyes.creativos.mes.ayuda` | `components/demo/space-eyes/CreativosConfig.tsx:105` | título / tooltip | Datos móviles (chip) que el equipo lleva este mes, según su propio reporte. Casi todo lo gasta la vista en vivo; las fotos de creativos pesan poco. | Mobile data (SIM) the device has used this month, as it reports itself. The live view uses almost all of it; creative photos weigh little. |
| `spaceeyes.creativos.mes.sin` | `components/demo/space-eyes/CreativosConfig.tsx:109` | texto en pantalla | El equipo todavía no reporta su consumo. | The device does not report its usage yet. |
| `spaceeyes.creativos.no-reiniciar` | `components/demo/space-eyes/CreativosConfig.tsx:216` | aviso en pantalla | No se pudo reiniciar: {motivo} | Could not reset: {motivo} |
| `spaceeyes.creativos.no-descartar` | `components/demo/space-eyes/CreativosConfig.tsx:230` | aviso en pantalla | No se pudo descartar: {motivo} | Could not dismiss: {motivo} |
| `spaceeyes.creativos.error` | `components/demo/space-eyes/CreativosConfig.tsx:239` | texto en pantalla | No se pudo leer la vigilancia de creativos: {error} | Could not read the creative monitoring: {error} |
| `spaceeyes.creativos.leyendo` | `components/demo/space-eyes/CreativosConfig.tsx:246` | texto en pantalla | Leyendo la vigilancia de creativos… | Reading the creative monitoring… |
| `spaceeyes.creativos.titulo` | `components/demo/space-eyes/CreativosConfig.tsx:266` | rótulo | Vigilancia de creativos | Creative monitoring |
| `spaceeyes.creativos.descripcion` | `components/demo/space-eyes/CreativosConfig.tsx:267` | texto en pantalla | El equipo reconoce los anuncios de su pantalla sin gastar datos y solo sube foto cuando aparece uno que no conocía. | The device recognizes the ads on its screen without using data and only uploads a photo when one it did not know appears. |
| `spaceeyes.creativos.continuo` | `components/demo/space-eyes/CreativosConfig.tsx:285` | texto en pantalla | Vigilando en continuo | Monitoring continuously |
| `spaceeyes.creativos.vigilar` | `components/demo/space-eyes/CreativosConfig.tsx:289` | rótulo | Vigilar la pantalla | Monitor the screen |
| `spaceeyes.creativos.no-sabe` | `components/demo/space-eyes/CreativosConfig.tsx:300` | texto en pantalla | Este equipo no sabe vigilar su pantalla todavía: los celulares necesitan la app 0.15.0 o posterior, y el agente de PC no lo tiene. | This device cannot monitor its screen yet: phones need app 0.15.0 or later, and the PC agent does not have it. |
| `spaceeyes.creativos.sin-marcar` | `components/demo/space-eyes/CreativosConfig.tsx:305` | texto en pantalla | Falta marcar la pantalla (en «Pantalla y fallas»): sin eso el equipo no reconoce creativos, porque el fondo los confunde entre sí. | The screen still has to be marked (in “Screen and faults”): without that the device cannot recognize creatives, because the background mixes them up. |
| `spaceeyes.creativos.aprendiendo` | `components/demo/space-eyes/CreativosConfig.tsx:314` | texto en pantalla | Aprendiendo el loop hasta {fin}: en este plazo no toma fotos. | Learning the loop until {fin}: it takes no photos during this time. |
| `spaceeyes.creativos.fotos-hoy` | `components/demo/space-eyes/CreativosConfig.tsx:322` | texto en pantalla | Fotos hoy | Photos today |
| `spaceeyes.creativos.catalogo` | `components/demo/space-eyes/CreativosConfig.tsx:329` | texto en pantalla | En el catálogo | In the catalog |
| `spaceeyes.creativos.frecuencia.ayuda` | `components/demo/space-eyes/CreativosConfig.tsx:334` | título / tooltip | Continuo: el equipo mira su pantalla todo el día dentro del horario y avisa en menos de un minuto cuando sale un creativo nuevo. Sigue sin gastar datos: solo manda la foto de lo nuevo. | Continuous: the device watches its screen all day within operating hours and alerts within a minute when a new creative appears. It still uses no data: it only sends the photo of what is new. |
| `spaceeyes.creativos.reaprender` | `components/demo/space-eyes/CreativosConfig.tsx:358`<br>`components/demo/space-eyes/CreativosConfig.tsx:470` | texto en pantalla | Volver a aprender | Relearn |
| `spaceeyes.creativos.envio.ayuda` | `components/demo/space-eyes/CreativosConfig.tsx:366` | título / tooltip | Mirar y mandar son dos cosas: el equipo mira todo el tiempo y aquí se elige cuándo viajan las fotos. Juntas llega una por creativo, la más nítida; un creativo que se repite no se vuelve a mandar. | Watching and sending are two different things: the device watches all the time, and here you choose when the photos travel. Batched, one arrives per creative, the sharpest; a creative that repeats is not sent again. |
| `spaceeyes.creativos.envio` | `components/demo/space-eyes/CreativosConfig.tsx:369` | texto en pantalla | Mandar las fotos nuevas | Send new photos |
| `spaceeyes.creativos.envio.pie` | `components/demo/space-eyes/CreativosConfig.tsx:392` | texto en pantalla | Solo las nuevas: una foto por creativo. Mirar no gasta datos. | Only new ones: one photo per creative. Watching uses no data. |
| `spaceeyes.creativos.intervalos` | `components/demo/space-eyes/CreativosConfig.tsx:402` | texto en pantalla | Mirando por intervalos, un creativo que sale una sola vez entre dos miradas no se ve. Para no perder ninguno, usa «Continuo»: mirar no gasta datos, y con «Juntas cada N horas» decides cuándo llegan las fotos. | Watching at intervals, a creative that plays only once between two looks is missed. To miss none, use “Continuous”: watching uses no data, and with “Batched every N hours” you decide when the photos arrive. |
| `spaceeyes.creativos.nuevos` | `components/demo/space-eyes/CreativosConfig.tsx:407` | texto en pantalla | Creativos nuevos detectados | New creatives detected |
| `spaceeyes.creativos.no-nuevo.ayuda` | `components/demo/space-eyes/CreativosConfig.tsx:445` | título / tooltip | No era un creativo nuevo (reflejo, pantalla apagada…) | It was not a new creative (reflection, screen off…) |
| `spaceeyes.creativos.descartando` | `components/demo/space-eyes/CreativosConfig.tsx:448` | texto en pantalla | Descartando… | Dismissing… |
| `spaceeyes.creativos.no-nuevo` | `components/demo/space-eyes/CreativosConfig.tsx:448` | texto en pantalla | No es nuevo | Not new |
| `spaceeyes.creativos.reaprender.titulo` | `components/demo/space-eyes/CreativosConfig.tsx:469` | título / tooltip | Volver a aprender la pantalla | Relearn the screen |
| `spaceeyes.creativos.reaprender.texto` | `components/demo/space-eyes/CreativosConfig.tsx:474` | texto en pantalla | Se borra todo lo que el equipo aprendió de esta pantalla. Vuelve a aprender durante el plazo de aprendizaje, y en ese tiempo no toma fotos. | Everything the device learned about this screen is erased. It learns again during the learning period, and takes no photos in that time. |
| `spaceeyes.comun.encendido` | `components/demo/space-eyes/PantallaConfig.tsx:516` | rótulo | Encendido | On |
| `spaceeyes.comun.guardando` | `components/demo/space-eyes/CampanasEyes.tsx:514`<br>`components/demo/space-eyes/EquipoAdmin.tsx:342`<br>`components/demo/space-eyes/EquipoAdmin.tsx:898`<br>`components/demo/space-eyes/FallasFlota.tsx:503`<br>`components/demo/space-eyes/PantallaConfig.tsx:664`<br>`components/demo/space-eyes/Programacion.tsx:609` | texto en pantalla | Guardando… | Saving… |
| `spaceeyes.pconfig.aprendizaje.0` | `components/demo/space-eyes/PantallaConfig.tsx:113` | etiqueta de un valor (mapa de claves) | Solo la primera vuelta (pruebas) | First pass only (testing) |
| `spaceeyes.pconfig.aprendizaje.30` | `components/demo/space-eyes/PantallaConfig.tsx:114` | etiqueta de un valor (mapa de claves) | 30 minutos | 30 minutes |
| `spaceeyes.pconfig.aprendizaje.120` | `components/demo/space-eyes/PantallaConfig.tsx:115` | etiqueta de un valor (mapa de claves) | 2 horas | 2 hours |
| `spaceeyes.pconfig.aprendizaje.360` | `components/demo/space-eyes/PantallaConfig.tsx:116` | etiqueta de un valor (mapa de claves) | 6 horas | 6 hours |
| `spaceeyes.pconfig.aprendizaje.1440` | `components/demo/space-eyes/PantallaConfig.tsx:117` | etiqueta de un valor (mapa de claves) | 24 horas | 24 hours |
| `spaceeyes.pconfig.frecuencia.5` | `components/demo/space-eyes/PantallaConfig.tsx:120` | etiqueta de un valor (mapa de claves) | Cada 5 min (pruebas) | Every five minutes (testing) |
| `spaceeyes.pconfig.frecuencia.15` | `components/demo/space-eyes/PantallaConfig.tsx:121` | etiqueta de un valor (mapa de claves) | Cada 15 min (pruebas) | Every fifteen minutes (testing) |
| `spaceeyes.pconfig.guardada.reinicia` | `components/demo/space-eyes/PantallaConfig.tsx:355` | texto en pantalla | Pantalla guardada. El equipo vuelve a aprenderla desde cero. | Screen saved. The device learns it again from scratch. |
| `spaceeyes.pconfig.guardada` | `components/demo/space-eyes/PantallaConfig.tsx:355` | texto en pantalla | Pantalla guardada. | Screen saved. |
| `spaceeyes.pconfig.no-guardar` | `components/demo/space-eyes/PantallaConfig.tsx:359` | aviso en pantalla | No se pudo guardar la pantalla: {motivo} | Could not save the screen: {motivo} |
| `spaceeyes.pconfig.error` | `components/demo/space-eyes/PantallaConfig.tsx:381` | texto en pantalla | No se pudo leer la pantalla del equipo: {error} | Could not read the device screen: {error} |
| `spaceeyes.pconfig.leyendo` | `components/demo/space-eyes/PantallaConfig.tsx:388` | texto en pantalla | Leyendo la pantalla del equipo… | Reading the device screen… |
| `spaceeyes.pconfig.descripcion` | `components/demo/space-eyes/PantallaConfig.tsx:402` | texto en pantalla | El equipo revisa su pantalla por sí mismo y solo avisa cuando confirma una falla o cuando se arregla. No manda video ni fotos mientras todo está bien. | The device checks its own screen and only alerts when it confirms a fault or when it is fixed. It sends no video or photos while everything is fine. |
| `spaceeyes.pconfig.apagada` | `components/demo/space-eyes/PantallaConfig.tsx:412` | texto en pantalla | Vigilancia apagada | Monitoring off |
| `spaceeyes.pconfig.vigilar` | `components/demo/space-eyes/PantallaConfig.tsx:418` | rótulo | Vigilar fallas | Monitor faults |
| `spaceeyes.pconfig.no-sabe` | `components/demo/space-eyes/PantallaConfig.tsx:429` | texto en pantalla | La vigilancia de fallas necesita la app 0.15.0 o posterior en el celular, o el agente 0.7.0 en la Raspberry. El agente de PC todavía no la tiene. | Fault monitoring needs app 0.15.0 or later on the phone, or agent 0.7.0 on the Raspberry. The PC agent does not have it yet. |
| `spaceeyes.pconfig.sin-marcar.aviso` | `components/demo/space-eyes/PantallaConfig.tsx:434` | texto en pantalla | Falta marcar dónde está la pantalla en la foto: sin eso el equipo no vigila fallas ni creativos. | You still need to mark where the screen is in the photo: without that the device monitors neither faults nor creatives. |
| `spaceeyes.pconfig.pantalla` | `components/demo/space-eyes/PantallaConfig.tsx:442` | texto en pantalla | Pantalla | Screen |
| `spaceeyes.pconfig.gabinetes` | `components/demo/space-eyes/PantallaConfig.tsx:446` | texto en pantalla | {n} gabinetes {medida} | {n} cabinets {medida} |
| `spaceeyes.pconfig.sin-marcar` | `components/demo/space-eyes/PantallaConfig.tsx:463` | texto en pantalla | Sin marcar | Not marked |
| `spaceeyes.pconfig.cambiar` | `components/demo/space-eyes/PantallaConfig.tsx:467` | texto en pantalla | Cambiar pantalla | Change screen |
| `spaceeyes.pconfig.marcar` | `components/demo/space-eyes/PantallaConfig.tsx:467` | texto en pantalla | Marcar la pantalla | Mark the screen |
| `spaceeyes.pconfig.solo-dueno` | `components/demo/space-eyes/PantallaConfig.tsx:472` | texto en pantalla | Marcar la pantalla la cambia para el equipo y borra lo que aprendió: solo lo hace el Dueño. | Marking the screen changes it for the device and erases what it learned: only the Owner can do it. |
| `spaceeyes.pconfig.aprendizaje.ayuda` | `components/demo/space-eyes/PantallaConfig.tsx:479` | título / tooltip | Antes de avisar, el equipo aprende cómo se ve la pantalla normalmente. Siempre aprende al menos su primera vuelta con la pantalla funcionando. | Before alerting, the device learns what the screen normally looks like. It always learns at least its first pass with the screen working. |
| `spaceeyes.pconfig.aprendizaje` | `components/demo/space-eyes/PantallaConfig.tsx:481` | texto en pantalla | Aprendizaje | Learning |
| `spaceeyes.pconfig.aprendizaje.texto` | `components/demo/space-eyes/PantallaConfig.tsx:482` | texto en pantalla | Cuánto observa antes de empezar a avisar. | How long it watches before it starts alerting. |
| `spaceeyes.pconfig.frecuencia.texto` | `components/demo/space-eyes/PantallaConfig.tsx:495` | texto en pantalla | Cada cuánto revisa la pantalla (dentro del horario). | How often it checks the screen (within operating hours). |
| `spaceeyes.pconfig.rapido.ayuda` | `components/demo/space-eyes/PantallaConfig.tsx:509` | título / tooltip | Mientras mira su pantalla, si el equipo la ve entera apagada tres veces seguidas (con luz alrededor) avisa en ese momento, con su foto, sin esperar la siguiente revisión. De noche o con la lente tapada no avisa así: eso lo decide la revisión de siempre. | While watching its screen, if the device sees it completely off three times in a row (with light around) it alerts right then, with its photo, without waiting for the next check. At night or with the lens covered it does not alert this way: the usual check decides that. |
| `spaceeyes.pconfig.rapido` | `components/demo/space-eyes/PantallaConfig.tsx:512` | texto en pantalla | Avisar al instante si la pantalla se apaga completa | Alert immediately if the whole screen goes off |
| `spaceeyes.pconfig.rapido.texto` | `components/demo/space-eyes/PantallaConfig.tsx:513` | texto en pantalla | En menos de un minuto y una sola vez por apagón; se cierra sola cuando vuelve. | Within a minute and only once per outage; it closes itself when the screen comes back. |
| `spaceeyes.pconfig.esquinas` | `components/demo/space-eyes/PantallaConfig.tsx:539` | texto en pantalla | Esquinas | Corners |
| `spaceeyes.pconfig.zonas` | `components/demo/space-eyes/PantallaConfig.tsx:539` | texto en pantalla | Zonas tapadas | Blocked areas |
| `spaceeyes.pconfig.filas` | `components/demo/space-eyes/PantallaConfig.tsx:544` | texto en pantalla | Filas | Rows |
| `spaceeyes.pconfig.columnas` | `components/demo/space-eyes/PantallaConfig.tsx:555` | texto en pantalla | Columnas | Columns |
| `spaceeyes.pconfig.editor.desde` | `components/demo/space-eyes/PantallaConfig.tsx:566` | texto en pantalla | Encendida de | On from |
| `spaceeyes.pconfig.editor.a` | `components/demo/space-eyes/PantallaConfig.tsx:575`<br>`components/demo/space-eyes/Programacion.tsx:753` | texto en pantalla | a | to |
| `spaceeyes.pconfig.horario-mal` | `components/demo/space-eyes/PantallaConfig.tsx:587` | texto en pantalla | El horario va en HH:MM, de 00:00 a 24:00. | Hours go in HH:MM, from 00:00 to 24:00. |
| `spaceeyes.pconfig.ayuda.esquinas` | `components/demo/space-eyes/PantallaConfig.tsx:591` | texto en pantalla | Toca las 4 esquinas de la pantalla en orden: {orden}. Después puedes arrastrarlas. Pon filas y columnas de gabinetes para que las líneas coincidan con las uniones. Si cambias el zoom o el lente del equipo, hay que volver a marcarla. | Click the 4 corners of the screen in order: {orden}. Then you can drag them. Set the cabinet rows and columns so the lines match the seams. If you change the device zoom or lens, you have to mark it again. |
| `spaceeyes.pconfig.ayuda.orden` | `components/demo/space-eyes/PantallaConfig.tsx:592` | texto en pantalla | arriba izquierda, arriba derecha, abajo derecha, abajo izquierda | top left, top right, bottom right, bottom left |
| `spaceeyes.pconfig.ayuda.zonas` | `components/demo/space-eyes/PantallaConfig.tsx:595` | texto en pantalla | Toca los gabinetes que algo tapa siempre (una barda, un árbol, un poste): no se revisan. El equipo también las aprende solo en sus primeras 24 horas. | Click the cabinets that something always blocks (a wall, a tree, a pole): they are not checked. The device also learns them on its own in its first 24 hours. |
| `spaceeyes.pconfig.sin-foto` | `components/demo/space-eyes/PantallaConfig.tsx:600` | texto en pantalla | Toma primero una foto del equipo para poder marcar la pantalla. | Take a photo with the device first so you can mark the screen. |
| `spaceeyes.pconfig.alt-foto` | `components/demo/space-eyes/PantallaConfig.tsx:613` | texto alternativo de imagen | Última foto del equipo | Latest photo from the device |
| `spaceeyes.pconfig.guardar` | `components/demo/space-eyes/PantallaConfig.tsx:664` | texto en pantalla | Guardar pantalla | Save screen |
| `spaceeyes.pconfig.empezar` | `components/demo/space-eyes/PantallaConfig.tsx:678` | texto en pantalla | Volver a empezar | Start over |
| `spaceeyes.pconfig.ultima` | `components/demo/space-eyes/PantallaConfig.tsx:687` | texto en pantalla | Última revisión | Last check |
| `spaceeyes.pconfig.aprendiendo` | `components/demo/space-eyes/PantallaConfig.tsx:691` | texto en pantalla | Aprendiendo la pantalla hasta {fin}: en este plazo no avisa de fallas. | Learning the screen until {fin}: it does not alert about faults during this time. |
| `spaceeyes.pconfig.primera-vuelta` | `components/demo/space-eyes/PantallaConfig.tsx:697` | texto en pantalla | Aprendiendo con su primera vuelta: la siguiente ya vigila. | Learning on its first pass: the next one already monitors. |
| `spaceeyes.pconfig.camara-bloqueada` | `components/demo/space-eyes/PantallaConfig.tsx:701` | texto en pantalla | Android no le deja usar la cámara en segundo plano, así que no está revisando la pantalla. Abre la app Space Eye en el celular una vez y se arregla sola. Pasa tras reiniciar el celular, salvo que la app sea dueña del dispositivo. | Android does not let it use the camera in the background, so it is not checking the screen. Open the Space Eye app on the phone once and it fixes itself. This happens after the phone restarts, unless the app is the device owner. |
| `spaceeyes.pconfig.quietos` | `components/demo/space-eyes/PantallaConfig.tsx:706` | texto en pantalla | Gabinetes que nunca cambian (no se revisan): {lista}. Suelen estar tapados por algo; si no hay nada delante, revísalos: podrían llevar tiempo apagados. | Cabinets that never change (not checked): {lista}. Something usually blocks them; if nothing is in front, check them: they could have been off for a while. |
| `spaceeyes.pconfig.confirmar.titulo` | `components/demo/space-eyes/PantallaConfig.tsx:718` | título / tooltip | Cambió el encuadre de la pantalla | The screen framing changed |
| `spaceeyes.pconfig.confirmar.boton` | `components/demo/space-eyes/PantallaConfig.tsx:719` | texto en pantalla | Guardar de todos modos | Save anyway |
| `spaceeyes.pconfig.confirmar.texto` | `components/demo/space-eyes/PantallaConfig.tsx:723` | texto en pantalla | Cambiaron las esquinas o los gabinetes, así que el equipo olvida lo que había aprendido. Vuelve a aprender antes de poder avisar de fallas. | The corners or the cabinets changed, so the device forgets what it had learned. It learns again before it can alert about faults. |
| `spaceeyes.pconfig.revision.ninguna` | `components/demo/space-eyes/PantallaConfig.tsx:747` | texto en pantalla | El equipo todavía no ha hecho ninguna revisión. | The device has not done any check yet. |
| `spaceeyes.pconfig.revision.ok` | `components/demo/space-eyes/PantallaConfig.tsx:750` | texto en pantalla | se ve bien | looks fine |
| `spaceeyes.pconfig.revision.apagada` | `components/demo/space-eyes/PantallaConfig.tsx:751` | texto en pantalla | apagada | off |
| `spaceeyes.pconfig.revision.congelada` | `components/demo/space-eyes/PantallaConfig.tsx:752` | texto en pantalla | congelada | frozen |
| `spaceeyes.pconfig.revision.inconcluso` | `components/demo/space-eyes/PantallaConfig.tsx:753` | texto en pantalla | no se pudo juzgar | could not be judged |
| `spaceeyes.pconfig.revision.movida` | `components/demo/space-eyes/PantallaConfig.tsx:757` | texto en pantalla | ␣· la cámara se movió | ␣· the camera moved |
| `spaceeyes.pconfig.revision.sin-imagen` | `components/demo/space-eyes/PantallaConfig.tsx:758` | texto en pantalla | ␣· sin imagen | ␣· no image |
| `spaceeyes.pconfig.revision.corte` | `components/demo/space-eyes/PantallaConfig.tsx:765` | texto en pantalla | ␣La vuelta se interrumpió (vista en vivo o una foto): se usaron {usados} de {total} vistazos. | ␣The pass was interrupted (live view or a photo): {usados} of {total} looks were used. |
| `spaceeyes.pconfig.vistazos.uno` | `components/demo/space-eyes/PantallaConfig.tsx:773` | texto en pantalla | {n} vistazos | {n} look |
| `spaceeyes.pconfig.vistazos.otros` | `components/demo/space-eyes/PantallaConfig.tsx:773` | texto en pantalla | {n} vistazos | {n} looks |
| `spaceeyes.pconfig.cambios.uno` | `components/demo/space-eyes/PantallaConfig.tsx:774` | texto en pantalla | {n} cambios de anuncio | {n} ad change |
| `spaceeyes.pconfig.cambios.otros` | `components/demo/space-eyes/PantallaConfig.tsx:774` | texto en pantalla | {n} cambios de anuncio | {n} ad changes |
| `spaceeyes.pconfig.revision` | `components/demo/space-eyes/PantallaConfig.tsx:769` | texto en pantalla | {cuando} · pantalla {pantalla}{camara} ({vistazos}, {cambios}).{corte} | {cuando} · screen {pantalla}{camara} ({vistazos}, {cambios}).{corte} |
| `spaceeyes.actualizacion.sola` | `lib/space-eyes-actualizacion.ts:44` | texto en pantalla | Se actualiza sola. | Updates on its own. |
| `spaceeyes.actualizacion.kiosco` | `lib/space-eyes-actualizacion.ts:45` | texto en pantalla | Se actualiza sola (modo kiosco). | Updates on its own (kiosk mode). |
| `spaceeyes.actualizacion.sin-tocar` | `lib/space-eyes-actualizacion.ts:46` | texto en pantalla | Se actualiza sola, sin tocar el teléfono. | Updates on its own, without touching the phone. |
| `spaceeyes.actualizacion.android-viejo` | `lib/space-eyes-actualizacion.ts:50` | texto en pantalla | Pide un toque en el teléfono en cada actualización: tiene Android 11 o anterior. | Someone has to confirm on the phone for every update: it runs Android 11 or earlier. |
| `spaceeyes.actualizacion.sin-instalar-apps` | `lib/space-eyes-actualizacion.ts:52` | texto en pantalla | Pide un toque: en el teléfono está apagado «Instalar apps desconocidas» para Space Eye. | Someone has to confirm on the phone: “Install unknown apps” is turned off for Space Eye. |
| `spaceeyes.actualizacion.otro-dueno` | `lib/space-eyes-actualizacion.ts:54` | texto en pantalla | Pide un toque: otra tienda administra sus actualizaciones. | Someone has to confirm on the phone: another store manages its updates. |
| `spaceeyes.actualizacion.proxima` | `lib/space-eyes-actualizacion.ts:56`<br>`lib/space-eyes-actualizacion.ts:62` | texto en pantalla | La próxima actualización pide un toque en el teléfono; después se actualiza sola. | The next update needs a confirmation on the phone; after that it updates on its own. |
| `spaceeyes.actualizacion.visita` | `lib/space-eyes-actualizacion.ts:61` | texto en pantalla | Necesita una visita: esta versión no se puede actualizar a distancia. | Needs a site visit: this version cannot be updated remotely. |
| `spaceeyes.comun.sin-permiso` | `components/demo/space-eyes/EquipoAdmin.tsx:116` | texto de una función (lib o componente) | No tienes permiso para esto. | You do not have permission for this. |
| `spaceeyes.comun.nombre` | `components/demo/space-eyes/CampanasEyes.tsx:366`<br>`components/demo/space-eyes/EquipoAdmin.tsx:301`<br>`components/demo/space-eyes/EquipoAdmin.tsx:349`<br>`components/demo/space-eyes/Programacion.tsx:502`<br>`components/demo/space-eyes/Programacion.tsx:622` | rótulo · texto de ejemplo (placeholder) · texto en pantalla | Nombre | Name |
| `spaceeyes.comun.brillo` | `components/demo/space-eyes/EquipoAdmin.tsx:89`<br>`components/demo/space-eyes/VistaEnVivo.tsx:839`<br>`components/demo/space-eyes/VistaEnVivo.tsx:849` | etiqueta accesible (aria-label) · etiqueta de un valor (mapa de claves) · título / tooltip | Brillo | Brightness |
| `spaceeyes.comun.exposicion` | `components/demo/space-eyes/EquipoAdmin.tsx:90`<br>`components/demo/space-eyes/VistaEnVivo.tsx:803`<br>`components/demo/space-eyes/VistaEnVivo.tsx:817` | etiqueta accesible (aria-label) · etiqueta de un valor (mapa de claves) · título / tooltip | Exposición | Exposure |
| `spaceeyes.comun.balance` | `components/demo/space-eyes/EquipoAdmin.tsx:816`<br>`components/demo/space-eyes/VistaEnVivo.tsx:895` | etiqueta accesible (aria-label) · texto en pantalla | Balance de blancos | White balance |
| `spaceeyes.balance.daylight` | `components/demo/space-eyes/EquipoAdmin.tsx:104`<br>`components/demo/space-eyes/VistaEnVivo.tsx:97` | etiqueta de un valor (mapa de claves) | Luz de día | Daylight |
| `spaceeyes.balance.cloudy` | `components/demo/space-eyes/EquipoAdmin.tsx:105`<br>`components/demo/space-eyes/VistaEnVivo.tsx:98` | etiqueta de un valor (mapa de claves) | Nublado | Cloudy |
| `spaceeyes.balance.fluorescent` | `components/demo/space-eyes/EquipoAdmin.tsx:107`<br>`components/demo/space-eyes/VistaEnVivo.tsx:100` | etiqueta de un valor (mapa de claves) | Fluorescente | Fluorescent |
| `spaceeyes.admin.estado.provisioning` | `components/demo/space-eyes/EquipoAdmin.tsx:80` | etiqueta de un valor (mapa de claves) | En operación | In operation |
| `spaceeyes.admin.estado.active` | `components/demo/space-eyes/EquipoAdmin.tsx:81` | etiqueta de un valor (mapa de claves) | Activa | Active |
| `spaceeyes.admin.estado.maintenance` | `components/demo/space-eyes/EquipoAdmin.tsx:82` | etiqueta de un valor (mapa de claves) | En mantenimiento | Under maintenance |
| `spaceeyes.admin.estado.inactive` | `components/demo/space-eyes/EquipoAdmin.tsx:83` | etiqueta de un valor (mapa de claves) | Dada de baja | Decommissioned |
| `spaceeyes.admin.control.centro-x` | `components/demo/space-eyes/EquipoAdmin.tsx:87` | etiqueta de un valor (mapa de claves) | Centro horizontal | Horizontal center |
| `spaceeyes.admin.control.centro-y` | `components/demo/space-eyes/EquipoAdmin.tsx:88` | etiqueta de un valor (mapa de claves) | Centro vertical | Vertical center |
| `spaceeyes.admin.control.contraste` | `components/demo/space-eyes/EquipoAdmin.tsx:91` | etiqueta de un valor (mapa de claves) | Contraste | Contrast |
| `spaceeyes.admin.control.saturacion` | `components/demo/space-eyes/EquipoAdmin.tsx:92` | etiqueta de un valor (mapa de claves) | Saturación | Saturation |
| `spaceeyes.admin.control.nitidez` | `components/demo/space-eyes/EquipoAdmin.tsx:93` | etiqueta de un valor (mapa de claves) | Nitidez | Sharpness |
| `spaceeyes.admin.medicion.centre` | `components/demo/space-eyes/EquipoAdmin.tsx:97` | etiqueta de un valor (mapa de claves) | Centro del cuadro (normal) | Center of the frame (normal) |
| `spaceeyes.admin.medicion.spot` | `components/demo/space-eyes/EquipoAdmin.tsx:98` | etiqueta de un valor (mapa de claves) | Solo el centro — para exponer la pantalla | Center only — to expose for the screen |
| `spaceeyes.admin.medicion.average` | `components/demo/space-eyes/EquipoAdmin.tsx:99` | etiqueta de un valor (mapa de claves) | Todo el cuadro por igual | Whole frame equally |
| `spaceeyes.admin.medicion.matrix` | `components/demo/space-eyes/EquipoAdmin.tsx:100` | etiqueta de un valor (mapa de claves) | Por zonas | By zones |
| `spaceeyes.admin.balance.auto` | `components/demo/space-eyes/EquipoAdmin.tsx:103` | etiqueta de un valor (mapa de claves) | Automático | Automatic |
| `spaceeyes.admin.balance.tungsten` | `components/demo/space-eyes/EquipoAdmin.tsx:106` | etiqueta de un valor (mapa de claves) | Foco incandescente | Incandescent bulb |
| `spaceeyes.admin.balance.indoor` | `components/demo/space-eyes/EquipoAdmin.tsx:108` | etiqueta de un valor (mapa de claves) | Interior | Indoor |
| `spaceeyes.admin.error` | `components/demo/space-eyes/EquipoAdmin.tsx:171` | texto en pantalla | No se pudo leer el equipo: {error} | Could not read the device: {error} |
| `spaceeyes.admin.leyendo` | `components/demo/space-eyes/EquipoAdmin.tsx:178` | texto en pantalla | Leyendo el equipo… | Reading the device… |
| `spaceeyes.admin.datos.guardados` | `components/demo/space-eyes/EquipoAdmin.tsx:265` | aviso en pantalla | Datos del sitio guardados. | Site details saved. |
| `spaceeyes.admin.ficha` | `components/demo/space-eyes/EquipoAdmin.tsx:289` | texto en pantalla | Ficha del equipo | Device profile |
| `spaceeyes.admin.ficha.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:290` | texto en pantalla | Dónde está y qué aparato es. | Where it is and what hardware it is. |
| `spaceeyes.admin.editar` | `components/demo/space-eyes/EquipoAdmin.tsx:294` | texto en pantalla | Editar datos | Edit details |
| `spaceeyes.admin.sitio` | `components/demo/space-eyes/AltaDispositivo.tsx:624`<br>`components/demo/space-eyes/EquipoAdmin.tsx:300` | rótulo · texto en pantalla | Sitio | Site |
| `spaceeyes.admin.codigo` | `components/demo/space-eyes/EquipoAdmin.tsx:302`<br>`components/demo/space-eyes/EquipoAdmin.tsx:350` | texto en pantalla | Código del espectacular | Billboard code |
| `spaceeyes.admin.direccion` | `components/demo/space-eyes/EquipoAdmin.tsx:303`<br>`components/demo/space-eyes/EquipoAdmin.tsx:351` | texto en pantalla | Dirección | Address |
| `spaceeyes.admin.aparato` | `components/demo/space-eyes/EquipoAdmin.tsx:312` | rótulo | Aparato | Hardware |
| `spaceeyes.admin.version-app` | `components/demo/space-eyes/EquipoAdmin.tsx:315` | texto en pantalla | Versión de la app | App version |
| `spaceeyes.admin.salud` | `components/demo/space-eyes/EquipoAdmin.tsx:317` | rótulo | Conexión y salud | Connection and health |
| `spaceeyes.admin.red` | `components/demo/space-eyes/EquipoAdmin.tsx:318` | texto en pantalla | Red | Network |
| `spaceeyes.admin.operador` | `components/demo/space-eyes/EquipoAdmin.tsx:319` | texto en pantalla | Operador | Carrier |
| `spaceeyes.admin.ip` | `components/demo/space-eyes/EquipoAdmin.tsx:320` | texto en pantalla | IP pública | Public IP |
| `spaceeyes.admin.ultima-conexion` | `components/demo/space-eyes/EquipoAdmin.tsx:321` | texto en pantalla | Última conexión | Last connection |
| `spaceeyes.admin.temp-cpu` | `components/demo/space-eyes/EquipoAdmin.tsx:327` | texto en pantalla | Temperatura CPU | CPU temperature |
| `spaceeyes.admin.temp-bateria` | `components/demo/space-eyes/EquipoAdmin.tsx:328` | texto en pantalla | Temperatura batería | Battery temperature |
| `spaceeyes.admin.editar.titulo` | `components/demo/space-eyes/EquipoAdmin.tsx:335` | título / tooltip | Editar datos del sitio | Edit site details |
| `spaceeyes.admin.nombre-ej` | `components/demo/space-eyes/EquipoAdmin.tsx:349` | texto de ejemplo (placeholder) | Ej. Espectacular Reforma 222 | E.g. Reforma 222 billboard |
| `spaceeyes.admin.ciudad` | `components/demo/space-eyes/EquipoAdmin.tsx:353` | texto en pantalla | Ciudad | City |
| `spaceeyes.admin.estado-region` | `components/demo/space-eyes/EquipoAdmin.tsx:354` | texto en pantalla | Estado | State |
| `spaceeyes.admin.latitud` | `components/demo/space-eyes/EquipoAdmin.tsx:357` | texto de ejemplo (placeholder) | Latitud | Latitude |
| `spaceeyes.admin.longitud` | `components/demo/space-eyes/EquipoAdmin.tsx:358` | texto de ejemplo (placeholder) | Longitud | Longitude |
| `spaceeyes.admin.coordenadas-mal` | `components/demo/space-eyes/EquipoAdmin.tsx:361` | texto en pantalla | La latitud va de −90 a 90 y la longitud de −180 a 180. | Latitude goes from −90 to 90 and longitude from −180 to 180. |
| `spaceeyes.admin.coordenadas` | `components/demo/space-eyes/EquipoAdmin.tsx:363` | texto en pantalla | Déjalas vacías si no las sabes. Sirven para ubicar la pantalla y para calcular la luz de su sitio, que es lo que decide a qué horas la foto sale limpia y a qué horas sale con líneas. | Leave them empty if you do not know them. They place the screen on the map and work out the light at its site, which decides at what times the photo comes out clean and at what times it shows lines. |
| `spaceeyes.admin.estado-pantalla` | `components/demo/space-eyes/EquipoAdmin.tsx:365` | texto en pantalla | Estado de la pantalla | Screen status |
| `spaceeyes.admin.estado-ayuda` | `components/demo/space-eyes/EquipoAdmin.tsx:378` | texto en pantalla | Mantenimiento y dada de baja dejan a la pantalla fuera de las programaciones: no le llegan fotos y deja de gastar datos, sin borrar nada. En operación y activa hoy se comportan igual. | Maintenance and decommissioned take the screen out of the schedules: it gets no photos and stops using data, without deleting anything. In operation and active behave the same today. |
| `spaceeyes.admin.actualizar.pc` | `components/demo/space-eyes/EquipoAdmin.tsx:427` | texto en pantalla | Se instalará el agente publicado en esta PC. Verifica la huella del archivo antes de sustituirlo y, si el programa nuevo no arranca, vuelve solo al anterior. | The published agent will be installed on this PC. It checks the file fingerprint before replacing it and, if the new program does not start, it rolls back on its own. |
| `spaceeyes.admin.actualizar.pi` | `components/demo/space-eyes/EquipoAdmin.tsx:429` | texto en pantalla | Se instalará el agente publicado en esta Raspberry. Verifica la huella y lo prueba antes de reemplazar nada; si la versión nueva no arranca, vuelve sola a la anterior. La identidad del equipo y sus fotos pendientes se conservan. | The published agent will be installed on this Raspberry. It checks the fingerprint and tests it before replacing anything; if the new version does not start, it rolls back on its own. The device identity and its pending photos are kept. |
| `spaceeyes.admin.actualizar.version` | `components/demo/space-eyes/EquipoAdmin.tsx:432` | texto en pantalla | Se instalará la versión {version} en este equipo. Tardará un par de minutos y la app se reiniciará sola. | Version {version} will be installed on this device. It takes a couple of minutes and the app restarts on its own. |
| `spaceeyes.admin.actualizar.publicada` | `components/demo/space-eyes/EquipoAdmin.tsx:433` | texto en pantalla | Se instalará la versión publicada en este equipo. Tardará un par de minutos y la app se reiniciará sola. | The published version will be installed on this device. It takes a couple of minutes and the app restarts on its own. |
| `spaceeyes.admin.actualizar.de-todos-modos` | `components/demo/space-eyes/EquipoAdmin.tsx:434` | texto en pantalla | {como} ¿Enviar de todos modos? | {como} Send anyway? |
| `spaceeyes.admin.orden.reiniciar` | `components/demo/space-eyes/EquipoAdmin.tsx:450` | texto en pantalla | Orden enviada: la app se reinicia en el equipo. | Command sent: the app restarts on the device. |
| `spaceeyes.admin.orden.equipo` | `components/demo/space-eyes/EquipoAdmin.tsx:452` | texto en pantalla | Orden enviada: la Raspberry se reinicia; vuelve a reportar en uno o dos minutos. | Command sent: the Raspberry restarts; it reports again in a minute or two. |
| `spaceeyes.admin.orden.actualizar` | `components/demo/space-eyes/EquipoAdmin.tsx:454` | texto en pantalla | Actualización enviada; el equipo se reiniciará al terminar. | Update sent; the device will restart when it finishes. |
| `spaceeyes.admin.orden.confirmar` | `components/demo/space-eyes/EquipoAdmin.tsx:455` | texto en pantalla | Orden enviada: falta confirmar la instalación en el equipo. | Command sent: the installation still has to be confirmed on the device. |
| `spaceeyes.admin.motivo.apk` | `components/demo/space-eyes/EquipoAdmin.tsx:459` | texto en pantalla | No hay APK publicada en el servidor. | There is no APK published on the server. |
| `spaceeyes.admin.motivo.pc` | `components/demo/space-eyes/EquipoAdmin.tsx:460` | texto en pantalla | No hay agente de PC publicado en el servidor. | There is no PC agent published on the server. |
| `spaceeyes.admin.motivo.pi` | `components/demo/space-eyes/EquipoAdmin.tsx:461` | texto en pantalla | No hay agente de Raspberry publicado en el servidor. | There is no Raspberry agent published on the server. |
| `spaceeyes.admin.orden.error` | `components/demo/space-eyes/EquipoAdmin.tsx:466` | mensaje de error | No se pudo enviar la orden: {motivo} | Could not send the command: {motivo} |
| `spaceeyes.admin.programa` | `components/demo/space-eyes/EquipoAdmin.tsx:477` | texto en pantalla | Programa del equipo | Device software |
| `spaceeyes.admin.programa.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:479` | texto en pantalla | Reiniciar la app, o instalarle la versión publicada, sin ir al sitio. | Restart the app, or install the published version, without going to the site. |
| `spaceeyes.admin.programa.texto-pi` | `components/demo/space-eyes/EquipoAdmin.tsx:479` | texto en pantalla | Reiniciar la app o el equipo, o instalarle la versión publicada, sin ir al sitio. | Restart the app or the device, or install the published version, without going to the site. |
| `spaceeyes.admin.instalada` | `components/demo/space-eyes/EquipoAdmin.tsx:484` | texto en pantalla | Instalada | Installed |
| `spaceeyes.admin.publicada` | `components/demo/space-eyes/EquipoAdmin.tsx:486` | texto en pantalla | Publicada | Published |
| `spaceeyes.admin.sin-numero` | `components/demo/space-eyes/EquipoAdmin.tsx:491` | texto en pantalla | sin número | no number |
| `spaceeyes.admin.nada-publicado` | `components/demo/space-eyes/EquipoAdmin.tsx:492` | texto en pantalla | nada publicado | nothing published |
| `spaceeyes.admin.nueva` | `components/demo/space-eyes/EquipoAdmin.tsx:501` | texto en pantalla | Hay una versión nueva: {version}. | A new version is available: {version}. |
| `spaceeyes.admin.se-instala-sola` | `components/demo/space-eyes/EquipoAdmin.tsx:504` | texto en pantalla | Se instala sola, sin tocar el equipo. | It installs on its own, without touching the device. |
| `spaceeyes.admin.al-dia` | `components/demo/space-eyes/EquipoAdmin.tsx:508` | texto en pantalla | Tiene la versión publicada. | It has the published version. |
| `spaceeyes.admin.actualizaciones` | `components/demo/space-eyes/EquipoAdmin.tsx:517` | texto en pantalla | Actualizaciones: {como} | Updates: {como} |
| `spaceeyes.admin.boton.actualizar` | `components/demo/space-eyes/EquipoAdmin.tsx:527` | texto en pantalla | Actualizar app | Update app |
| `spaceeyes.admin.boton.reiniciar` | `components/demo/space-eyes/EquipoAdmin.tsx:530` | texto en pantalla | Reiniciar app | Restart app |
| `spaceeyes.admin.boton.reiniciar-equipo` | `components/demo/space-eyes/EquipoAdmin.tsx:534`<br>`components/demo/space-eyes/EquipoAdmin.tsx:554` | texto en pantalla | Reiniciar equipo | Restart device |
| `spaceeyes.admin.reiniciar.titulo` | `components/demo/space-eyes/EquipoAdmin.tsx:543` | título / tooltip | Reiniciar la aplicación | Restart the app |
| `spaceeyes.admin.reiniciar.boton` | `components/demo/space-eyes/EquipoAdmin.tsx:544` | texto en pantalla | Reiniciar | Restart |
| `spaceeyes.admin.reiniciar.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:548` | texto en pantalla | Se reinicia la aplicación en el equipo. Deja de reportar unos segundos y vuelve sola. | The app restarts on the device. It stops reporting for a few seconds and comes back on its own. |
| `spaceeyes.admin.reiniciar-pi.titulo` | `components/demo/space-eyes/EquipoAdmin.tsx:553` | título / tooltip | Reiniciar la Raspberry | Restart the Raspberry |
| `spaceeyes.admin.reiniciar-pi.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:558` | texto en pantalla | Se reinicia la Raspberry entera, no solo la app: es lo que destraba una cámara o una red que se quedaron colgadas. Deja de reportar uno o dos minutos y vuelve sola. | The whole Raspberry restarts, not just the app: this is what unsticks a camera or a network that hung. It stops reporting for a minute or two and comes back on its own. |
| `spaceeyes.admin.actualizar.titulo` | `components/demo/space-eyes/EquipoAdmin.tsx:563` | título / tooltip | Actualizar el programa del equipo | Update the device software |
| `spaceeyes.admin.actualizar.boton` | `components/demo/space-eyes/EquipoAdmin.tsx:564` | texto en pantalla | Actualizar | Update |
| `spaceeyes.admin.ajustes.guardados` | `components/demo/space-eyes/EquipoAdmin.tsx:651` | aviso en pantalla | Ajustes guardados: se aplican a todas las fotos del equipo. | Settings saved: they apply to every photo from the device. |
| `spaceeyes.admin.ajustes.no-guardar` | `components/demo/space-eyes/EquipoAdmin.tsx:654` | aviso en pantalla | No se pudieron guardar: {motivo} | Could not save them: {motivo} |
| `spaceeyes.admin.prueba.asi` | `components/demo/space-eyes/EquipoAdmin.tsx:682` | aviso en pantalla | Así se ve con estos ajustes. | This is how it looks with these settings. |
| `spaceeyes.admin.prueba.no-llego` | `components/demo/space-eyes/EquipoAdmin.tsx:686` | aviso en pantalla | No llegó la foto: el equipo puede estar apagado o transmitiendo. | The photo did not arrive: the device may be off or streaming. |
| `spaceeyes.admin.prueba.error` | `components/demo/space-eyes/EquipoAdmin.tsx:691` | aviso en pantalla | No se pudo pedir la foto de prueba: {motivo} | Could not request the test photo: {motivo} |
| `spaceeyes.admin.ajustes` | `components/demo/space-eyes/EquipoAdmin.tsx:731` | texto en pantalla | Ajustes de imagen | Image settings |
| `spaceeyes.admin.ajustes.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:732` | texto en pantalla | Se guardan en el equipo y se aplican a todas sus fotos, incluidas las programadas. | They are stored on the device and apply to all its photos, scheduled ones included. |
| `spaceeyes.admin.ocultar` | `components/demo/space-eyes/EquipoAdmin.tsx:735` | texto en pantalla | Ocultar | Hide |
| `spaceeyes.admin.mostrar` | `components/demo/space-eyes/EquipoAdmin.tsx:735` | texto en pantalla | Mostrar | Show |
| `spaceeyes.admin.giro` | `components/demo/space-eyes/EquipoAdmin.tsx:744` | texto en pantalla | Giro de la foto | Photo rotation |
| `spaceeyes.admin.sin-giro` | `components/demo/space-eyes/EquipoAdmin.tsx:757` | texto en pantalla | Sin giro | No rotation |
| `spaceeyes.admin.giro.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:762` | texto en pantalla | Endereza la foto al recibirla. Es distinto de la orientación de la vista en vivo. | Straightens the photo when it arrives. It is separate from the live view orientation. |
| `spaceeyes.admin.led` | `components/demo/space-eyes/EquipoAdmin.tsx:771` | texto en pantalla | Pantalla de LED | LED screen |
| `spaceeyes.admin.cuadros` | `components/demo/space-eyes/EquipoAdmin.tsx:772` | texto en pantalla | Cuadros a promediar | Frames to average |
| `spaceeyes.admin.cuadros.n` | `components/demo/space-eyes/EquipoAdmin.tsx:773` | texto en pantalla | {n} cuadros | {n} frames |
| `spaceeyes.admin.cuadros.un-disparo` | `components/demo/space-eyes/EquipoAdmin.tsx:773` | texto en pantalla | un disparo | single shot |
| `spaceeyes.admin.cuadros.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:775` | texto en pantalla | Contra las líneas de la pantalla: cada cuadro las agarra en otra posición y al promediarlos se cancelan (con 16 la marca baja de 40% a 10%). Tarda ~1 s más y, si el creativo cambia a media captura, sale mezclado. | Against screen lines: each frame catches them in a different position and averaging cancels them out (with 16 the banding drops from 40% to 10%). It takes ~1 s longer and, if the creative changes mid-capture, it comes out blended. |
| `spaceeyes.admin.medicion` | `components/demo/space-eyes/EquipoAdmin.tsx:778` | texto en pantalla | Dónde mide la luz | Where it meters light |
| `spaceeyes.admin.exposicion-mano` | `components/demo/space-eyes/EquipoAdmin.tsx:801` | texto en pantalla | Fijar la exposición a mano | Set exposure manually |
| `spaceeyes.admin.obturador` | `components/demo/space-eyes/EquipoAdmin.tsx:806` | texto en pantalla | Obturador | Shutter |
| `spaceeyes.admin.ganancia` | `components/demo/space-eyes/EquipoAdmin.tsx:807` | texto en pantalla | Ganancia | Gain |
| `spaceeyes.admin.exposicion-mano.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:809` | texto en pantalla | Al fijarlo se pierde el automático: hay que mover los dos juntos o la foto sale quemada o a oscuras según la hora. | Setting it turns off auto: move both together or the photo comes out blown out or dark depending on the time of day. |
| `spaceeyes.admin.color-mano` | `components/demo/space-eyes/EquipoAdmin.tsx:838` | texto en pantalla | Ajustar el color a mano (necesario si las hojas salen moradas) | Set color manually (needed if leaves come out purple) |
| `spaceeyes.admin.rojo` | `components/demo/space-eyes/EquipoAdmin.tsx:842` | texto en pantalla | Rojo | Red |
| `spaceeyes.admin.azul` | `components/demo/space-eyes/EquipoAdmin.tsx:843` | texto en pantalla | Azul | Blue |
| `spaceeyes.admin.receta.led.ayuda` | `components/demo/space-eyes/EquipoAdmin.tsx:853` | título / tooltip | Promedia 16 cuadros, baja la exposición y mide la luz en la pantalla | Averages 16 frames, lowers exposure and meters light on the screen |
| `spaceeyes.admin.receta.led.aplicada` | `components/demo/space-eyes/EquipoAdmin.tsx:856` | aviso en pantalla | Punto de partida para pantalla aplicado. Prueba y sube o baja la exposición. | Screen starting point applied. Test it and raise or lower the exposure. |
| `spaceeyes.admin.receta.led` | `components/demo/space-eyes/EquipoAdmin.tsx:859` | texto en pantalla | Pantalla de LED: punto de partida | LED screen: starting point |
| `spaceeyes.admin.receta.hojas.ayuda` | `components/demo/space-eyes/EquipoAdmin.tsx:865` | título / tooltip | Para cámaras sin filtro infrarrojo, donde la vegetación sale morada | For cameras without an infrared filter, where vegetation comes out purple |
| `spaceeyes.admin.receta.hojas.aplicada` | `components/demo/space-eyes/EquipoAdmin.tsx:869` | aviso en pantalla | Punto de partida aplicado. Prueba y afina con los deslizadores. | Starting point applied. Test it and fine-tune with the sliders. |
| `spaceeyes.admin.receta.hojas` | `components/demo/space-eyes/EquipoAdmin.tsx:872` | texto en pantalla | Hojas moradas: punto de partida | Purple leaves: starting point |
| `spaceeyes.admin.restablecidos` | `components/demo/space-eyes/EquipoAdmin.tsx:882` | aviso en pantalla | Ajustes en blanco. Guarda para que el equipo los tome. | Settings cleared. Save so the device picks them up. |
| `spaceeyes.admin.restablecer` | `components/demo/space-eyes/EquipoAdmin.tsx:885` | texto en pantalla | Restablecer | Reset |
| `spaceeyes.admin.prueba` | `components/demo/space-eyes/EquipoAdmin.tsx:892`<br>`components/demo/space-eyes/EquipoAdmin.tsx:911` | texto alternativo de imagen · texto en pantalla | Foto de prueba | Test photo |
| `spaceeyes.admin.tomando` | `components/demo/space-eyes/EquipoAdmin.tsx:895` | texto en pantalla | Tomando… | Taking… |
| `spaceeyes.admin.probar` | `components/demo/space-eyes/EquipoAdmin.tsx:895` | texto en pantalla | Probar | Test |
| `spaceeyes.admin.solo-dueno` | `components/demo/space-eyes/EquipoAdmin.tsx:904` | texto en pantalla | Estos ajustes cambian lo que la cámara ve en todas sus fotos: solo los mueve el Dueño. | These settings change what the camera sees in all its photos: only the Owner can change them. |
| `spaceeyes.admin.probar.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:915` | texto en pantalla | «Probar» guarda los ajustes y pide una foto para ver cómo quedan. | “Test” saves the settings and requests a photo to see how they look. |
| `spaceeyes.admin.prueba.datos` | `components/demo/space-eyes/EquipoAdmin.tsx:918` | texto en pantalla | Cada prueba consume una foto de datos. En equipos con SIM, úsala con medida. | Each test uses one photo’s worth of data. On devices with a SIM, use it sparingly. |
| `spaceeyes.admin.registros` | `components/demo/space-eyes/EquipoAdmin.tsx:960` | texto en pantalla | Registros del equipo | Device logs |
| `spaceeyes.admin.registros.texto` | `components/demo/space-eyes/EquipoAdmin.tsx:961` | texto en pantalla | Lo que el equipo reporta de sí mismo, para diagnosticarlo en campo. | What the device reports about itself, to diagnose it in the field. |
| `spaceeyes.admin.registros.error` | `components/demo/space-eyes/EquipoAdmin.tsx:967` | texto en pantalla | No se pudieron leer los registros: {error} | Could not read the logs: {error} |
| `spaceeyes.admin.registros.leyendo` | `components/demo/space-eyes/EquipoAdmin.tsx:971` | texto en pantalla | Leyendo registros… | Reading logs… |
| `spaceeyes.admin.registros.vacio` | `components/demo/space-eyes/EquipoAdmin.tsx:974` | texto en pantalla | Sin registros todavía. | No logs yet. |
| `spaceeyes.comun.reintentar` | `components/demo/space-eyes/Galeria.tsx:363`<br>`components/demo/space-eyes/VistaEnVivo.tsx:734`<br>`components/demo/space-eyes/VistaEnVivo.tsx:1072` | texto en pantalla | Reintentar | Retry |
| `spaceeyes.comun.descartar` | `components/demo/space-eyes/AjustarTexto.tsx:332`<br>`components/demo/space-eyes/FallasFlota.tsx:505`<br>`components/demo/space-eyes/VistaEnVivo.tsx:999` | texto en pantalla | Descartar | Discard |
| `spaceeyes.vivo.balance.auto` | `components/demo/space-eyes/VistaEnVivo.tsx:96` | etiqueta de un valor (mapa de claves) | Balance auto | Auto balance |
| `spaceeyes.vivo.balance.incandescent` | `components/demo/space-eyes/VistaEnVivo.tsx:99` | etiqueta de un valor (mapa de claves) | Incandescente | Incandescent |
| `spaceeyes.vivo.sin-permiso` | `components/demo/space-eyes/VistaEnVivo.tsx:147` | texto de una función (lib o componente) | No tienes permiso para cambiar este equipo | You do not have permission to change this device |
| `spaceeyes.vivo.sin-servidor` | `components/demo/space-eyes/VistaEnVivo.tsx:150` | texto de una función (lib o componente) | El servidor de video no está configurado. Es cosa del servidor, no del equipo. | The video server is not configured. It is a server issue, not the device. |
| `spaceeyes.vivo.no-leer` | `components/demo/space-eyes/AjustarTexto.tsx:137`<br>`components/demo/space-eyes/VistaEnVivo.tsx:218`<br>`components/demo/space-eyes/VistaEnVivo.tsx:704` | aviso en pantalla · mensaje de error · texto en pantalla | No se pudo leer el equipo | Could not read the device |
| `spaceeyes.vivo.otra-persona` | `components/demo/space-eyes/VistaEnVivo.tsx:329`<br>`components/demo/space-eyes/VistaEnVivo.tsx:350` | aviso emergente (toast) · texto en pantalla | otra persona | someone else |
| `spaceeyes.vivo.otra-persona.may` | `components/demo/space-eyes/VistaEnVivo.tsx:501` | aviso emergente (toast) | Otra persona | Someone else |
| `spaceeyes.vivo.no-iniciar.punto` | `components/demo/space-eyes/VistaEnVivo.tsx:332` | texto en pantalla | No se pudo iniciar la transmisión. | Could not start the stream. |
| `spaceeyes.vivo.compartida` | `components/demo/space-eyes/VistaEnVivo.tsx:350` | aviso emergente (toast) | Viendo la transmisión que abrió {quien} | Watching the stream opened by {quien} |
| `spaceeyes.vivo.corte-auto` | `components/demo/space-eyes/VistaEnVivo.tsx:362` | aviso emergente (toast) | Transmisión detenida automáticamente a los 3 minutos | Stream stopped automatically after 3 minutes |
| `spaceeyes.vivo.sin-imagen` | `components/demo/space-eyes/VistaEnVivo.tsx:372` | texto en pantalla | Conectado con el servidor pero no está llegando imagen del equipo. | Connected to the server, but no image is arriving from the device. |
| `spaceeyes.vivo.no-encuadre` | `components/demo/space-eyes/VistaEnVivo.tsx:449` | aviso emergente (toast) | No se pudo guardar el encuadre | Could not save the framing |
| `spaceeyes.vivo.encuadre-fijado` | `components/demo/space-eyes/VistaEnVivo.tsx:452` | aviso emergente (toast) | Encuadre fijado: se aplica también a las fotos programadas | Framing locked: it also applies to scheduled photos |
| `spaceeyes.vivo.ver-asi.compartida` | `components/demo/space-eyes/VistaEnVivo.tsx:501` | aviso emergente (toast) | {quien} está viendo este equipo: la vista sigue con su encuadre. La foto que pidas sí sale como la tienes puesta. | {quien} is watching this device: the view keeps their framing. The photo you request does come out the way you set it. |
| `spaceeyes.vivo.ver-asi.lente` | `components/demo/space-eyes/VistaEnVivo.tsx:504` | aviso emergente (toast) | Así se ve con este lente. No cambió el encuadre del sitio. | This is how it looks with this lens. The site framing did not change. |
| `spaceeyes.vivo.ver-asi.nitido` | `components/demo/space-eyes/VistaEnVivo.tsx:504` | aviso emergente (toast) | Ya se ve nítido a este acercamiento. No cambió el encuadre del sitio. | It now looks sharp at this zoom. The site framing did not change. |
| `spaceeyes.vivo.enfoque.fijado` | `components/demo/space-eyes/VistaEnVivo.tsx:513` | aviso emergente (toast) | Enfoque fijado: se aplica solo cada vez que se abra la vista | Focus locked: it applies automatically every time the view opens |
| `spaceeyes.vivo.enfoque.libre` | `components/demo/space-eyes/VistaEnVivo.tsx:513` | aviso emergente (toast) | Enfoque libre: la cámara vuelve a enfocar sola | Focus unlocked: the camera focuses on its own again |
| `spaceeyes.vivo.enfoque.no-guardar` | `components/demo/space-eyes/VistaEnVivo.tsx:515` | aviso emergente (toast) | No se pudo guardar el enfoque | Could not save the focus |
| `spaceeyes.vivo.orientacion.fijada` | `components/demo/space-eyes/VistaEnVivo.tsx:546` | aviso emergente (toast) | Orientación fijada para todos | Orientation locked for everyone |
| `spaceeyes.vivo.orientacion.no-fijar` | `components/demo/space-eyes/VistaEnVivo.tsx:548` | aviso emergente (toast) | No se pudo fijar la orientación | Could not lock the orientation |
| `spaceeyes.vivo.foto.pedida` | `components/demo/space-eyes/VistaEnVivo.tsx:576` | aviso emergente (toast) | Foto pedida: llega en unos segundos | Photo requested: it arrives in a few seconds |
| `spaceeyes.vivo.titulo` | `components/demo/space-eyes/VistaEnVivo.tsx:639` | rótulo | Vista en vivo | Live view |
| `spaceeyes.vivo.en-vivo` | `components/demo/space-eyes/FichaEquipo.tsx:372`<br>`components/demo/space-eyes/VistaEnVivo.tsx:643` | texto en pantalla | En vivo | Live |
| `spaceeyes.vivo.corte.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:649` | título / tooltip | La transmisión se detiene sola para no gastar datos del equipo | The stream stops on its own so it does not use the device data |
| `spaceeyes.vivo.corte` | `components/demo/space-eyes/VistaEnVivo.tsx:650` | texto en pantalla | Corte en␣ | Stops in␣ |
| `spaceeyes.vivo.foto` | `components/demo/space-eyes/Verificacion.tsx:198`<br>`components/demo/space-eyes/VistaEnVivo.tsx:657` | texto en pantalla | Foto | Photo |
| `spaceeyes.vivo.iniciar` | `components/demo/space-eyes/VistaEnVivo.tsx:663` | texto en pantalla | Iniciar | Start |
| `spaceeyes.vivo.conectando` | `components/demo/space-eyes/VistaEnVivo.tsx:668` | texto en pantalla | Conectando… | Connecting… |
| `spaceeyes.vivo.detener` | `components/demo/space-eyes/VistaEnVivo.tsx:673` | texto en pantalla | Detener | Stop |
| `spaceeyes.vivo.agente-viejo` | `components/demo/space-eyes/VistaEnVivo.tsx:712` | texto en pantalla | Agente anterior a la vista en vivo | Agent older than the live view |
| `spaceeyes.vivo.agente-viejo.texto` | `components/demo/space-eyes/VistaEnVivo.tsx:713` | texto en pantalla | Esta PC corre el agente v1.0. Actualízala y la vista en vivo se enciende sola. Mientras tanto, usa «Foto» para ver el sitio. | This PC runs agent v1.0. Update it and the live view turns on by itself. Meanwhile, use “Photo” to see the site. |
| `spaceeyes.vivo.p2p` | `components/demo/space-eyes/VistaEnVivo.tsx:718` | texto en pantalla | Este equipo transmite punto a punto | This device streams peer to peer |
| `spaceeyes.vivo.p2p.texto` | `components/demo/space-eyes/VistaEnVivo.tsx:719` | texto en pantalla | Su versión no pasa el video por el servidor de medios, y desde aquí solo se puede ver por ahí. Actualiza la app del equipo para verlo en vivo. | Its version does not route video through the media server, and from here it can only be watched that way. Update the device app to watch it live. |
| `spaceeyes.vivo.conectando.equipo` | `components/demo/space-eyes/VistaEnVivo.tsx:724` | texto en pantalla | Conectando con el equipo… | Connecting to the device… |
| `spaceeyes.vivo.conectando.texto` | `components/demo/space-eyes/VistaEnVivo.tsx:725` | texto en pantalla | Puede tardar unos segundos mientras la cámara arranca. No hace falta volver a presionar. | It can take a few seconds while the camera starts. No need to click again. |
| `spaceeyes.vivo.no-iniciar` | `components/demo/space-eyes/VistaEnVivo.tsx:730` | texto en pantalla | No se pudo iniciar la transmisión | Could not start the stream |
| `spaceeyes.vivo.apagada` | `components/demo/space-eyes/VistaEnVivo.tsx:740` | texto en pantalla | Vista en vivo apagada | Live view off |
| `spaceeyes.vivo.iniciar-vista` | `components/demo/space-eyes/VistaEnVivo.tsx:744` | texto en pantalla | Iniciar vista en vivo | Start live view |
| `spaceeyes.vivo.sin-permiso-abrir` | `components/demo/space-eyes/VistaEnVivo.tsx:747` | texto en pantalla | Necesitas permiso para operar equipos para abrir la vista. | You need permission to operate devices to open the view. |
| `spaceeyes.vivo.no-reporta` | `components/demo/space-eyes/VistaEnVivo.tsx:750` | texto en pantalla | El equipo no está reportando: puede que no conteste. | The device is not reporting: it may not answer. |
| `spaceeyes.vivo.se-detiene` | `components/demo/space-eyes/VistaEnVivo.tsx:752` | texto en pantalla | Se detiene sola a los 3 minutos para no gastar datos del equipo. | It stops on its own after 3 minutes so it does not use the device data. |
| `spaceeyes.vivo.enfoque-fijo` | `components/demo/space-eyes/VistaEnVivo.tsx:778`<br>`components/demo/space-eyes/VistaEnVivo.tsx:909` | texto en pantalla | Enfoque fijo | Focus locked |
| `spaceeyes.vivo.fijar-enfoque` | `components/demo/space-eyes/VistaEnVivo.tsx:909` | texto en pantalla | Fijar enfoque | Lock focus |
| `spaceeyes.vivo.mover-lados` | `components/demo/space-eyes/VistaEnVivo.tsx:866`<br>`components/demo/space-eyes/VistaEnVivo.tsx:867` | etiqueta accesible (aria-label) · título / tooltip | Mover a los lados | Move sideways |
| `spaceeyes.vivo.mover-arriba` | `components/demo/space-eyes/VistaEnVivo.tsx:877`<br>`components/demo/space-eyes/VistaEnVivo.tsx:878` | etiqueta accesible (aria-label) · título / tooltip | Mover arriba y abajo | Move up and down |
| `spaceeyes.vivo.girar-izq` | `components/demo/space-eyes/VistaEnVivo.tsx:918`<br>`components/demo/space-eyes/VistaEnVivo.tsx:919` | etiqueta accesible (aria-label) · título / tooltip | Girar a la izquierda | Rotate left |
| `spaceeyes.vivo.girar-der` | `components/demo/space-eyes/VistaEnVivo.tsx:928`<br>`components/demo/space-eyes/VistaEnVivo.tsx:929` | etiqueta accesible (aria-label) · título / tooltip | Girar a la derecha | Rotate right |
| `spaceeyes.vivo.lente` | `components/demo/space-eyes/VistaEnVivo.tsx:942` | etiqueta accesible (aria-label) | Lente | Lens |
| `spaceeyes.vivo.lente.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:941` | título / tooltip | Gran angular: abarca más desde la misma distancia. Solo si el equipo lo tiene. | Wide angle: covers more from the same distance. Only if the device has it. |
| `spaceeyes.vivo.lente.normal` | `components/demo/space-eyes/VistaEnVivo.tsx:945` | texto en pantalla | Lente normal | Normal lens |
| `spaceeyes.vivo.lente.gran-angular` | `components/demo/space-eyes/VistaEnVivo.tsx:948` | texto en pantalla | Gran angular 0.5x | Wide angle 0.5x |
| `spaceeyes.vivo.ver-lente.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:966` | título / tooltip | Abre la vista con este lente. No cambia el encuadre del sitio. | Opens the view with this lens. It does not change the site framing. |
| `spaceeyes.vivo.ver-nitido.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:966` | título / tooltip | Abre la vista a este acercamiento, ya nítida. No cambia el encuadre del sitio. | Opens the view at this zoom, sharp. It does not change the site framing. |
| `spaceeyes.vivo.abriendo` | `components/demo/space-eyes/VistaEnVivo.tsx:970` | texto en pantalla | Abriendo… | Opening… |
| `spaceeyes.vivo.ver-lente` | `components/demo/space-eyes/VistaEnVivo.tsx:972` | texto en pantalla | Ver con este lente | View with this lens |
| `spaceeyes.vivo.ver-nitido` | `components/demo/space-eyes/VistaEnVivo.tsx:973` | texto en pantalla | Ver nítido | View sharp |
| `spaceeyes.vivo.fijar-encuadre.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:982` | título / tooltip | Guarda el encuadre actual. Se aplica también a las fotos programadas. | Saves the current framing. It also applies to scheduled photos. |
| `spaceeyes.vivo.aplicando` | `components/demo/space-eyes/VistaEnVivo.tsx:986` | texto en pantalla | Aplicando… | Applying… |
| `spaceeyes.vivo.fijar-encuadre` | `components/demo/space-eyes/VistaEnVivo.tsx:988`<br>`components/demo/space-eyes/VistaEnVivo.tsx:1039`<br>`components/demo/space-eyes/VistaEnVivo.tsx:1043` | texto en pantalla | Fijar encuadre | Lock framing |
| `spaceeyes.vivo.encuadre-guardado` | `components/demo/space-eyes/VistaEnVivo.tsx:989` | texto en pantalla | Encuadre guardado | Framing saved |
| `spaceeyes.vivo.descartar.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:997` | título / tooltip | Volver al encuadre que tiene guardado el equipo | Go back to the framing saved on the device |
| `spaceeyes.vivo.fijar-orientacion.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:1007` | título / tooltip | Fijar esta orientación para todos | Lock this orientation for everyone |
| `spaceeyes.vivo.fijar-orientacion` | `components/demo/space-eyes/VistaEnVivo.tsx:1010` | texto en pantalla | Fijar orientación | Lock orientation |
| `spaceeyes.vivo.volver.ayuda` | `components/demo/space-eyes/VistaEnVivo.tsx:1018` | título / tooltip | Volver a la orientación guardada del equipo | Go back to the orientation saved on the device |
| `spaceeyes.vivo.volver` | `components/demo/space-eyes/VistaEnVivo.tsx:1020` | texto en pantalla | Volver | Revert |
| `spaceeyes.vivo.pie.mirar` | `components/demo/space-eyes/VistaEnVivo.tsx:1031` | texto en pantalla | Mueve el zoom, el lente, la luz y el enfoque a tu gusto y pide la foto: {asi}. | Adjust the zoom, lens, light and focus as you like and request the photo: {asi}. |
| `spaceeyes.vivo.pie.mirar.asi` | `components/demo/space-eyes/VistaEnVivo.tsx:1032` | texto en pantalla | sale como la estás viendo | it comes out as you see it |
| `spaceeyes.vivo.pie.mirar.relay` | `components/demo/space-eyes/VistaEnVivo.tsx:1034` | texto en pantalla | Aquí el acercamiento es una vista previa: «Ver nítido» abre la imagen de verdad.␣ | Here the zoom is a preview: “View sharp” opens the real image.␣ |
| `spaceeyes.vivo.pie.mirar.nada` | `components/demo/space-eyes/VistaEnVivo.tsx:1035` | texto en pantalla | Nada de esto se guarda, así que el encuadre del sitio no cambia —fijarlo para todos lo hace solo el Dueño, porque borra lo que el equipo aprendió de su pantalla—. | None of this is saved, so the site framing does not change (only the Owner locks it for everyone, because it erases what the device learned about its screen). |
| `spaceeyes.vivo.pie.relay` | `components/demo/space-eyes/VistaEnVivo.tsx:1038` | texto en pantalla | Lo que ves al mover los deslizadores es una vista previa: el equipo no cambia hasta que pulses {boton} (ahí la vista se reabre un segundo para traer la imagen nítida). | What you see while moving the sliders is a preview: the device does not change until you click {boton} (then the view reopens for a second to bring in the sharp image). |
| `spaceeyes.vivo.pie.telefono` | `components/demo/space-eyes/VistaEnVivo.tsx:1042` | texto en pantalla | Toca el video para enfocar. El zoom, la exposición y el balance cambian la cámara al momento, pero son temporales: solo el zoom y el lente se guardan, al pulsar {boton}. | Click the video to focus. Zoom, exposure and balance change the camera instantly, but they are temporary: only zoom and lens are saved, when you click {boton}. |
| `spaceeyes.vivo.pie.orientacion` | `components/demo/space-eyes/VistaEnVivo.tsx:1046` | texto en pantalla | La orientación fija es la que todos ven al abrir la vista. | The locked orientation is the one everyone sees when opening the view. |
| `spaceeyes.vivo.en-uso` | `components/demo/space-eyes/VistaEnVivo.tsx:1056` | texto en pantalla | Vista en uso | View in use |
| `spaceeyes.vivo.en-uso.quien` | `components/demo/space-eyes/VistaEnVivo.tsx:1058` | texto en pantalla | {quien} está viendo este equipo desde hace {min} min. | {quien} has been watching this device for {min} min. |
| `spaceeyes.vivo.en-uso.texto` | `components/demo/space-eyes/VistaEnVivo.tsx:1063` | texto en pantalla | Este equipo solo admite un espectador a la vez: cada conexión de video gasta datos móviles del sitio. La transmisión se corta sola a los 3 minutos. | This device allows only one viewer at a time: each video connection uses the site mobile data. The stream stops on its own after 3 minutes. |
| `spaceeyes.vivo.aplicando-encuadre` | `components/demo/space-eyes/VistaEnVivo.tsx:1082` | texto en pantalla | Aplicando el encuadre nuevo… | Applying the new framing… |
| `spaceeyes.comun.desde` | `components/demo/space-eyes/Galeria.tsx:307`<br>`components/demo/space-eyes/Graficas.tsx:409`<br>`components/demo/space-eyes/Programacion.tsx:692` | rótulo · texto en pantalla | Desde | From |
| `spaceeyes.comun.hasta` | `components/demo/space-eyes/Galeria.tsx:317`<br>`components/demo/space-eyes/Graficas.tsx:418`<br>`components/demo/space-eyes/Programacion.tsx:704` | rótulo · texto en pantalla | Hasta | To |
| `spaceeyes.comun.todos-equipos` | `components/demo/space-eyes/FallasFlota.tsx:203`<br>`components/demo/space-eyes/Galeria.tsx:338`<br>`components/demo/space-eyes/Programacion.tsx:138`<br>`components/demo/space-eyes/Programacion.tsx:594` | texto de una función (lib o componente) · texto en pantalla | Todos los equipos | All devices |
| `spaceeyes.comun.equipo-n` | `components/demo/space-eyes/Galeria.tsx:341`<br>`components/demo/space-eyes/Galeria.tsx:523` | texto en pantalla | Equipo {id} | Device {id} |
| `spaceeyes.comun.anterior` | `components/demo/space-eyes/Galeria.tsx:400`<br>`components/demo/space-eyes/Verificacion.tsx:282` | texto en pantalla | Anterior | Previous |
| `spaceeyes.comun.siguiente` | `components/demo/space-eyes/Galeria.tsx:408`<br>`components/demo/space-eyes/Verificacion.tsx:291` | texto en pantalla | Siguiente | Next |
| `spaceeyes.comun.pagina` | `components/demo/space-eyes/Galeria.tsx:405`<br>`components/demo/space-eyes/Verificacion.tsx:273` | texto en pantalla | Página {pagina} | Page {pagina} |
| `spaceeyes.comun.pagina-de` | `components/demo/space-eyes/Galeria.tsx:404` | texto en pantalla | Página {pagina} de {paginas} | Page {pagina} of {paginas} |
| `spaceeyes.comun.eliminar` | `components/demo/space-eyes/Galeria.tsx:433`<br>`components/demo/space-eyes/Galeria.tsx:695`<br>`components/demo/space-eyes/Programacion.tsx:491`<br>`components/demo/space-eyes/Programacion.tsx:544`<br>`components/demo/space-eyes/Programacion.tsx:561` | texto en pantalla | Eliminar | Delete |
| `spaceeyes.comun.error-desconocido` | `components/demo/space-eyes/CampanasEyes.tsx:296`<br>`components/demo/space-eyes/Galeria.tsx:202`<br>`components/demo/space-eyes/Galeria.tsx:261`<br>`components/demo/space-eyes/Galeria.tsx:592` | aviso en pantalla · mensaje de error | error desconocido | unknown error |
| `spaceeyes.galeria.origen.manual` | `components/demo/space-eyes/Galeria.tsx:80` | etiqueta de un valor (mapa de claves) | Manual | Manual |
| `spaceeyes.galeria.origen.scheduled` | `components/demo/space-eyes/Galeria.tsx:81` | etiqueta de un valor (mapa de claves) | Programada | Scheduled |
| `spaceeyes.galeria.origen.on-demand` | `components/demo/space-eyes/Galeria.tsx:82` | etiqueta de un valor (mapa de claves) | A petición | On request |
| `spaceeyes.galeria.origen.creative` | `components/demo/space-eyes/Galeria.tsx:83` | etiqueta de un valor (mapa de claves) | Creativo nuevo | New creative |
| `spaceeyes.galeria.origen.falla` | `components/demo/space-eyes/Galeria.tsx:84` | etiqueta de un valor (mapa de claves) | Falla de pantalla | Screen fault |
| `spaceeyes.galeria.origen.boot` | `components/demo/space-eyes/Galeria.tsx:85` | etiqueta de un valor (mapa de claves) | Al encender | At startup |
| `spaceeyes.galeria.verif.pending` | `components/demo/space-eyes/Galeria.tsx:90` | etiqueta de un valor (mapa de claves) | Sin verificar | Not verified |
| `spaceeyes.galeria.verif.queued` | `components/demo/space-eyes/Galeria.tsx:91` | etiqueta de un valor (mapa de claves) | En cola | Queued |
| `spaceeyes.galeria.verif.running` | `components/demo/space-eyes/Galeria.tsx:92` | etiqueta de un valor (mapa de claves) | Verificando | Verifying |
| `spaceeyes.galeria.verif.verified` | `components/demo/space-eyes/Galeria.tsx:93` | etiqueta de un valor (mapa de claves) | Verificada | Verified |
| `spaceeyes.galeria.verif.failed` | `components/demo/space-eyes/Galeria.tsx:94` | etiqueta de un valor (mapa de claves) | Falló la verificación | Verification failed |
| `spaceeyes.galeria.verif.skipped` | `components/demo/space-eyes/Galeria.tsx:95` | etiqueta de un valor (mapa de claves) | Omitida | Skipped |
| `spaceeyes.galeria.verif.correcta` | `components/demo/space-eyes/Galeria.tsx:471` | texto en pantalla | Verificada · correcta | Verified · correct |
| `spaceeyes.galeria.verif.no-coincide` | `components/demo/space-eyes/Galeria.tsx:471` | texto en pantalla | Verificada · no coincide | Verified · does not match |
| `spaceeyes.galeria.error` | `components/demo/space-eyes/Galeria.tsx:169`<br>`components/demo/space-eyes/Galeria.tsx:360` | mensaje de error · texto en pantalla | No se pudieron consultar las fotos | Could not load the photos |
| `spaceeyes.galeria.eliminada` | `components/demo/space-eyes/Galeria.tsx:200` | aviso en pantalla | Fotografía eliminada | Photo deleted |
| `spaceeyes.galeria.no-eliminar` | `components/demo/space-eyes/Galeria.tsx:202` | aviso en pantalla | No se pudo eliminar la fotografía: {motivo} | Could not delete the photo: {motivo} |
| `spaceeyes.galeria.preparando` | `components/demo/space-eyes/Galeria.tsx:210` | texto en pantalla | Preparando… | Preparing… |
| `spaceeyes.galeria.album.vacio` | `components/demo/space-eyes/Galeria.tsx:221` | aviso en pantalla | Sin fotos para descargar | No photos to download |
| `spaceeyes.galeria.album.ninguna` | `components/demo/space-eyes/Galeria.tsx:249` | aviso en pantalla | No se pudo descargar ninguna foto del álbum | Could not download any photo from the album |
| `spaceeyes.galeria.album.parcial.uno` | `components/demo/space-eyes/Galeria.tsx:256` | texto en pantalla | Álbum descargado; {n} foto no se pudo incluir | Album downloaded; {n} photo could not be included |
| `spaceeyes.galeria.album.parcial.otros` | `components/demo/space-eyes/Galeria.tsx:256` | texto en pantalla | Álbum descargado; {n} fotos no se pudo incluir | Album downloaded; {n} photos could not be included |
| `spaceeyes.galeria.album.listo` | `components/demo/space-eyes/Galeria.tsx:257` | texto en pantalla | Álbum descargado | Album downloaded |
| `spaceeyes.galeria.album.error` | `components/demo/space-eyes/Galeria.tsx:261` | aviso en pantalla | Error al descargar el álbum: {motivo} | Error downloading the album: {motivo} |
| `spaceeyes.galeria.titulo` | `components/demo/space-eyes/Galeria.tsx:283` | rótulo | Galería de fotos | Photo gallery |
| `spaceeyes.galeria.descripcion` | `components/demo/space-eyes/Galeria.tsx:284` | texto en pantalla | Todas las fotos de los equipos: programadas, pedidas a mano, de creativos nuevos y de fallas. | Every photo from the devices: scheduled, requested by hand, of new creatives and of faults. |
| `spaceeyes.galeria.album.ayuda` | `components/demo/space-eyes/Galeria.tsx:296` | título / tooltip | Descarga en un .zip todas las fotos que coinciden con los filtros, con su marca | Downloads every photo that matches the filters as a .zip, with its label |
| `spaceeyes.galeria.descargando` | `components/demo/space-eyes/Galeria.tsx:299` | texto en pantalla | Descargando {progreso} | Downloading {progreso} |
| `spaceeyes.galeria.album` | `components/demo/space-eyes/Galeria.tsx:299` | texto en pantalla | Descargar álbum | Download album |
| `spaceeyes.galeria.origen` | `components/demo/space-eyes/Galeria.tsx:327` | texto en pantalla | Origen | Source |
| `spaceeyes.galeria.origenes` | `components/demo/space-eyes/Galeria.tsx:329` | texto en pantalla | Todos los orígenes | All sources |
| `spaceeyes.galeria.quitar-filtros` | `components/demo/space-eyes/Galeria.tsx:351` | texto en pantalla | Quitar filtros | Clear filters |
| `spaceeyes.galeria.vacio.filtros` | `components/demo/space-eyes/Galeria.tsx:374` | texto en pantalla | Sin fotos para los filtros seleccionados. | No photos for the selected filters. |
| `spaceeyes.galeria.vacio` | `components/demo/space-eyes/Galeria.tsx:374` | texto en pantalla | Todavía no hay fotos de ningún equipo. | No photos from any device yet. |
| `spaceeyes.galeria.total.uno` | `components/demo/space-eyes/Galeria.tsx:393` | texto en pantalla | {n} fotos | {n} photo |
| `spaceeyes.galeria.total.otros` | `components/demo/space-eyes/Galeria.tsx:393` | texto en pantalla | {n} fotos | {n} photos |
| `spaceeyes.galeria.filtradas` | `components/demo/space-eyes/Galeria.tsx:396` | texto en pantalla | Fotos filtradas | Filtered photos |
| `spaceeyes.galeria.eliminar` | `components/demo/space-eyes/Galeria.tsx:432`<br>`components/demo/space-eyes/Galeria.tsx:515`<br>`components/demo/space-eyes/Galeria.tsx:516` | etiqueta accesible (aria-label) · título / tooltip | Eliminar fotografía | Delete photo |
| `spaceeyes.galeria.eliminar.pregunta` | `components/demo/space-eyes/Galeria.tsx:440` | texto en pantalla | ¿Eliminar esta fotografía? | Delete this photo? |
| `spaceeyes.galeria.eliminar.pregunta.de` | `components/demo/space-eyes/Galeria.tsx:439` | texto en pantalla | ¿Eliminar esta fotografía de {nombre}? | Delete this photo from {nombre}? |
| `spaceeyes.galeria.eliminar.texto` | `components/demo/space-eyes/Galeria.tsx:442` | texto en pantalla | No se puede deshacer. | This cannot be undone. |
| `spaceeyes.galeria.equipo` | `components/demo/space-eyes/Galeria.tsx:490`<br>`components/demo/space-eyes/Galeria.tsx:495`<br>`components/demo/space-eyes/Galeria.tsx:618`<br>`components/demo/space-eyes/Galeria.tsx:661`<br>`components/demo/space-eyes/Verificacion.tsx:157`<br>`components/demo/space-eyes/Verificacion.tsx:230` | etiqueta accesible (aria-label) · texto alternativo de imagen · texto en pantalla | equipo | device |
| `spaceeyes.galeria.ver-grande` | `components/demo/space-eyes/Galeria.tsx:490` | etiqueta accesible (aria-label) | Ver foto de {nombre} en grande | View photo from {nombre} larger |
| `spaceeyes.galeria.alt` | `components/demo/space-eyes/Galeria.tsx:495` | texto alternativo de imagen | Foto {id} de {nombre} | Photo {id} from {nombre} |
| `spaceeyes.galeria.no-cargar` | `components/demo/space-eyes/Galeria.tsx:503` | texto en pantalla | No se pudo cargar | Could not load |
| `spaceeyes.galeria.sin-archivo` | `components/demo/space-eyes/Galeria.tsx:587` | mensaje de error | La foto no tiene archivo | The photo has no file |
| `spaceeyes.galeria.descargando-foto` | `components/demo/space-eyes/Galeria.tsx:590` | aviso en pantalla | Descargando foto… | Downloading photo… |
| `spaceeyes.galeria.no-descargar` | `components/demo/space-eyes/Galeria.tsx:592` | aviso en pantalla | No se pudo descargar la foto: {motivo} | Could not download the photo: {motivo} |
| `spaceeyes.galeria.foto-de` | `components/demo/space-eyes/Galeria.tsx:618`<br>`components/demo/space-eyes/Galeria.tsx:661`<br>`components/demo/space-eyes/Verificacion.tsx:157`<br>`components/demo/space-eyes/Verificacion.tsx:230` | texto alternativo de imagen · texto en pantalla | Foto de {nombre} | Photo from {nombre} |
| `spaceeyes.galeria.anterior` | `components/demo/space-eyes/Galeria.tsx:640` | etiqueta accesible (aria-label) | Foto anterior | Previous photo |
| `spaceeyes.galeria.siguiente` | `components/demo/space-eyes/Galeria.tsx:650` | etiqueta accesible (aria-label) | Foto siguiente | Next photo |
| `spaceeyes.galeria.no-cargar-foto` | `components/demo/space-eyes/Galeria.tsx:667` | texto en pantalla | No se pudo cargar la foto. | Could not load the photo. |
| `spaceeyes.galeria.rotar` | `components/demo/space-eyes/Galeria.tsx:688` | texto en pantalla | Rotar | Rotate |
| `spaceeyes.comun.confianza` | `components/demo/space-eyes/FallasFlota.tsx:297`<br>`components/demo/space-eyes/Verificacion.tsx:204` | rótulo · texto en pantalla | Confianza | Confidence |
| `spaceeyes.comun.opcional` | `components/demo/space-eyes/FallasFlota.tsx:519`<br>`components/demo/space-eyes/Programacion.tsx:692`<br>`components/demo/space-eyes/Programacion.tsx:704` | texto en pantalla | (opcional) | (optional) |
| `spaceeyes.fallas.filtro.todas` | `components/demo/space-eyes/FallasFlota.tsx:69` | texto en pantalla | Todas | All |
| `spaceeyes.fallas.abiertas` | `components/demo/space-eyes/FallasFlota.tsx:70`<br>`components/demo/space-eyes/FallasFlota.tsx:248` | rótulo · texto en pantalla | Abiertas | Open |
| `spaceeyes.fallas.recuperadas` | `components/demo/space-eyes/FallasFlota.tsx:71`<br>`components/demo/space-eyes/FallasFlota.tsx:249` | rótulo · texto en pantalla | Recuperadas | Cleared |
| `spaceeyes.fallas.descartadas` | `components/demo/space-eyes/FallasFlota.tsx:72`<br>`components/demo/space-eyes/FallasFlota.tsx:250` | rótulo · texto en pantalla | No eran falla | Not faults |
| `spaceeyes.fallas.donde.gabinete` | `components/demo/space-eyes/FallasFlota.tsx:79` | texto en pantalla | Gabinete {n} (fila {fila}, columna {columna}) | Cabinet {n} (row {fila}, column {columna}) |
| `spaceeyes.fallas.donde.gabinetes` | `components/demo/space-eyes/FallasFlota.tsx:84` | texto en pantalla | Gabinetes {lista} | Cabinets {lista} |
| `spaceeyes.fallas.donde.de` | `components/demo/space-eyes/FallasFlota.tsx:85` | texto en pantalla | ␣({n} de {total}) | ␣({n} of {total}) |
| `spaceeyes.fallas.donde.camara` | `components/demo/space-eyes/FallasFlota.tsx:88` | texto en pantalla | Cámara (hay que volver a marcar la pantalla) | Camera (the screen has to be marked again) |
| `spaceeyes.fallas.donde.sin-imagen` | `components/demo/space-eyes/FallasFlota.tsx:89` | texto en pantalla | Lente tapada, o pantalla apagada de noche | Lens covered, or screen off at night |
| `spaceeyes.fallas.donde.toda` | `components/demo/space-eyes/FallasFlota.tsx:90` | texto en pantalla | Toda la pantalla | The whole screen |
| `spaceeyes.fallas.no-consultar` | `components/demo/space-eyes/FallasFlota.tsx:133` | mensaje de error | No se pudo consultar Space Eye | Could not reach Space Eye |
| `spaceeyes.fallas.descartada` | `components/demo/space-eyes/FallasFlota.tsx:165` | aviso en pantalla | Falla descartada. | Fault dismissed. |
| `spaceeyes.fallas.arreglada` | `components/demo/space-eyes/FallasFlota.tsx:165` | aviso en pantalla | Falla marcada como arreglada. | Fault marked as fixed. |
| `spaceeyes.fallas.sin-permiso` | `components/demo/space-eyes/FallasFlota.tsx:170` | texto en pantalla | No tienes permiso para cerrar fallas. | You do not have permission to close faults. |
| `spaceeyes.fallas.ya-cerrada` | `components/demo/space-eyes/FallasFlota.tsx:172` | texto en pantalla | Esta falla ya no está abierta. | This fault is no longer open. |
| `spaceeyes.fallas.no-cerrar` | `components/demo/space-eyes/FallasFlota.tsx:177` | aviso en pantalla | No se pudo cerrar: {motivo} | Could not close it: {motivo} |
| `spaceeyes.fallas.titulo` | `components/demo/space-eyes/FallasFlota.tsx:190` | rótulo | Fallas de pantalla | Screen faults |
| `spaceeyes.fallas.descripcion` | `components/demo/space-eyes/FallasFlota.tsx:191` | texto en pantalla | Lo que cada equipo detectó por sí mismo al revisar su pantalla. Se actualiza cada minuto. | What each device detected on its own while checking its screen. Refreshes every minute. |
| `spaceeyes.fallas.error` | `components/demo/space-eyes/FallasFlota.tsx:240` | texto en pantalla | No se pudieron leer las fallas | Could not read the faults |
| `spaceeyes.fallas.atencion` | `components/demo/space-eyes/FallasFlota.tsx:257` | texto en pantalla | Requieren atención · {n} | Need attention · {n} |
| `spaceeyes.fallas.detectada` | `components/demo/space-eyes/FallasFlota.tsx:282` | texto en pantalla | Falla detectada | Fault detected |
| `spaceeyes.fallas.zona` | `components/demo/space-eyes/FallasFlota.tsx:291`<br>`components/demo/space-eyes/FallasFlota.tsx:399` | rótulo · texto en pantalla | Zona | Area |
| `spaceeyes.fallas.ya-arreglada` | `components/demo/space-eyes/FallasFlota.tsx:303` | texto en pantalla | Ya se arregló | It is fixed |
| `spaceeyes.fallas.no-es` | `components/demo/space-eyes/FallasFlota.tsx:306` | texto en pantalla | No es falla | Not a fault |
| `spaceeyes.fallas.historial` | `components/demo/space-eyes/FallasFlota.tsx:320` | texto en pantalla | Historial | History |
| `spaceeyes.fallas.leyendo` | `components/demo/space-eyes/FallasFlota.tsx:340` | texto en pantalla | Leyendo las fallas… | Reading the faults… |
| `spaceeyes.fallas.vacio` | `components/demo/space-eyes/FallasFlota.tsx:343` | texto en pantalla | Sin fallas con este filtro. | No faults with this filter. |
| `spaceeyes.fallas.foto-detectar` | `components/demo/space-eyes/FallasFlota.tsx:375` | texto en pantalla | Foto al detectar | Photo when detected |
| `spaceeyes.fallas.foto-recuperar` | `components/demo/space-eyes/FallasFlota.tsx:384` | texto en pantalla | Foto al recuperar | Photo when cleared |
| `spaceeyes.fallas.recuperacion` | `components/demo/space-eyes/FallasFlota.tsx:401` | texto en pantalla | Recuperación | Cleared |
| `spaceeyes.fallas.cierre.no-es` | `components/demo/space-eyes/FallasFlota.tsx:494` | título / tooltip | No es una falla | Not a fault |
| `spaceeyes.fallas.cierre.arreglada` | `components/demo/space-eyes/FallasFlota.tsx:494` | título / tooltip | Marcar como arreglada | Mark as fixed |
| `spaceeyes.fallas.cierre.boton` | `components/demo/space-eyes/FallasFlota.tsx:506` | texto en pantalla | Marcar arreglada | Mark fixed |
| `spaceeyes.fallas.cierre.texto-descartar` | `components/demo/space-eyes/FallasFlota.tsx:513` | texto en pantalla | El equipo no volverá a avisar de esta zona durante 7 días. | The device will not alert about this area again for 7 days. |
| `spaceeyes.fallas.cierre.texto-arreglada` | `components/demo/space-eyes/FallasFlota.tsx:514` | texto en pantalla | Se cierra sin esperar a que el equipo lo compruebe en su próxima foto. | It closes without waiting for the device to confirm it in its next photo. |
| `spaceeyes.fallas.cierre.nota` | `components/demo/space-eyes/FallasFlota.tsx:518` | texto en pantalla | Qué se hizo {opcional} | What was done {opcional} |
| `spaceeyes.fallas.cierre.ej-descartar` | `components/demo/space-eyes/FallasFlota.tsx:531` | texto de ejemplo (placeholder) | Por ejemplo: es un reflejo del sol | For example: it is a sun reflection |
| `spaceeyes.fallas.cierre.ej-arreglada` | `components/demo/space-eyes/FallasFlota.tsx:531` | texto de ejemplo (placeholder) | Por ejemplo: se cambió la fuente | For example: the power supply was replaced |
| `spaceeyes.comun.dato-invalido` | `components/demo/space-eyes/CampanasEyes.tsx:94`<br>`components/demo/space-eyes/Programacion.tsx:119` | etiqueta de un valor (mapa de claves) | Hay un dato inválido en el formulario | There is an invalid value in the form |
| `spaceeyes.comun.guardar-cambios` | `components/demo/space-eyes/CampanasEyes.tsx:516`<br>`components/demo/space-eyes/Programacion.tsx:611` | texto en pantalla | Guardar cambios | Save changes |
| `spaceeyes.comun.activa` | `components/demo/space-eyes/CampanasEyes.tsx:615`<br>`components/demo/space-eyes/Programacion.tsx:205` | texto de una función (lib o componente) · texto en pantalla | Activa | Active |
| `spaceeyes.comun.equipos` | `components/demo/space-eyes/AltaDispositivo.tsx:530`<br>`components/demo/space-eyes/CampanasEyes.tsx:624` | rótulo · texto en pantalla | Equipos | Devices |
| `spaceeyes.comun.periodo` | `components/demo/space-eyes/CampanasEyes.tsx:626`<br>`components/demo/space-eyes/Graficas.tsx:393`<br>`components/demo/space-eyes/Graficas.tsx:518` | rótulo · texto en pantalla | Periodo | Period |
| `spaceeyes.comun.editar` | `components/demo/space-eyes/CampanasEyes.tsx:646`<br>`components/demo/space-eyes/Programacion.tsx:485`<br>`components/demo/space-eyes/Programacion.tsx:538` | texto en pantalla | Editar | Edit |
| `spaceeyes.campanas.error.sin-archivo` | `components/demo/space-eyes/CampanasEyes.tsx:92` | texto en pantalla | No se recibió la imagen | The image was not received |
| `spaceeyes.campanas.error.not-found` | `components/demo/space-eyes/CampanasEyes.tsx:93` | texto en pantalla | La campaña ya no existe | The campaign no longer exists |
| `spaceeyes.campanas.error.forbidden` | `components/demo/space-eyes/CampanasEyes.tsx:95` | etiqueta de un valor (mapa de claves) | No tienes permiso para esto | You do not have permission for this |
| `spaceeyes.campanas.error.cargar` | `components/demo/space-eyes/CampanasEyes.tsx:146`<br>`components/demo/space-eyes/CampanasEyes.tsx:531` | mensaje de error · texto en pantalla | No se pudieron cargar las campañas | Could not load the campaigns |
| `spaceeyes.campanas.error.asignados` | `components/demo/space-eyes/CampanasEyes.tsx:215` | mensaje de error | No se pudieron leer los equipos asignados. Vuelve a elegirlos antes de guardar. | Could not read the assigned devices. Choose them again before saving. |
| `spaceeyes.campanas.error.pesada` | `components/demo/space-eyes/CampanasEyes.tsx:233` | mensaje de error | La imagen pesa más de 20 MB | The image is larger than 20 MB |
| `spaceeyes.campanas.error.nombre` | `components/demo/space-eyes/CampanasEyes.tsx:250` | mensaje de error | Ponle un nombre a la campaña | Give the campaign a name |
| `spaceeyes.campanas.error.fechas` | `components/demo/space-eyes/CampanasEyes.tsx:251` | mensaje de error | Faltan las fechas de la campaña | The campaign dates are missing |
| `spaceeyes.campanas.error.fin-antes` | `components/demo/space-eyes/CampanasEyes.tsx:252` | mensaje de error | La fecha de fin es anterior a la de inicio | The end date is before the start date |
| `spaceeyes.campanas.error.creatividad` | `components/demo/space-eyes/CampanasEyes.tsx:295` | texto en pantalla | La campaña se guardó, pero la creatividad no se pudo subir: {motivo} | The campaign was saved, but the creative could not be uploaded: {motivo} |
| `spaceeyes.campanas.error.guardar` | `components/demo/space-eyes/CampanasEyes.tsx:308` | mensaje de error | No se pudo guardar la campaña | Could not save the campaign |
| `spaceeyes.campanas.creada` | `components/demo/space-eyes/CampanasEyes.tsx:305` | aviso en pantalla | Campaña creada | Campaign created |
| `spaceeyes.campanas.actualizada` | `components/demo/space-eyes/CampanasEyes.tsx:305` | aviso en pantalla | Campaña actualizada | Campaign updated |
| `spaceeyes.campanas.titulo` | `components/demo/space-eyes/CampanasEyes.tsx:324` | rótulo | Campañas de verificación | Verification campaigns |
| `spaceeyes.campanas.descripcion` | `components/demo/space-eyes/CampanasEyes.tsx:325` | texto en pantalla | La creatividad de referencia es la imagen contra la que las cámaras comparan lo que aparece en la pantalla. | The reference creative is the image the cameras compare against what appears on the screen. |
| `spaceeyes.campanas.nueva` | `components/demo/space-eyes/CampanasEyes.tsx:338`<br>`components/demo/space-eyes/CampanasEyes.tsx:359` | texto en pantalla | Nueva campaña | New campaign |
| `spaceeyes.campanas.editar` | `components/demo/space-eyes/CampanasEyes.tsx:359` | texto en pantalla | Editar campaña | Edit campaign |
| `spaceeyes.campanas.nombre-ej` | `components/demo/space-eyes/CampanasEyes.tsx:371` | texto de ejemplo (placeholder) | Ej. Verano 2026 | E.g. Summer 2026 |
| `spaceeyes.campanas.anunciante` | `components/demo/space-eyes/CampanasEyes.tsx:375` | rótulo | Anunciante | Advertiser |
| `spaceeyes.campanas.anunciante-ej` | `components/demo/space-eyes/CampanasEyes.tsx:380` | texto de ejemplo (placeholder) | Ej. Coca-Cola | E.g. Coca-Cola |
| `spaceeyes.campanas.inicio` | `components/demo/space-eyes/CampanasEyes.tsx:387` | rótulo | Fecha inicio | Start date |
| `spaceeyes.campanas.fin` | `components/demo/space-eyes/CampanasEyes.tsx:396` | rótulo | Fecha fin | End date |
| `spaceeyes.campanas.equipos` | `components/demo/space-eyes/CampanasEyes.tsx:408` | texto en pantalla | Equipos donde va esta campaña | Devices where this campaign runs |
| `spaceeyes.campanas.sin-equipos` | `components/demo/space-eyes/CampanasEyes.tsx:411` | texto en pantalla | No hay equipos | No devices |
| `spaceeyes.campanas.leyendo-asignados` | `components/demo/space-eyes/CampanasEyes.tsx:433` | texto en pantalla | Leyendo equipos asignados… | Reading assigned devices… |
| `spaceeyes.campanas.seleccionados.uno` | `components/demo/space-eyes/CampanasEyes.tsx:434` | texto en pantalla | {n} seleccionados | {n} selected |
| `spaceeyes.campanas.seleccionados.otros` | `components/demo/space-eyes/CampanasEyes.tsx:434` | texto en pantalla | {n} seleccionados | {n} selected |
| `spaceeyes.campanas.verificar` | `components/demo/space-eyes/CampanasEyes.tsx:448` | texto en pantalla | Verificar automáticamente las fotos contra la creatividad | Automatically verify photos against the creative |
| `spaceeyes.campanas.verificar.texto` | `components/demo/space-eyes/CampanasEyes.tsx:450` | texto en pantalla | Requiere subir la creatividad. Sin ella la verificación no puede hacer nada. | Requires uploading the creative. Without it, verification cannot do anything. |
| `spaceeyes.campanas.creatividad` | `components/demo/space-eyes/CampanasEyes.tsx:456`<br>`components/demo/space-eyes/CampanasEyes.tsx:465` | texto alternativo de imagen · texto en pantalla | Creatividad de referencia | Reference creative |
| `spaceeyes.campanas.sube` | `components/demo/space-eyes/CampanasEyes.tsx:469` | texto en pantalla | Sube la imagen del anuncio | Upload the ad image |
| `spaceeyes.campanas.formatos` | `components/demo/space-eyes/CampanasEyes.tsx:470` | texto en pantalla | JPG o PNG, hasta 20 MB | JPG or PNG, up to 20 MB |
| `spaceeyes.campanas.cambiar-imagen` | `components/demo/space-eyes/CampanasEyes.tsx:488` | texto en pantalla | Cambiar imagen | Change image |
| `spaceeyes.campanas.elegir-imagen` | `components/demo/space-eyes/CampanasEyes.tsx:488` | texto en pantalla | Elegir imagen | Choose image |
| `spaceeyes.campanas.creatividad.texto` | `components/demo/space-eyes/CampanasEyes.tsx:493` | texto en pantalla | Es la imagen tal como debe verse en la pantalla. Sirve para comprobar que la campaña está al aire y, más adelante, para que el sistema reconozca ese creativo entre los que rotan en el sitio. | It is the image exactly as it should look on the screen. It is used to check that the campaign is on air and, later, so the system can recognize that creative among those rotating at the site. |
| `spaceeyes.campanas.ya-tiene` | `components/demo/space-eyes/CampanasEyes.tsx:496` | texto en pantalla | Esta campaña ya tiene creatividad guardada. | This campaign already has a saved creative. |
| `spaceeyes.campanas.se-sube` | `components/demo/space-eyes/CampanasEyes.tsx:499` | texto en pantalla | La imagen nueva se sube al guardar. | The new image is uploaded when you save. |
| `spaceeyes.campanas.crear` | `components/demo/space-eyes/CampanasEyes.tsx:517` | texto en pantalla | Crear campaña | Create campaign |
| `spaceeyes.campanas.vacio` | `components/demo/space-eyes/CampanasEyes.tsx:543` | texto en pantalla | No hay campañas creadas | No campaigns created |
| `spaceeyes.campanas.vacio.texto` | `components/demo/space-eyes/CampanasEyes.tsx:544` | texto en pantalla | Crea una para agrupar las fotos de un cliente y comprobar que su anuncio está al aire. | Create one to group a client’s photos and check that their ad is on air. |
| `spaceeyes.campanas.alt` | `components/demo/space-eyes/CampanasEyes.tsx:587` | texto alternativo de imagen | Creatividad de {nombre} | Creative for {nombre} |
| `spaceeyes.campanas.sin-creatividad` | `components/demo/space-eyes/CampanasEyes.tsx:593` | texto en pantalla | Sin creatividad de referencia | No reference creative |
| `spaceeyes.campanas.inactiva` | `components/demo/space-eyes/CampanasEyes.tsx:615` | texto en pantalla | Inactiva | Inactive |
| `spaceeyes.campanas.sin-anunciante` | `components/demo/space-eyes/CampanasEyes.tsx:619` | texto en pantalla | Sin anunciante | No advertiser |
| `spaceeyes.campanas.de-operaciones` | `components/demo/space-eyes/CampanasEyes.tsx:620` | texto en pantalla | ␣· De Operaciones | ␣· From Operations |
| `spaceeyes.campanas.verif.activa` | `components/demo/space-eyes/CampanasEyes.tsx:631` | texto en pantalla | Verificación activa | Verification on |
| `spaceeyes.campanas.verif.sin-creatividad` | `components/demo/space-eyes/CampanasEyes.tsx:633` | texto en pantalla | Verificación sin creatividad | Verification without a creative |
| `spaceeyes.campanas.verif.sin` | `components/demo/space-eyes/CampanasEyes.tsx:635` | texto en pantalla | Sin verificación | No verification |
| `spaceeyes.campanas.operaciones.ayuda` | `components/demo/space-eyes/CampanasEyes.tsx:640` | título / tooltip | Llegó de Operaciones: se cambia allá (creativo, pantallas y fechas de sus reservas) y aquí se actualiza solo. | It came from Operations: change it there (creative, screens and booking dates) and it updates here on its own. |
| `spaceeyes.campanas.operaciones` | `components/demo/space-eyes/CampanasEyes.tsx:642` | texto en pantalla | Se cambia en Operaciones | Changed in Operations |
| `spaceeyes.prog.error.franjas` | `components/demo/space-eyes/Programacion.tsx:115` | texto en pantalla | Revisa las franjas: alguna tiene una hora inválida | Check the dayparts: one has an invalid time |
| `spaceeyes.prog.error.horas` | `components/demo/space-eyes/Programacion.tsx:116`<br>`components/demo/space-eyes/Programacion.tsx:341` | aviso emergente (toast) · texto en pantalla | Agrega al menos una hora | Add at least one time |
| `spaceeyes.prog.error.intervalo` | `components/demo/space-eyes/Programacion.tsx:117` | texto en pantalla | Falta el intervalo en minutos | The interval in minutes is missing |
| `spaceeyes.prog.error.cron` | `components/demo/space-eyes/Programacion.tsx:118` | texto en pantalla | Falta la expresión de programación | The schedule expression is missing |
| `spaceeyes.prog.error.cargar` | `components/demo/space-eyes/Programacion.tsx:285`<br>`components/demo/space-eyes/Programacion.tsx:443` | mensaje de error · texto en pantalla | No se pudieron cargar las programaciones | Could not load the schedules |
| `spaceeyes.prog.destino.campana` | `components/demo/space-eyes/Programacion.tsx:136` | texto de una función (lib o componente) | Campaña: {nombre} | Campaign: {nombre} |
| `spaceeyes.prog.destino.grupo` | `components/demo/space-eyes/Programacion.tsx:137` | texto de una función (lib o componente) | Grupo: {nombre} | Group: {nombre} |
| `spaceeyes.prog.sin-franjas` | `components/demo/space-eyes/Programacion.tsx:144` | texto de una función (lib o componente) | Sin franjas | No dayparts |
| `spaceeyes.prog.al-azar` | `components/demo/space-eyes/Programacion.tsx:145` | texto de una función (lib o componente) | {lista} (al azar) | {lista} (random) |
| `spaceeyes.prog.cada-h` | `components/demo/space-eyes/Programacion.tsx:151` | texto de una función (lib o componente) | Cada {n} h | Every {n} h |
| `spaceeyes.prog.estado.pausada` | `components/demo/space-eyes/Programacion.tsx:191` | texto de una función (lib o componente) | Pausada | Paused |
| `spaceeyes.prog.estado.empieza` | `components/demo/space-eyes/Programacion.tsx:195` | texto de una función (lib o componente) | Empieza el {fecha} | Starts {fecha} |
| `spaceeyes.prog.estado.vencio` | `components/demo/space-eyes/Programacion.tsx:201` | texto de una función (lib o componente) | Venció el {fecha} | Expired on {fecha} |
| `spaceeyes.prog.proxima.espera` | `components/demo/space-eyes/Programacion.tsx:214` | texto de una función (lib o componente) | No dispara hasta el {fecha} | Does not fire until {fecha} |
| `spaceeyes.prog.proxima.vencida` | `components/demo/space-eyes/Programacion.tsx:215` | texto de una función (lib o componente) | No dispara: vencida | Does not fire: expired |
| `spaceeyes.prog.proxima.sin-calcular` | `components/demo/space-eyes/Programacion.tsx:216` | texto de una función (lib o componente) | Sin calcular | Not calculated |
| `spaceeyes.prog.proxima.cola` | `components/demo/space-eyes/Programacion.tsx:226` | texto de una función (lib o componente) | {fecha} (en cola) | {fecha} (queued) |
| `spaceeyes.prog.proxima.min` | `components/demo/space-eyes/Programacion.tsx:228` | texto de una función (lib o componente) | {fecha} (en {n} min) | {fecha} (in {n} min) |
| `spaceeyes.prog.proxima.h` | `components/demo/space-eyes/Programacion.tsx:229` | texto de una función (lib o componente) | {fecha} (en {n} h) | {fecha} (in {n} h) |
| `spaceeyes.prog.sin-fotos` | `components/demo/space-eyes/Programacion.tsx:246` | texto de una función (lib o componente) | sin fotos | no photos |
| `spaceeyes.prog.fotos-dia.uno` | `components/demo/space-eyes/Programacion.tsx:248` | texto de una función (lib o componente) | {n} foto al día | {n} photo a day |
| `spaceeyes.prog.fotos-dia.otros` | `components/demo/space-eyes/Programacion.tsx:248` | texto de una función (lib o componente) | {n} fotos al día | {n} photos a day |
| `spaceeyes.prog.gb-mes` | `components/demo/space-eyes/Programacion.tsx:255` | texto de una función (lib o componente) | {n} GB al mes | {n} GB a month |
| `spaceeyes.prog.mb-mes` | `components/demo/space-eyes/Programacion.tsx:256` | texto de una función (lib o componente) | {n} MB al mes | {n} MB a month |
| `spaceeyes.prog.toast.nombre` | `components/demo/space-eyes/Programacion.tsx:331` | aviso emergente (toast) | Ponle un nombre a la programación | Give the schedule a name |
| `spaceeyes.prog.toast.equipo` | `components/demo/space-eyes/Programacion.tsx:332` | aviso emergente (toast) | Elige el equipo | Choose the device |
| `spaceeyes.prog.toast.campana` | `components/demo/space-eyes/Programacion.tsx:333` | aviso emergente (toast) | Elige la campaña | Choose the campaign |
| `spaceeyes.prog.toast.franja` | `components/demo/space-eyes/Programacion.tsx:335` | aviso emergente (toast) | Agrega al menos una franja de horario | Add at least one daypart |
| `spaceeyes.prog.toast.franja-mal` | `components/demo/space-eyes/Programacion.tsx:337` | aviso emergente (toast) | Hay una franja sin horas o con la misma hora de inicio y fin | A daypart has no times or the same start and end time |
| `spaceeyes.prog.toast.intervalo` | `components/demo/space-eyes/Programacion.tsx:344` | aviso emergente (toast) | El intervalo mínimo es de 5 minutos | The minimum interval is 5 minutes |
| `spaceeyes.prog.toast.actualizada` | `components/demo/space-eyes/Programacion.tsx:364` | aviso emergente (toast) | Programación actualizada | Schedule updated |
| `spaceeyes.prog.toast.creada` | `components/demo/space-eyes/Programacion.tsx:367` | aviso emergente (toast) | Programación creada | Schedule created |
| `spaceeyes.prog.toast.no-guardar` | `components/demo/space-eyes/Programacion.tsx:372` | aviso emergente (toast) | No se pudo guardar la programación | Could not save the schedule |
| `spaceeyes.prog.toast.pausada` | `components/demo/space-eyes/Programacion.tsx:381` | aviso emergente (toast) | Programación pausada | Schedule paused |
| `spaceeyes.prog.toast.activada` | `components/demo/space-eyes/Programacion.tsx:381` | aviso emergente (toast) | Programación activada | Schedule activated |
| `spaceeyes.prog.toast.no-estado` | `components/demo/space-eyes/Programacion.tsx:384` | aviso emergente (toast) | No se pudo cambiar el estado | Could not change the status |
| `spaceeyes.prog.toast.eliminada` | `components/demo/space-eyes/Programacion.tsx:393` | aviso emergente (toast) | Programación eliminada | Schedule deleted |
| `spaceeyes.prog.toast.no-eliminar` | `components/demo/space-eyes/Programacion.tsx:397` | aviso emergente (toast) | No se pudo eliminar | Could not delete |
| `spaceeyes.prog.titulo` | `components/demo/space-eyes/Programacion.tsx:412` | rótulo | Programación de fotos | Photo scheduling |
| `spaceeyes.prog.descripcion` | `components/demo/space-eyes/Programacion.tsx:413` | texto en pantalla | Las fotos se toman solas, a una hora impredecible dentro de las franjas que definas. | Photos are taken automatically, at an unpredictable time within the dayparts you define. |
| `spaceeyes.prog.nueva` | `components/demo/space-eyes/Programacion.tsx:422`<br>`components/demo/space-eyes/Programacion.tsx:601` | texto en pantalla · título / tooltip | Nueva programación | New schedule |
| `spaceeyes.prog.editar` | `components/demo/space-eyes/Programacion.tsx:601` | título / tooltip | Editar programación | Edit schedule |
| `spaceeyes.prog.crear` | `components/demo/space-eyes/Programacion.tsx:612` | texto en pantalla | Crear programación | Create schedule |
| `spaceeyes.prog.vacio` | `components/demo/space-eyes/Programacion.tsx:451` | texto en pantalla | Todavía no hay ninguna programación. | There are no schedules yet. |
| `spaceeyes.prog.vacio.texto` | `components/demo/space-eyes/Programacion.tsx:452` | texto en pantalla | Hoy las fotos solo se toman cuando alguien las pide a mano. | Right now photos are only taken when someone requests them by hand. |
| `spaceeyes.prog.linea.uno` | `components/demo/space-eyes/Programacion.tsx:473` | texto en pantalla | Próxima: {proxima} · {n} fotos {semana} | Next: {proxima} · {n} photo {semana} |
| `spaceeyes.prog.linea.otros` | `components/demo/space-eyes/Programacion.tsx:473` | texto en pantalla | Próxima: {proxima} · {n} fotos {semana} | Next: {proxima} · {n} photos {semana} |
| `spaceeyes.prog.semana` | `components/demo/space-eyes/Programacion.tsx:478`<br>`components/demo/space-eyes/Programacion.tsx:527` | texto en pantalla | ({n} esta semana) | ({n} this week) |
| `spaceeyes.prog.pausar` | `components/demo/space-eyes/Programacion.tsx:488`<br>`components/demo/space-eyes/Programacion.tsx:541` | texto en pantalla | Pausar | Pause |
| `spaceeyes.prog.activar` | `components/demo/space-eyes/Programacion.tsx:488`<br>`components/demo/space-eyes/Programacion.tsx:541` | texto en pantalla | Activar | Activate |
| `spaceeyes.prog.aplica-a` | `components/demo/space-eyes/Programacion.tsx:503` | texto en pantalla | Aplica a | Applies to |
| `spaceeyes.prog.cuando` | `components/demo/space-eyes/Programacion.tsx:504`<br>`components/demo/space-eyes/Programacion.tsx:721` | texto en pantalla | Cuándo | When |
| `spaceeyes.prog.proxima-foto` | `components/demo/space-eyes/Programacion.tsx:505` | texto en pantalla | Próxima foto | Next photo |
| `spaceeyes.prog.acciones` | `components/demo/space-eyes/Programacion.tsx:508` | texto en pantalla | Acciones | Actions |
| `spaceeyes.prog.eliminar` | `components/demo/space-eyes/Programacion.tsx:560` | título / tooltip | Eliminar programación | Delete schedule |
| `spaceeyes.prog.eliminar.palabra` | `components/demo/space-eyes/Programacion.tsx:563` | texto en pantalla | ELIMINAR | DELETE |
| `spaceeyes.prog.eliminar.pregunta` | `components/demo/space-eyes/Programacion.tsx:566` | texto en pantalla | Se eliminará «{nombre}». | “{nombre}” will be deleted. |
| `spaceeyes.prog.eliminar.texto` | `components/demo/space-eyes/Programacion.tsx:567` | texto en pantalla | Las fotos que ya se tomaron se conservan; lo que se pierde es la programación futura. | Photos already taken are kept; what is lost is the future schedule. |
| `spaceeyes.prog.destino.un-equipo` | `components/demo/space-eyes/Programacion.tsx:595` | texto en pantalla | Un equipo | One device |
| `spaceeyes.prog.destino.una-campana` | `components/demo/space-eyes/Programacion.tsx:596` | texto en pantalla | Una campaña | One campaign |
| `spaceeyes.prog.nombre-ej` | `components/demo/space-eyes/Programacion.tsx:628` | texto de ejemplo (placeholder) | Ej. Evidencia diaria de la ruta norte | E.g. Daily evidence for the north route |
| `spaceeyes.prog.aplicar-a` | `components/demo/space-eyes/Programacion.tsx:634` | texto en pantalla | Aplicar a | Apply to |
| `spaceeyes.prog.todos.texto` | `components/demo/space-eyes/Programacion.tsx:652` | texto en pantalla | Aplica a los {n} equipos de la flota, incluyendo los que se den de alta después. | Applies to the {n} devices in the fleet, including any registered later. |
| `spaceeyes.prog.elegir-equipo` | `components/demo/space-eyes/Programacion.tsx:661` | texto en pantalla | — Elegir equipo — | — Choose device — |
| `spaceeyes.prog.campana` | `components/demo/space-eyes/Programacion.tsx:671` | etiqueta accesible (aria-label) | Campaña | Campaign |
| `spaceeyes.prog.elegir-campana` | `components/demo/space-eyes/Programacion.tsx:676` | texto en pantalla | — Elegir campaña — | — Choose campaign — |
| `spaceeyes.prog.campana-equipos.uno` | `components/demo/space-eyes/Programacion.tsx:679` | texto en pantalla | {nombre} · {n} equipos | {nombre} · {n} device |
| `spaceeyes.prog.campana-equipos.otros` | `components/demo/space-eyes/Programacion.tsx:679` | texto en pantalla | {nombre} · {n} equipos | {nombre} · {n} devices |
| `spaceeyes.prog.tipo.franjas` | `components/demo/space-eyes/Programacion.tsx:729` | texto en pantalla | Hora al azar dentro de franjas (recomendado) | Random time within dayparts (recommended) |
| `spaceeyes.prog.tipo.horas` | `components/demo/space-eyes/Programacion.tsx:730` | texto en pantalla | Horas exactas | Exact times |
| `spaceeyes.prog.tipo.intervalo` | `components/demo/space-eyes/Programacion.tsx:731` | texto en pantalla | Cada cierto tiempo | At a fixed interval |
| `spaceeyes.prog.tipo.cron` | `components/demo/space-eyes/Programacion.tsx:732` | texto en pantalla | Expresión cron (no editable aquí) | Cron expression (not editable here) |
| `spaceeyes.prog.franjas.texto` | `components/demo/space-eyes/Programacion.tsx:739` | texto en pantalla | Una foto por franja, en un minuto sorteado cada día. La hora no se repite, así que la evidencia no se puede acomodar de antemano. | One photo per daypart, at a minute drawn at random each day. The time never repeats, so the evidence cannot be staged in advance. |
| `spaceeyes.prog.franja` | `components/demo/space-eyes/Programacion.tsx:743` | texto en pantalla | Franja {n} | Daypart {n} |
| `spaceeyes.prog.franja.inicio` | `components/demo/space-eyes/Programacion.tsx:746` | etiqueta accesible (aria-label) | Inicio de la franja {n} | Start of daypart {n} |
| `spaceeyes.prog.franja.fin` | `components/demo/space-eyes/Programacion.tsx:756` | etiqueta accesible (aria-label) | Fin de la franja {n} | End of daypart {n} |
| `spaceeyes.prog.franja.quitar` | `components/demo/space-eyes/Programacion.tsx:766` | etiqueta accesible (aria-label) | Quitar la franja {n} | Remove daypart {n} |
| `spaceeyes.prog.quitar` | `components/demo/space-eyes/Programacion.tsx:767`<br>`components/demo/space-eyes/Programacion.tsx:827` | título / tooltip | Quitar | Remove |
| `spaceeyes.prog.franja.agregar` | `components/demo/space-eyes/Programacion.tsx:781` | texto en pantalla | Agregar franja | Add daypart |
| `spaceeyes.prog.rapido` | `components/demo/space-eyes/Programacion.tsx:784` | texto en pantalla | Rápido: | Quick: |
| `spaceeyes.prog.rapido.tres` | `components/demo/space-eyes/Programacion.tsx:798` | texto en pantalla | Mañana, tarde y noche | Morning, afternoon and evening |
| `spaceeyes.prog.rapido.una` | `components/demo/space-eyes/Programacion.tsx:801` | texto en pantalla | Una al día | Once a day |
| `spaceeyes.prog.horas.texto` | `components/demo/space-eyes/Programacion.tsx:810` | texto en pantalla | Siempre al mismo minuto. Sirve para un reporte fijo, pero como evidencia es débil: una hora predecible se puede preparar. | Always at the same minute. Useful for a fixed report, but weak as evidence: a predictable time can be prepared for. |
| `spaceeyes.prog.hora` | `components/demo/space-eyes/Programacion.tsx:816` | etiqueta accesible (aria-label) | Hora {n} | Time {n} |
| `spaceeyes.prog.hora.quitar` | `components/demo/space-eyes/Programacion.tsx:826` | etiqueta accesible (aria-label) | Quitar la hora {n} | Remove time {n} |
| `spaceeyes.prog.hora.agregar` | `components/demo/space-eyes/Programacion.tsx:837` | texto en pantalla | Agregar hora | Add time |
| `spaceeyes.prog.intervalo` | `components/demo/space-eyes/Programacion.tsx:846` | texto en pantalla | Cada cuántos minutos | Interval in minutes |
| `spaceeyes.prog.intervalo.ojo` | `components/demo/space-eyes/Programacion.tsx:858` | texto en pantalla | Ojo con los datos móviles: a este ritmo son {fotos}. | Watch the mobile data: at this rate that is {fotos}. |
| `spaceeyes.prog.consumo` | `components/demo/space-eyes/Programacion.tsx:865` | texto en pantalla | Consumo estimado por equipo | Estimated usage per device |
| `spaceeyes.prog.consumo.texto` | `components/demo/space-eyes/Programacion.tsx:871` | texto en pantalla | A 1.5 MB por foto, que es lo que pesan hoy. Cada equipo gasta ~20 MB al mes sin fotos programadas. | At 1.5 MB per photo, which is what they weigh today. Each device uses ~20 MB a month without scheduled photos. |
| `spaceeyes.verif.titulo` | `components/demo/space-eyes/Verificacion.tsx:83` | rótulo | Verificación | Verification |
| `spaceeyes.verif.descripcion` | `components/demo/space-eyes/Verificacion.tsx:84` | texto en pantalla | Comparación de cada foto contra la creatividad de su campaña. | Each photo compared against its campaign creative. |
| `spaceeyes.verif.filtro.todos` | `components/demo/space-eyes/Verificacion.tsx:96` | texto en pantalla | Todos los resultados | All results |
| `spaceeyes.verif.filtro.correctos` | `components/demo/space-eyes/Verificacion.tsx:97` | texto en pantalla | Correctos | Correct |
| `spaceeyes.verif.filtro.incorrectos` | `components/demo/space-eyes/Verificacion.tsx:98` | texto en pantalla | Incorrectos | Incorrect |
| `spaceeyes.verif.error` | `components/demo/space-eyes/Verificacion.tsx:123` | texto en pantalla | No se pudieron cargar las verificaciones | Could not load the verifications |
| `spaceeyes.verif.vacio` | `components/demo/space-eyes/Verificacion.tsx:131` | texto en pantalla | Sin resultados de verificación | No verification results |
| `spaceeyes.verif.ver-completa` | `components/demo/space-eyes/Verificacion.tsx:152`<br>`components/demo/space-eyes/Verificacion.tsx:225` | título / tooltip | Ver la foto completa | View the full photo |
| `spaceeyes.verif.correcto` | `components/demo/space-eyes/Verificacion.tsx:177`<br>`components/demo/space-eyes/Verificacion.tsx:257` | texto en pantalla | Correcto | Correct |
| `spaceeyes.verif.incorrecto` | `components/demo/space-eyes/Verificacion.tsx:177`<br>`components/demo/space-eyes/Verificacion.tsx:257` | texto en pantalla | Incorrecto | Incorrect |
| `spaceeyes.verif.confianza` | `components/demo/space-eyes/Verificacion.tsx:181` | texto en pantalla | Confianza {pct} | Confidence {pct} |
| `spaceeyes.verif.si` | `components/demo/space-eyes/Verificacion.tsx:185`<br>`components/demo/space-eyes/Verificacion.tsx:245` | texto en pantalla | Sí | Yes |
| `spaceeyes.verif.no` | `components/demo/space-eyes/Verificacion.tsx:185`<br>`components/demo/space-eyes/Verificacion.tsx:245` | texto en pantalla | No | No |
| `spaceeyes.verif.ocr` | `components/demo/space-eyes/Verificacion.tsx:202` | texto en pantalla | Coincidencia OCR | OCR match |
| `spaceeyes.verif.resultado` | `components/demo/space-eyes/Verificacion.tsx:203` | texto en pantalla | Resultado | Result |
| `spaceeyes.verif.fecha` | `components/demo/space-eyes/Verificacion.tsx:205` | texto en pantalla | Fecha | Date |
| `spaceeyes.verif.pagina-anterior` | `components/demo/space-eyes/Verificacion.tsx:277` | etiqueta accesible (aria-label) | Página anterior | Previous page |
| `spaceeyes.verif.pagina-siguiente` | `components/demo/space-eyes/Verificacion.tsx:287` | etiqueta accesible (aria-label) | Página siguiente | Next page |
| `spaceeyes.graficas.periodo.24h` | `components/demo/space-eyes/Graficas.tsx:103` | rótulo | Hoy (24 h) | Today (24 h) |
| `spaceeyes.graficas.semana` | `components/demo/space-eyes/Graficas.tsx:104`<br>`components/demo/space-eyes/Graficas.tsx:111` | rótulo · texto en pantalla | Semana | Week |
| `spaceeyes.graficas.mes` | `components/demo/space-eyes/Graficas.tsx:105`<br>`components/demo/space-eyes/Graficas.tsx:112` | rótulo · texto en pantalla | Mes | Month |
| `spaceeyes.graficas.periodo.custom` | `components/demo/space-eyes/Graficas.tsx:106` | rótulo | Personalizado | Custom |
| `spaceeyes.graficas.hoy` | `components/demo/space-eyes/Graficas.tsx:110` | texto en pantalla | Hoy | Today |
| `spaceeyes.graficas.total` | `components/demo/space-eyes/Graficas.tsx:113` | texto en pantalla | Total | Total |
| `spaceeyes.graficas.error.telemetria` | `components/demo/space-eyes/Graficas.tsx:223`<br>`components/demo/space-eyes/Graficas.tsx:445` | mensaje de error · rótulo | No se pudo leer la telemetría | Could not read the telemetry |
| `spaceeyes.graficas.error.csv` | `components/demo/space-eyes/Graficas.tsx:282` | mensaje de error | No se pudo exportar el CSV. {motivo} | Could not export the CSV. {motivo} |
| `spaceeyes.graficas.titulo` | `components/demo/space-eyes/Graficas.tsx:330` | rótulo | Gráficas | Charts |
| `spaceeyes.graficas.descripcion` | `components/demo/space-eyes/Graficas.tsx:331` | texto en pantalla | Estadísticas y telemetría de cada equipo: cómo ha estado y cuánto consume. | Statistics and telemetry for each device: how it has been doing and how much it uses. |
| `spaceeyes.graficas.exportar` | `components/demo/space-eyes/Graficas.tsx:353` | texto en pantalla | Exportar CSV | Export CSV |
| `spaceeyes.graficas.dispositivo` | `components/demo/space-eyes/Graficas.tsx:378` | rótulo | Dispositivo | Device |
| `spaceeyes.graficas.sin-conexion` | `components/demo/space-eyes/Graficas.tsx:388` | texto en pantalla | ␣· sin conexión | ␣· offline |
| `spaceeyes.graficas.aplicar` | `components/demo/space-eyes/Graficas.tsx:434` | texto en pantalla | Aplicar | Apply |
| `spaceeyes.graficas.exportacion-fallida` | `components/demo/space-eyes/Graficas.tsx:442` | rótulo | Exportación fallida | Export failed |
| `spaceeyes.graficas.cpu-max` | `components/demo/space-eyes/Graficas.tsx:461` | rótulo | Temp CPU máx | Max CPU temp |
| `spaceeyes.graficas.nd` | `components/demo/space-eyes/Graficas.tsx:462`<br>`components/demo/space-eyes/Graficas.tsx:467`<br>`components/demo/space-eyes/Graficas.tsx:529`<br>`components/demo/space-eyes/Graficas.tsx:532` | texto en pantalla | n/d | n/a |
| `spaceeyes.graficas.bateria-min` | `components/demo/space-eyes/Graficas.tsx:466` | rótulo | Batería mín | Min battery |
| `spaceeyes.graficas.pct` | `components/demo/space-eyes/Graficas.tsx:467` | texto en pantalla | {n} % | {n}% |
| `spaceeyes.graficas.muestras` | `components/demo/space-eyes/Graficas.tsx:470` | rótulo | Muestras | Samples |
| `spaceeyes.graficas.consumo` | `components/demo/space-eyes/Graficas.tsx:497` | texto en pantalla | Consumo de datos (chip / WiFi) | Data usage (SIM / WiFi) |
| `spaceeyes.graficas.consumo.sin` | `components/demo/space-eyes/Graficas.tsx:499` | texto en pantalla | Sin datos de consumo (requiere la app v0.7.0 en el equipo). | No usage data (requires app v0.7.0 on the device). |
| `spaceeyes.graficas.movil-mb` | `components/demo/space-eyes/Graficas.tsx:509` | texto en pantalla | Móvil (MB) | Mobile (MB) |
| `spaceeyes.graficas.consumo.caption` | `components/demo/space-eyes/Graficas.tsx:514` | texto en pantalla | Consumo de datos por periodo | Data usage per period |
| `spaceeyes.graficas.temperatura` | `components/demo/space-eyes/Graficas.tsx:545` | rótulo | Temperatura (CPU / batería) | Temperature (CPU / battery) |
| `spaceeyes.graficas.serie.cpu` | `components/demo/space-eyes/Graficas.tsx:551` | etiqueta de un valor (mapa de claves) | Temp CPU °C | CPU temp °C |
| `spaceeyes.graficas.serie.bat-temp` | `components/demo/space-eyes/Graficas.tsx:552` | etiqueta de un valor (mapa de claves) | Temp batería °C | Battery temp °C |
| `spaceeyes.graficas.bateria` | `components/demo/space-eyes/Graficas.tsx:557` | rótulo | Nivel de batería | Battery level |
| `spaceeyes.graficas.serie.bateria` | `components/demo/space-eyes/Graficas.tsx:563` | texto en pantalla | Batería % | Battery (%) |
| `spaceeyes.graficas.senal` | `components/demo/space-eyes/Graficas.tsx:567` | rótulo | Intensidad de señal | Signal strength |
| `spaceeyes.graficas.serie.senal` | `components/demo/space-eyes/Graficas.tsx:572` | texto en pantalla | Señal dBm | Signal dBm |
| `spaceeyes.graficas.almacenamiento` | `components/demo/space-eyes/Graficas.tsx:576` | rótulo | Almacenamiento y memoria libres | Free storage and memory |
| `spaceeyes.graficas.sin-telemetria` | `components/demo/space-eyes/Graficas.tsx:591` | texto en pantalla | Sin telemetría en el periodo seleccionado para este dispositivo. | No telemetry in the selected period for this device. |
| `spaceeyes.texto.confirmar-descartar` | `components/demo/space-eyes/AjustarTexto.tsx:169` | confirmación del navegador | Hay cambios sin guardar en la marca de este equipo. ¿Descartarlos? | There are unsaved changes to this device’s label. Discard them? |
| `spaceeyes.texto.capturada` | `components/demo/space-eyes/AjustarTexto.tsx:194` | aviso en pantalla | Fotografía capturada | Photo captured |
| `spaceeyes.texto.no-llego` | `components/demo/space-eyes/AjustarTexto.tsx:198` | aviso en pantalla | No llegó la foto. ¿El equipo está en línea? | The photo did not arrive. Is the device online? |
| `spaceeyes.texto.sin-permiso-foto` | `components/demo/space-eyes/AjustarTexto.tsx:204` | aviso en pantalla | No tienes permiso para tomar fotos | You do not have permission to take photos |
| `spaceeyes.texto.no-orden` | `components/demo/space-eyes/AjustarTexto.tsx:204` | aviso en pantalla | No se pudo enviar la orden al equipo | Could not send the command to the device |
| `spaceeyes.texto.guardada` | `components/demo/space-eyes/AjustarTexto.tsx:214` | aviso en pantalla | Configuración guardada y aplicada al equipo | Settings saved and applied to the device |
| `spaceeyes.texto.sin-permiso-marca` | `components/demo/space-eyes/AjustarTexto.tsx:216` | aviso en pantalla | No tienes permiso para cambiar la marca | You do not have permission to change the label |
| `spaceeyes.texto.no-guardar` | `components/demo/space-eyes/AjustarTexto.tsx:216` | aviso en pantalla | No se pudo guardar la configuración | Could not save the settings |
| `spaceeyes.texto.titulo` | `components/demo/space-eyes/AjustarTexto.tsx:240` | rótulo | Ajustar texto de las fotos | Photo label |
| `spaceeyes.texto.descripcion` | `components/demo/space-eyes/AjustarTexto.tsx:242` | texto en pantalla | Toma una fotografía de prueba y acomoda cómo se verá {marca}. Se aplica a todas las fotos del equipo. | Take a test photo and arrange how {marca} will look. It applies to every photo from the device. |
| `spaceeyes.texto.marca` | `components/demo/space-eyes/AjustarTexto.tsx:243` | texto en pantalla | nombre · fecha · hora | name · date · time |
| `spaceeyes.texto.sin-comunicacion` | `components/demo/space-eyes/AjustarTexto.tsx:277` | texto en pantalla | ␣(sin comunicación) | ␣(not reporting) |
| `spaceeyes.texto.capturando` | `components/demo/space-eyes/AjustarTexto.tsx:289` | texto en pantalla | Capturando… | Capturing… |
| `spaceeyes.texto.tomar` | `components/demo/space-eyes/AjustarTexto.tsx:289` | texto en pantalla | Tomar fotografía | Take photo |
| `spaceeyes.texto.solo-boton` | `components/demo/space-eyes/AjustarTexto.tsx:292` | texto en pantalla | La cámara solo captura al pulsar el botón. | The camera only captures when you click the button. |
| `spaceeyes.texto.esperando` | `components/demo/space-eyes/AjustarTexto.tsx:293` | texto en pantalla | Esperando la foto del equipo (hasta 30 s)… | Waiting for the device photo (up to 30 s)… |
| `spaceeyes.texto.sin-permiso` | `components/demo/space-eyes/AjustarTexto.tsx:294` | texto en pantalla | Solo quien puede editar inventario puede tomar la foto y guardar la marca. | Only someone who can edit inventory can take the photo and save the label. |
| `spaceeyes.texto.arrastra` | `components/demo/space-eyes/AjustarTexto.tsx:311` | texto en pantalla | Arrastra sobre la foto para mover la marca (o usa las flechas del teclado). Los cambios se ven al momento. | Drag over the photo to move the label (or use the arrow keys). Changes show up instantly. |
| `spaceeyes.texto.fecha-foto` | `components/demo/space-eyes/AjustarTexto.tsx:315` | texto en pantalla | La fecha y la hora de la vista previa son las de esta foto. | The date and time in the preview are this photo’s. |
| `spaceeyes.texto.sin-guardar` | `components/demo/space-eyes/AjustarTexto.tsx:328` | texto en pantalla | sin guardar | unsaved |
| `spaceeyes.texto.guardar` | `components/demo/space-eyes/AjustarTexto.tsx:336` | texto en pantalla | Guardar configuración | Save settings |
| `spaceeyes.texto.posicion` | `components/demo/space-eyes/AjustarTexto.tsx:431` | etiqueta accesible (aria-label) | Posición de la marca: arrastra o usa las flechas | Label position: drag or use the arrow keys |
| `spaceeyes.texto.alt` | `components/demo/space-eyes/AjustarTexto.tsx:470` | texto alternativo de imagen | Foto de referencia del equipo | Device reference photo |
| `spaceeyes.texto.previsualizar` | `components/demo/space-eyes/AjustarTexto.tsx:495` | texto en pantalla | Toma una fotografía para previsualizar | Take a photo to preview |
| `spaceeyes.texto.desactivada` | `components/demo/space-eyes/AjustarTexto.tsx:520` | texto en pantalla | Marca desactivada | Label turned off |
| `spaceeyes.texto.mostrar` | `components/demo/space-eyes/AjustarTexto.tsx:547` | rótulo | Mostrar marca | Show label |
| `spaceeyes.texto.tamano` | `components/demo/space-eyes/AjustarTexto.tsx:550` | rótulo | Tamaño | Size |
| `spaceeyes.texto.peso` | `components/demo/space-eyes/AjustarTexto.tsx:557` | rótulo | Peso de la fuente | Font weight |
| `spaceeyes.texto.normal` | `components/demo/space-eyes/AjustarTexto.tsx:561` | texto en pantalla | Normal | Normal |
| `spaceeyes.texto.negrita` | `components/demo/space-eyes/AjustarTexto.tsx:562` | texto en pantalla | Negrita | Bold |
| `spaceeyes.texto.color` | `components/demo/space-eyes/AjustarTexto.tsx:568`<br>`components/demo/space-eyes/AjustarTexto.tsx:574` | etiqueta accesible (aria-label) · rótulo | Color del texto | Text color |
| `spaceeyes.texto.alineacion` | `components/demo/space-eyes/AjustarTexto.tsx:581` | rótulo | Alineación | Alignment |
| `spaceeyes.texto.izquierda` | `components/demo/space-eyes/AjustarTexto.tsx:585` | texto en pantalla | Izquierda | Left |
| `spaceeyes.texto.centro` | `components/demo/space-eyes/AjustarTexto.tsx:586` | texto en pantalla | Centro | Center |
| `spaceeyes.texto.derecha` | `components/demo/space-eyes/AjustarTexto.tsx:587` | texto en pantalla | Derecha | Right |
| `spaceeyes.texto.interlineado` | `components/demo/space-eyes/AjustarTexto.tsx:594` | rótulo | Espaciado entre líneas | Line spacing |
| `spaceeyes.texto.interletra` | `components/demo/space-eyes/AjustarTexto.tsx:601` | rótulo | Espaciado entre letras | Letter spacing |
| `spaceeyes.texto.sombra` | `components/demo/space-eyes/AjustarTexto.tsx:608` | rótulo | Sombra | Shadow |
| `spaceeyes.texto.fondo` | `components/demo/space-eyes/AjustarTexto.tsx:609` | rótulo | Fondo semitransparente | Semi-transparent background |
| `spaceeyes.alta.tipo.telefono` | `components/demo/space-eyes/AltaDispositivo.tsx:75` | rótulo | Teléfono Android | Android phone |
| `spaceeyes.alta.tipo.telefono.detalle` | `components/demo/space-eyes/AltaDispositivo.tsx:75` | rótulo | Se vincula escaneando un QR | Pairs by scanning a QR |
| `spaceeyes.alta.tipo.raspberry` | `components/demo/space-eyes/AltaDispositivo.tsx:76` | rótulo | Raspberry Pi | Raspberry Pi |
| `spaceeyes.alta.tipo.raspberry.detalle` | `components/demo/space-eyes/AltaDispositivo.tsx:76` | rótulo | Se instala sola desde la microSD | Installs itself from the microSD |
| `spaceeyes.alta.tipo.pc` | `components/demo/space-eyes/AltaDispositivo.tsx:77` | rótulo | PC con cámara IP | PC with IP camera |
| `spaceeyes.alta.tipo.pc.detalle` | `components/demo/space-eyes/AltaDispositivo.tsx:77` | rótulo | Con un código en el instalador | With a code in the installer |
| `spaceeyes.alta.nombre.telefono` | `components/demo/space-eyes/AltaDispositivo.tsx:81` | etiqueta de un valor (mapa de claves) | Teléfono | Phone |
| `spaceeyes.alta.nombre.raspberry` | `components/demo/space-eyes/AltaDispositivo.tsx:82` | etiqueta de un valor (mapa de claves) | Raspberry | Raspberry |
| `spaceeyes.alta.nombre.pc` | `components/demo/space-eyes/AltaDispositivo.tsx:83` | etiqueta de un valor (mapa de claves) | PC | PC |
| `spaceeyes.alta.error.permiso` | `components/demo/space-eyes/AltaDispositivo.tsx:100` | texto de una función (lib o componente) | No tienes permiso para agregar equipos. | You do not have permission to add devices. |
| `spaceeyes.alta.error.no-se-pudo` | `components/demo/space-eyes/AltaDispositivo.tsx:101` | texto de una función (lib o componente) | No se pudo: {motivo} | Could not do it: {motivo} |
| `spaceeyes.alta.error.completar` | `components/demo/space-eyes/AltaDispositivo.tsx:103` | texto de una función (lib o componente) | No se pudo completar | Could not complete it |
| `spaceeyes.alta.error.red` | `components/demo/space-eyes/AltaDispositivo.tsx:233` | mensaje de error | Escribe el nombre de la red WiFi del sitio, o elige "Cable o módem". | Type the name of the site WiFi network, or choose “Cable or modem”. |
| `spaceeyes.alta.copiado` | `components/demo/space-eyes/AltaDispositivo.tsx:120` | rótulo | Copiado | Copied |
| `spaceeyes.alta.copiar` | `components/demo/space-eyes/AltaDispositivo.tsx:120` | rótulo | Copiar | Copy |
| `spaceeyes.alta.copiar-comando` | `components/demo/space-eyes/AltaDispositivo.tsx:552` | rótulo | Copiar comando | Copy command |
| `spaceeyes.alta.sirve.varios` | `components/demo/space-eyes/AltaDispositivo.tsx:152` | texto en pantalla | Sirve para {n} equipos | Works for {n} devices |
| `spaceeyes.alta.sirve.una` | `components/demo/space-eyes/AltaDispositivo.tsx:152` | texto en pantalla | Sirve una sola vez | Works only once |
| `spaceeyes.alta.vence` | `components/demo/space-eyes/AltaDispositivo.tsx:153` | texto en pantalla | ␣· vence {fecha} | ␣· expires {fecha} |
| `spaceeyes.alta.generar` | `components/demo/space-eyes/AltaDispositivo.tsx:280` | texto en pantalla | Generar código | Generate code |
| `spaceeyes.alta.descripcion` | `components/demo/space-eyes/AltaDispositivo.tsx:297` | texto en pantalla | Cada equipo nuevo entra con un código de un solo uso que se genera aquí. Elige qué equipo vas a instalar. | Each new device joins with a single-use code generated here. Choose which device you are going to install. |
| `spaceeyes.alta.sin-permiso` | `components/demo/space-eyes/AltaDispositivo.tsx:324` | texto en pantalla | Para agregar equipos necesitas permiso de edición en Inventario. Pídeselo a un administrador de tu empresa. | To add devices you need edit permission in Inventory. Ask an admin at your company for it. |
| `spaceeyes.alta.cuantos` | `components/demo/space-eyes/AltaDispositivo.tsx:330` | texto en pantalla | ¿Cuántos equipos vas a instalar? | How many devices are you going to install? |
| `spaceeyes.alta.dura` | `components/demo/space-eyes/AltaDispositivo.tsx:342` | texto en pantalla | El código dura | The code lasts |
| `spaceeyes.alta.dias.uno` | `components/demo/space-eyes/AltaDispositivo.tsx:350` | texto en pantalla | {n} día | {n} day |
| `spaceeyes.alta.dias.otros` | `components/demo/space-eyes/AltaDispositivo.tsx:350` | texto en pantalla | {n} días | {n} days |
| `spaceeyes.alta.lote.qr` | `components/demo/space-eyes/AltaDispositivo.tsx:360` | texto en pantalla | Un solo QR para los {n}: cada equipo entra por separado. Al equipo {siguiente} ya no lo deja entrar, y puedes cancelarlo en cualquier momento. | One QR for all {n}: each device joins separately. Device number {siguiente} is not let in, and you can cancel it at any time. |
| `spaceeyes.alta.lote.archivo` | `components/demo/space-eyes/AltaDispositivo.tsx:362` | texto en pantalla | Un solo archivo para los {n}: cada equipo entra por separado. Al equipo {siguiente} ya no lo deja entrar, y puedes cancelarlo en cualquier momento. | One file for all {n}: each device joins separately. Device number {siguiente} is not let in, and you can cancel it at any time. |
| `spaceeyes.alta.lote.codigo` | `components/demo/space-eyes/AltaDispositivo.tsx:363` | texto en pantalla | Un solo código para los {n}: cada equipo entra por separado. Al equipo {siguiente} ya no lo deja entrar, y puedes cancelarlo en cualquier momento. | One code for all {n}: each device joins separately. Device number {siguiente} is not let in, and you can cancel it at any time. |
| `spaceeyes.alta.uno-solo` | `components/demo/space-eyes/AltaDispositivo.tsx:366` | texto en pantalla | Uno solo: el código sirve una vez. | Just one: the code works once. |
| `spaceeyes.alta.tel.1` | `components/demo/space-eyes/AltaDispositivo.tsx:377` | texto en pantalla | Instala la app {app} en el teléfono{enlace}. | Install the {app} app on the phone{enlace}. |
| `spaceeyes.alta.tel.descargar` | `components/demo/space-eyes/AltaDispositivo.tsx:384` | texto en pantalla | descargar la app {version} | download app {version} |
| `spaceeyes.alta.tel.2` | `components/demo/space-eyes/AltaDispositivo.tsx:391` | texto en pantalla | Genera el código y ábrelo junto al teléfono. | Generate the code and keep it open next to the phone. |
| `spaceeyes.alta.tel.3` | `components/demo/space-eyes/AltaDispositivo.tsx:393` | texto en pantalla | En la app, toca {vincular} y escanea el QR. Si la cámara no lo lee, escribe el código. | In the app, choose {vincular} and scan the QR. If the camera cannot read it, type the code. |
| `spaceeyes.alta.tel.vincular` | `components/demo/space-eyes/AltaDispositivo.tsx:393` | texto en pantalla | Vincular | Pair |
| `spaceeyes.alta.tel.4` | `components/demo/space-eyes/AltaDispositivo.tsx:395` | texto en pantalla | El teléfono aparece en Equipos en unos segundos. Ahí le pones el nombre del sitio. | The phone shows up in Devices within seconds. Give it the site name there. |
| `spaceeyes.alta.tel.escanea` | `components/demo/space-eyes/AltaDispositivo.tsx:402` | texto en pantalla | Escanéalo desde la app Space Eye | Scan it from the Space Eye app |
| `spaceeyes.alta.tel.qr` | `components/demo/space-eyes/AltaDispositivo.tsx:405` | texto en pantalla | Aquí aparecerá el QR | The QR will show up here |
| `spaceeyes.alta.pi.sola` | `components/demo/space-eyes/AltaDispositivo.tsx:417` | texto en pantalla | Se instala sola (recomendado) | Installs itself (recommended) |
| `spaceeyes.alta.pi.encendida` | `components/demo/space-eyes/AltaDispositivo.tsx:418` | texto en pantalla | Ya está encendida | Already running |
| `spaceeyes.alta.pi.nombre` | `components/demo/space-eyes/AltaDispositivo.tsx:436` | texto en pantalla | Nombre del sitio (opcional) | Site name (optional) |
| `spaceeyes.alta.pi.nombre.vacio` | `components/demo/space-eyes/AltaDispositivo.tsx:440` | texto de ejemplo (placeholder) | Déjalo vacío para varias | Leave it empty for several |
| `spaceeyes.alta.pi.nombre.ej` | `components/demo/space-eyes/AltaDispositivo.tsx:440` | texto de ejemplo (placeholder) | Av. Juárez 120 · Cara A | 120 Juárez Ave. · Side A |
| `spaceeyes.alta.pi.mismo-archivo` | `components/demo/space-eyes/AltaDispositivo.tsx:445` | texto en pantalla | El mismo archivo va en las {n} microSD. A cada Raspberry le pones el nombre de su sitio en Equipos cuando aparezca. | The same file goes on all {n} microSD cards. Give each Raspberry its site name in Devices when it shows up. |
| `spaceeyes.alta.pi.conexion` | `components/demo/space-eyes/AltaDispositivo.tsx:449` | texto en pantalla | ¿Cómo se conecta a internet en el sitio? | How does it connect to the internet at the site? |
| `spaceeyes.alta.pi.cable` | `components/demo/space-eyes/AltaDispositivo.tsx:454` | texto en pantalla | Cable o módem | Cable or modem |
| `spaceeyes.alta.pi.red` | `components/demo/space-eyes/AltaDispositivo.tsx:474` | texto en pantalla | Nombre de la red | Network name |
| `spaceeyes.alta.pi.clave` | `components/demo/space-eyes/AltaDispositivo.tsx:483` | texto en pantalla | Contraseña | Password |
| `spaceeyes.alta.pi.clave.texto` | `components/demo/space-eyes/AltaDispositivo.tsx:494` | texto en pantalla | La contraseña solo se guarda dentro del archivo que descargas; no se envía a ningún servidor. | The password is only stored inside the file you download; it is not sent to any server. |
| `spaceeyes.alta.pi.descargar` | `components/demo/space-eyes/AltaDispositivo.tsx:501` | texto en pantalla | Descargar archivo para la microSD | Download file for the microSD |
| `spaceeyes.alta.pi.listo` | `components/demo/space-eyes/AltaDispositivo.tsx:506` | texto en pantalla | Listo: se descargó el archivo con el código {codigo}. | Done: the file with code {codigo} was downloaded. |
| `spaceeyes.alta.pi.listo.varias` | `components/demo/space-eyes/AltaDispositivo.tsx:508` | texto en pantalla | Cópialo en las {n} microSD; sirve hasta para {n} Raspberry. | Copy it to all {n} microSD cards; it works for up to {n} Raspberry devices. |
| `spaceeyes.alta.pi.listo.una` | `components/demo/space-eyes/AltaDispositivo.tsx:509` | texto en pantalla | Sirve para una sola Raspberry. | It works for a single Raspberry. |
| `spaceeyes.alta.pi.listo.vence` | `components/demo/space-eyes/AltaDispositivo.tsx:510` | texto en pantalla | Vence {fecha}. | Expires {fecha}. |
| `spaceeyes.alta.pi.1` | `components/demo/space-eyes/AltaDispositivo.tsx:516` | texto en pantalla | En tu computadora, graba la microSD con {imager}: Raspberry Pi OS Lite (64-bit). Cuando pregunte si quieres personalizar, elige {no}. | On your computer, flash the microSD with {imager}: Raspberry Pi OS Lite (64-bit). When it asks whether to customize, choose {no}. |
| `spaceeyes.alta.pi.1.no` | `components/demo/space-eyes/AltaDispositivo.tsx:518` | texto en pantalla | No | No |
| `spaceeyes.alta.pi.2` | `components/demo/space-eyes/AltaDispositivo.tsx:522` | texto en pantalla | Sin sacar la microSD, ábrela en el explorador (se llama {bootfs}) y copia ahí {userdata} y {network} del archivo descargado. Reemplaza los que trae. | Without removing the microSD, open it in the file explorer (it is called {bootfs}) and copy {userdata} and {network} from the downloaded file there. Replace the ones it has. |
| `spaceeyes.alta.pi.3` | `components/demo/space-eyes/AltaDispositivo.tsx:528` | texto en pantalla | Pon la microSD en la Raspberry, conecta la cámara, el cable o módem si se usa, y la fuente de 5V/3A. | Put the microSD in the Raspberry, connect the camera, the cable or modem if used, and the 5V/3A power supply. |
| `spaceeyes.alta.pi.4` | `components/demo/space-eyes/AltaDispositivo.tsx:530` | texto en pantalla | En 5 a 15 minutos aparece sola en {equipos}. Nadie tiene que conectarse a ella. | In 5 to 15 minutes it shows up on its own in {equipos}. Nobody has to connect to it. |
| `spaceeyes.alta.enc.1` | `components/demo/space-eyes/AltaDispositivo.tsx:537` | texto en pantalla | Genera el código. | Generate the code. |
| `spaceeyes.alta.enc.2` | `components/demo/space-eyes/AltaDispositivo.tsx:538` | texto en pantalla | En la Raspberry (con internet), abre una terminal y pega el comando. | On the Raspberry (with internet), open a terminal and paste the command. |
| `spaceeyes.alta.enc.3` | `components/demo/space-eyes/AltaDispositivo.tsx:539` | texto en pantalla | Aparece en Equipos en uno o dos minutos. | It shows up in Devices in a minute or two. |
| `spaceeyes.alta.sin-direccion.pi` | `components/demo/space-eyes/AltaDispositivo.tsx:556` | texto en pantalla | Falta configurar la dirección pública de Space Eye de esta empresa (quedó apuntando al propio servidor): sin ella el comando instalaría la Raspberry contra una dirección que desde el sitio no existe. | This company’s public Space Eye address is not configured (it points to the server itself): without it the command would install the Raspberry against an address that does not exist from the site. |
| `spaceeyes.alta.pc.1` | `components/demo/space-eyes/AltaDispositivo.tsx:570` | texto en pantalla | Descarga el instalador en la PC del sitio{enlace} y ábrelo. | Download the installer on the site PC{enlace} and open it. |
| `spaceeyes.alta.pc.2` | `components/demo/space-eyes/AltaDispositivo.tsx:583` | texto en pantalla | Genera el código y escríbelo cuando el asistente te lo pida, junto con la cámara IP. | Generate the code and type it when the wizard asks for it, along with the IP camera. |
| `spaceeyes.alta.pc.3` | `components/demo/space-eyes/AltaDispositivo.tsx:584` | texto en pantalla | La PC aparece en Equipos al terminar el asistente. | The PC shows up in Devices when the wizard finishes. |
| `spaceeyes.alta.pc.servidor` | `components/demo/space-eyes/AltaDispositivo.tsx:589` | texto en pantalla | Dirección del servidor de tu empresa (el asistente la pide): {servidor} | Your company server address (the wizard asks for it): {servidor} |
| `spaceeyes.alta.sin-direccion.pc` | `components/demo/space-eyes/AltaDispositivo.tsx:595` | texto en pantalla | Falta configurar la dirección pública de Space Eye de esta empresa (quedó apuntando al propio servidor): pídesela a quien lo administra antes de correr el asistente. | This company’s public Space Eye address is not configured (it points to the server itself): ask whoever manages it before running the wizard. |
| `spaceeyes.alta.codigos` | `components/demo/space-eyes/AltaDispositivo.tsx:604` | texto en pantalla | Códigos de vinculación | Pairing codes |
| `spaceeyes.alta.codigos.texto` | `components/demo/space-eyes/AltaDispositivo.tsx:605` | texto en pantalla | Los de los últimos 30 días. Uno vigente que ya no vayas a usar, cancélalo. | From the last 30 days. Cancel any active one you are not going to use. |
| `spaceeyes.alta.codigos.vacio` | `components/demo/space-eyes/AltaDispositivo.tsx:616` | texto en pantalla | Todavía no se ha generado ninguno. | None has been generated yet. |
| `spaceeyes.alta.col.codigo` | `components/demo/space-eyes/AltaDispositivo.tsx:622` | texto en pantalla | Código | Code |
| `spaceeyes.alta.col.genero` | `components/demo/space-eyes/AltaDispositivo.tsx:626` | texto en pantalla | Generó | Created by |
| `spaceeyes.alta.usos` | `components/demo/space-eyes/AltaDispositivo.tsx:639` | texto en pantalla | {usos} de {max} equipos | {usos} of {max} devices |
| `spaceeyes.alta.lote.vigente` | `components/demo/space-eyes/AltaDispositivo.tsx:641` | texto en pantalla | ␣· vigente hasta {fecha} | ␣· valid until {fecha} |
| `spaceeyes.alta.lote.completo` | `components/demo/space-eyes/AltaDispositivo.tsx:643` | texto en pantalla | ␣· completo | ␣· full |
| `spaceeyes.alta.lote.cancelado` | `components/demo/space-eyes/AltaDispositivo.tsx:645` | texto en pantalla | ␣· cancelado | ␣· cancelled |
| `spaceeyes.alta.lote.vencido` | `components/demo/space-eyes/AltaDispositivo.tsx:646` | texto en pantalla | ␣· vencido | ␣· expired |
| `spaceeyes.alta.equipo-n` | `components/demo/space-eyes/AltaDispositivo.tsx:653`<br>`components/demo/space-eyes/AltaDispositivo.tsx:662` | texto en pantalla | equipo {id} | device {id} |
| `spaceeyes.alta.usado-por` | `components/demo/space-eyes/AltaDispositivo.tsx:662` | texto en pantalla | Usado · {nombre} | Used · {nombre} |
| `spaceeyes.alta.vigente-hasta` | `components/demo/space-eyes/AltaDispositivo.tsx:665` | texto en pantalla | Vigente hasta {fecha} | Valid until {fecha} |
| `spaceeyes.alta.estado.vencido` | `components/demo/space-eyes/AltaDispositivo.tsx:669` | texto en pantalla | Vencido | Expired |
| `spaceeyes.alta.estado.cancelado` | `components/demo/space-eyes/AltaDispositivo.tsx:671` | texto en pantalla | Cancelado | Cancelled |
| `spaceeyes.alta.estado.usado` | `components/demo/space-eyes/AltaDispositivo.tsx:672` | texto en pantalla | Usado | Used |
