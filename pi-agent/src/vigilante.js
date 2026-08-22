// pi-agent/src/vigilante.js
// Vigilancia del loop de la pantalla: detecta creativos NUEVOS y los fotografia.
//
// POR QUE HACIA FALTA
// -------------------
// El backend expone `creative_watch` y el dashboard lo deja configurar desde
// hace tiempo, pero NINGUN agente lo implementaba -ni la APK ni el de PC-, asi
// que el interruptor no hacia absolutamente nada. Un espectacular rota entre
// varios anuncios y las fotos programadas caen a horas fijas: si un creativo
// nuevo entra al loop a media tarde, con suerte se descubre al dia siguiente, y
// puede que nunca si su turno no coincide con el horario de la programacion.
//
// COMO FUNCIONA, Y POR QUE NO CUESTA DATOS
// ----------------------------------------
// Cada `recorrido`, el equipo mira la pantalla varias veces (una foto en gris,
// pequeña, que NO sale del equipo) y calcula la huella de 256 bits de cada
// vistazo. Comparar esa huella contra el catalogo que manda el servidor cuesta
// microsegundos y CERO megas. Solo cuando aparece una huella que no reconoce se
// gasta una foto de verdad.
//
// Lo que viaja despues son las huellas vistas -64 caracteres cada una-, pegadas
// al reporte de estado que el equipo ya manda de todos modos. Una docena de
// creativos no llega a un kilobyte.
//
// LAS TRES PROTECCIONES QUE IMPORTAN
// ----------------------------------
//   1. Las primeras 24 h el servidor responde `aprendiendo`: se registra el loop
//      completo -de dia y de noche- sin fotografiar nada. Sin eso, el primer
//      recorrido subiria doce fotos de creativos que llevaban semanas ahi.
//   2. Tope diario (`max_dia`): el servidor dice cuantas quedan. Una pantalla
//      averiada que parpadea no puede vaciar el plan de datos del sitio.
//   3. Un solo sensor: si hay una foto o una transmision en curso, el vistazo se
//      salta. La evidencia y la vista en vivo mandan sobre la vigilancia.
const huella = require('./huella');

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Si el servidor no contesta la configuracion, cada cuanto reintentar.
const REINTENTO_MIN = 15;

class Vigilante {
  /**
   * @param camara   instancia de Camara
   * @param api      instancia de Api
   * @param log      funcion de registro local
   * @param ocupado  () => bool: hay una foto o una transmision en curso
   */
  constructor(camara, api, log, ocupado) {
    this.camara = camara;
    this.api = api;
    this.log = log;
    this.ocupado = ocupado || (() => false);
    // Resultado del ultimo recorrido, a la espera de viajar pegado al proximo
    // reporte de estado. Se manda ahi y no en una peticion propia para no
    // agregar trafico: ver device.controller.ts.
    this.pendiente = null;
  }

  /** Lo que debe adjuntarse al proximo POST /api/device/status (y se consume). */
  tomarPendiente() {
    const p = this.pendiente;
    this.pendiente = null;
    return p;
  }

  /** Bucle de fondo. No se detiene nunca: la configuracion puede cambiar. */
  async correr() {
    for (;;) {
      let esperaMin = REINTENTO_MIN;
      try {
        const { config, restantes_hoy, conocidas } = await this.api.creativos();
        if (config?.vigilar) {
          await this.recorrido(config, Number(restantes_hoy) || 0, conocidas || []);
          esperaMin = Number(config.cada_min) || 360;
        } else {
          // Apagado en el dashboard: se vuelve a preguntar de vez en cuando, por
          // si alguien lo enciende. No cuesta nada, es una peticion cada rato.
          esperaMin = 60;
        }
      } catch (e) {
        this.log(`vigilancia: no pude leer la configuracion (${e.message})`);
      }
      await dormir(esperaMin * 60 * 1000);
    }
  }

  /**
   * Un recorrido completo del loop.
   *
   * Dura `recorrido_seg` y mira cada `paso_seg`. Los valores por omision -270 s
   * mirando cada 15 s- cubren un loop tipico de espectacular con margen: si el
   * ciclo dura menos, se ven creativos repetidos y no pasa nada; si dura mas, el
   * proximo recorrido agarra lo que falto.
   */
  async recorrido(config, restantes, conocidas) {
    const totalMs = (Number(config.recorrido_seg) || 270) * 1000;
    const pasoMs = Math.max(2000, (Number(config.paso_seg) || 15) * 1000);
    const tolerancia = Number(config.tolerancia) || huella.TOLERANCIA;
    const aprendiendo = !!config.aprendiendo;

    const vistas = [];
    const nuevas = [];
    let fotos = 0;
    let saltadas = 0;
    const finaliza = Date.now() + totalMs;

    this.log(`vigilancia: recorrido de ${Math.round(totalMs / 1000)}s` +
      (aprendiendo ? ' (aprendiendo: no se fotografia nada)' : `, ${restantes} fotos disponibles hoy`));

    while (Date.now() < finaliza) {
      // La evidencia y la vista en vivo mandan: con un solo sensor no se puede
      // mirar la pantalla mientras se atiende una foto o una transmision.
      if (this.ocupado()) {
        saltadas++;
        await dormir(pasoMs);
        continue;
      }

      let h = null;
      try {
        const vistazo = await this.camara.mirarEnGris();
        if (vistazo) h = huella.calcular(vistazo.gris, vistazo.ancho, vistazo.alto);
      } catch (e) {
        this.log(`vigilancia: no pude mirar la pantalla (${e.message})`);
      }

      // `calcular` devuelve null cuando la imagen no tiene contraste suficiente:
      // pantalla apagada, de noche sin nada encendido, o la lente tapada. No es
      // un creativo, y tomarlo por uno gastaria una foto.
      if (h) {
        // Se compara contra el catalogo del servidor Y contra lo ya visto en
        // este mismo recorrido: un creativo dura varios pasos en pantalla y sin
        // esto contaria como nuevo en cada vistazo.
        const yaConocida = huella.parecida(h, conocidas, tolerancia);
        const yaEnEstePase = huella.parecida(h, [...vistas, ...nuevas], tolerancia);

        if (yaConocida) {
          if (!yaEnEstePase) vistas.push(h);
        } else if (!yaEnEstePase) {
          nuevas.push(h);
          if (!aprendiendo && fotos < restantes) {
            if (await this.fotografiar(h)) fotos++;
          }
        }
      }

      const queda = finaliza - Date.now();
      if (queda <= 0) break;
      await dormir(Math.min(pasoMs, queda));
    }

    this.pendiente = { vistas, nuevas };
    this.log(`vigilancia: ${vistas.length} conocidas, ${nuevas.length} nuevas, ` +
      `${fotos} fotos${saltadas ? `, ${saltadas} vistazos saltados (camara ocupada)` : ''}`);
  }

  /** Foto de verdad de un creativo que el equipo no reconocio. */
  async fotografiar(phash) {
    try {
      const jpeg = await this.camara.tomarFoto();
      await this.api.subirFoto(jpeg, {
        taken_at: new Date().toISOString(),
        source: 'creative_change',
        phash,
      });
      this.log(`vigilancia: creativo nuevo fotografiado (${Math.round(jpeg.length / 1024)} KB)`);
      this.api.log('info', 'creative', 'Creativo nuevo detectado en la pantalla; foto subida');
      return true;
    } catch (e) {
      this.log(`vigilancia: no pude subir la foto del creativo nuevo (${e.message})`);
      return false;
    }
  }
}

module.exports = { Vigilante };
