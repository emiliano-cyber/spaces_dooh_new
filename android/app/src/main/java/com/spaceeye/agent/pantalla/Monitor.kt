// Monitor.kt — La vuelta de vigilancia: mira la pantalla, reconoce creativos y busca fallas.
package com.spaceeye.agent.pantalla

import android.content.Context
import android.util.Log
import com.spaceeye.agent.creativos.Reconocedor
import com.spaceeye.agent.network.ApiClient
import com.spaceeye.agent.network.RemoteLog
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalTime

/**
 * Lo que la vigilancia necesita de la camara. Lo implementa CommandHandler, que
 * es quien ya es dueño de la camara: con un solo sensor, la foto pedida y la
 * vista en vivo mandan, y la vigilancia se aparta.
 */
interface CamaraParaVigilar {
    /** Hay una foto o una vista en vivo en curso: no se puede mirar. */
    fun ocupada(): Boolean
    /** Abre la camara con el encuadre del sitio y la deja lista. */
    suspend fun abrir(lente: String, zoom: Float): Boolean
    /** Un JPEG tal como sale del sensor (sin girar), o null. */
    suspend fun tomar(): ByteArray?
    /** Gira el JPEG como las demas fotos del sitio, para subirlo. */
    fun enderezar(jpeg: ByteArray, grados: Int): ByteArray
    fun cerrar()
}

/**
 * UNA sola vuelta de camara sirve a las dos vigilancias:
 *
 *   - CREATIVOS: reconoce que anuncio hay (Reconocedor) y fotografia solo lo
 *     nuevo.
 *   - FALLAS: al terminar la vuelta, SaludAnalisis busca lo que no cambio cuando
 *     todo lo demas si; RevisionCamara comprueba antes que la camara no se haya
 *     movido; Seguimiento decide si eso merece una alerta.
 *
 * Camara -> analisis local -> solo si algo cambia de estado -> alerta + evidencia.
 * En una vuelta normal lo unico que sale del telefono es un resumen de unos
 * cientos de bytes, pegado al reporte de estado que ya se manda cada minuto.
 *
 * Solo se vigila dentro del HORARIO de la pantalla (por omision de 6 a 24): fuera
 * de el, una pantalla apagada es lo normal.
 */
class Monitor(
    private val ctx: Context,
    private val api: ApiClient,
    private val camara: CamaraParaVigilar,
) {
    companion object {
        private const val TAG = "Monitor"
        private const val REINTENTO_MIN = 15L
        private const val APAGADO_MIN = 60L
        /** Tomas que se promedian por vistazo. */
        private const val TOMAS = 3
        /** Segunda mirada a un creativo desconocido (dura ~20 s en pantalla). */
        private const val CONFIRMAR_MS = 4_000L
        /**
         * Modo CONTINUO (creativos cada_min = 0): las vueltas se encadenan todo el
         * dia dentro del horario. La configuracion se vuelve a pedir cada tanto y
         * no en cada vuelta, y el resumen al registro remoto se agrupa: asi mirar
         * sin parar NO cuesta mas datos que mirar cada 6 horas. Lo unico que
         * viaja sigue siendo la foto de un creativo nuevo.
         */
        private const val CONFIG_CONTINUO_MS = HuellaConfig.PLAZO_MS
        private const val LOG_CONTINUO_MS = 60 * 60_000L
        private const val PAUSA_CONTINUO_MS = 5_000L

        val NOMBRES = mapOf(
            "zona_apagada" to "Posible gabinete apagado",
            "zona_congelada" to "Posible gabinete congelado o tapado",
            "pantalla_apagada" to "Pantalla apagada en horario",
            "pantalla_congelada" to "Pantalla congelada (no cambia el contenido)",
            "camara_movida" to "La cámara se movió: hay que volver a marcar la pantalla",
            "sin_imagen" to "Sin imagen: lente tapada, o pantalla apagada de noche",
        )
    }

    private val reconocedor = Reconocedor(ctx)
    private val revision = RevisionCamara(ctx)
    private val evidencia = Evidencia(ctx)
    private val seguimiento = Seguimiento()
    private val dir = File(ctx.filesDir, "pantalla").apply { mkdirs() }
    private val estadoArchivo = File(dir, "seguimiento.json")
    private val pendientesArchivo = File(dir, "pendientes.json")
    private var firmaSeguimiento = ""
    private var desdeSeguimiento = 0L
    // Vueltas en que la pantalla se vio funcionando desde que se empezo a
    // aprender. La primera siempre es de aprendizaje.
    private var vueltasSalud = 0

    // Fotos de creativos nuevos que esperan su envio agrupado (envio_min).
    private val lote = LoteCreativos(dir) { System.currentTimeMillis() }
    // Pantalla completa apagada: se mira en cada vistazo, no al final de la vuelta.
    private val detectorApagada = DetectorApagada()
    // Campanas vendidas en SPACE OS para esta pantalla: su prueba del dia.
    private val campanas = Campanas(dir, { id -> api.referenciaCampana(id) }, { System.currentTimeMillis() })
    private val buscadorCampanas = BuscadorCampanas(campanas)

    private var ultimaCreativos = 0L
    private var ultimaSalud = 0L

    // Modo continuo: ultima configuracion recibida, y el resumen acumulado que se
    // manda al registro remoto una vez por hora (o en cuanto aparece algo nuevo).
    private var config: JSONObject? = null
    private var configEn = 0L
    // La huella que tenia el servidor cuando se pidio la configuracion guardada.
    private var configHuella: String? = null
    private var acumVistazos = 0
    private val acumConocidos = mutableSetOf<String>()
    private var ultimoLogCreativos = 0L
    private var avisoSinPantalla = false

    /** Resumen de la ultima vuelta, a la espera del proximo reporte de estado. */
    @Volatile private var pendiente: JSONObject? = null

    fun tomarPendiente(): JSONObject? = synchronized(this) { pendiente.also { pendiente = null } }

    /** Si el reporte no salio, el resumen se guarda para el siguiente. */
    fun devolver(p: JSONObject) = synchronized(this) {
        val actual = pendiente
        if (actual == null) { pendiente = p; return@synchronized }
        // Los creativos se suman; de salud vale el mas reciente.
        val c1 = actual.optJSONObject("creativos"); val c2 = p.optJSONObject("creativos")
        if (c1 != null && c2 != null) {
            actual.put("creativos", JSONObject()
                .put("vistas", unir(c1.optJSONArray("vistas"), c2.optJSONArray("vistas")))
                .put("nuevas", unir(c1.optJSONArray("nuevas"), c2.optJSONArray("nuevas"))))
        } else if (c2 != null) actual.put("creativos", c2)
        if (!actual.has("salud") && p.has("salud")) actual.put("salud", p.get("salud"))
    }

    private fun unir(a: JSONArray?, b: JSONArray?): JSONArray {
        val s = linkedSetOf<String>()
        for (arr in listOfNotNull(a, b)) for (i in 0 until arr.length()) s.add(arr.getString(i))
        return JSONArray(s.take(60))
    }

    private fun agregarAlResumen(clave: String, valor: Any) = synchronized(this) {
        val p = pendiente ?: JSONObject().also { pendiente = it }
        p.put(clave, valor)
    }

    /** Bucle de fondo. No termina nunca: la configuracion puede cambiar. */
    suspend fun correr() = coroutineScope {
        try { if (estadoArchivo.exists()) JSONObject(estadoArchivo.readText()).let {
            firmaSeguimiento = it.optString("firma"); desdeSeguimiento = it.optLong("desde")
            vueltasSalud = it.optInt("vueltas")
            it.optJSONObject("estado")?.let { e -> seguimiento.deJson(e) }
        } } catch (_: Exception) {}

        while (isActive) {
            var esperaMs = REINTENTO_MIN * 60_000L
            try {
                esperaMs = vuelta()
            } catch (e: Exception) {
                Log.e(TAG, "vuelta fallo: ${e.message}", e)
                RemoteLog.warn(ctx, "monitor", "La vigilancia de la pantalla fallo: ${e.message}")
            }
            delay(esperaMs)
        }
    }

    /**
     * La configuracion del servidor. En modo continuo se reutiliza la ultima si es
     * reciente, salvo que toque revisar fallas (esas necesitan saber que alertas
     * estan abiertas).
     */
    private fun configuracion(): JSONObject? {
        val c = config
        val ahora = System.currentTimeMillis()
        val continuo = c?.optJSONObject("creativos")?.let { it.optBoolean("vigilar") && it.optLong("cada_min", 360L) == 0L } == true
        val saludPronto = c?.optJSONObject("salud")?.let { s ->
            s.optBoolean("vigilar") && ahora - ultimaSalud >= s.optLong("cada_min", 60L).coerceAtLeast(5L) * 60_000L - 30_000L
        } == true
        // La huella del ultimo reporte de estado: si no cambio, lo que se tiene
        // sirve. Un ajuste en el panel o una campana nueva la cambian, y llega en
        // la siguiente vuelta en vez de esperar los 15 minutos.
        val huella = api.vigilancia
        if (c != null && continuo && !saludPronto && HuellaConfig.reusar(huella, configHuella, configEn, ahora, CONFIG_CONTINUO_MS)) return c
        val nueva = api.monitoreo() ?: return null
        config = nueva
        configEn = ahora
        configHuella = huella
        return nueva
    }

    /** Una vuelta si toca. Devuelve cuanto esperar a la siguiente (ms). */
    private suspend fun vuelta(): Long {
        val r = configuracion() ?: return REINTENTO_MIN * 60_000L
        val cCfg = r.optJSONObject("creativos")
        val sCfg = r.optJSONObject("salud")
        val quiereCreativos = cCfg?.optBoolean("vigilar") == true
        val quiereSalud = sCfg?.optBoolean("vigilar") == true
        if (!quiereCreativos && !quiereSalud) return APAGADO_MIN * 60_000L

        // cada_min = 0 en creativos es el modo continuo.
        val continuo = quiereCreativos && cCfg!!.optLong("cada_min", 360L) == 0L
        val cadaC = if (continuo) 0L else (cCfg?.optLong("cada_min", 360L) ?: 360L).coerceAtLeast(30L)
        // 5 y 15 min son intervalos de PRUEBAS; en produccion, 30 min o mas.
        val cadaS = (sCfg?.optLong("cada_min", 60L) ?: 60L).coerceAtLeast(5L)
        seguimiento.separacionMs = minOf(25 * 60_000L, cadaS * 60_000L * 8 / 10)
        sCfg?.let { s ->
            seguimiento.confirmaciones = s.optInt("confirmaciones", 2).coerceIn(1, 6)
            seguimiento.umbral = s.optDouble("umbral", 0.6).coerceIn(0.3, 0.95)
        }
        val espera = if (continuo) PAUSA_CONTINUO_MS
            else minOf(if (quiereCreativos) cadaC else Long.MAX_VALUE, if (quiereSalud) cadaS else Long.MAX_VALUE) * 60_000L

        val geo = Geometria.deJson(r.optJSONObject("pantalla"))
        if (geo == null) {
            // Sin las esquinas NO se vigila: con la foto entera el fondo confunde
            // a los creativos entre si y no hay donde buscar gabinetes.
            if (!avisoSinPantalla) RemoteLog.warn(ctx, "monitor",
                "La vigilancia esta encendida pero falta marcar la pantalla en el dashboard; no se vigila hasta entonces")
            avisoSinPantalla = true
            return maxOf(espera, REINTENTO_MIN * 60_000L)
        }
        avisoSinPantalla = false
        // Fuera de horario: se vuelve a mirar el reloj cada 10 minutos.
        if (!geo.enHorario(LocalTime.now())) return 10 * 60_000L
        // Envio agrupado de creativos nuevos: al cumplirse el plazo, o en cuanto
        // se vuelva a "al momento" con fotos esperando.
        val envioMin = if (quiereCreativos) cCfg!!.optLong("envio_min", 0L) else 0L
        if (lote.debeEnviar(envioMin)) enviarLote(cCfg)
        // Aviso rapido de pantalla apagada (encendido por omision).
        val avisoCfg = if (DetectorApagada.activo(sCfg)) sCfg else null
        if (!Vision.cargar()) {
            RemoteLog.error(ctx, "monitor", "No se pudo cargar el reconocimiento de imagen (OpenCV); no se vigila")
            return APAGADO_MIN * 60_000L
        }
        // Las campanas de hoy: baja la referencia de las nuevas, olvida las que ya no.
        if (quiereCreativos) campanas.actualizar(cCfg!!.optJSONArray("campanas"))

        val ahora = System.currentTimeMillis()
        val tocaC = quiereCreativos && (continuo || ahora - ultimaCreativos >= cadaC * 60_000L - 60_000L)
        val tocaS = quiereSalud && ahora - ultimaSalud >= cadaS * 60_000L - 30_000L
        if (!tocaC && !tocaS) {
            // Se duerme justo hasta la proxima que toque. NO cada minuto: cada
            // despertar pide la configuracion, y eso si serian datos en balde.
            val faltaC = if (quiereCreativos) ultimaCreativos + cadaC * 60_000L - ahora else Long.MAX_VALUE
            val faltaS = if (quiereSalud) ultimaSalud + cadaS * 60_000L - ahora else Long.MAX_VALUE
            return minOf(faltaC, faltaS).coerceIn(60_000L, maxOf(espera, 60_000L))
        }

        enviarPendientes()
        recorrido(r, geo, if (tocaC) cCfg else null, if (tocaS) sCfg else null, continuo, avisoCfg)
        if (tocaC) ultimaCreativos = ahora
        if (tocaS) ultimaSalud = ahora
        return espera
    }

    private suspend fun recorrido(r: JSONObject, geo: Geometria, cCfg: JSONObject?, sCfg: JSONObject?, continuo: Boolean = false,
                                  avisoCfg: JSONObject? = null) {
        val base = cCfg ?: sCfg!!
        val totalMs = base.optLong("recorrido_seg", 270L) * 1000L
        val pasoMs = (base.optLong("paso_seg", 15L) * 1000L).coerceAtLeast(5_000L)

        val encuadre = r.optJSONObject("encuadre")
        val lente = encuadre?.optString("camera_lens", "main") ?: "main"
        val zoom = (encuadre?.optDouble("camera_zoom", 0.0) ?: 0.0).toFloat()
        val giro = encuadre?.optInt("rotation", 0) ?: 0
        val firmaEncuadre = listOf(geo.firma(), lente, "%.3f".format(zoom), giro).joinToString("|")

        // Creativos
        var restantesC = cCfg?.optInt("restantes_hoy", 0) ?: 0
        // > 0: las fotos nuevas no se suben al momento, se juntan (LoteCreativos).
        val envioMin = cCfg?.optLong("envio_min", 0L) ?: 0L
        val aprendiendoC: Boolean
        if (cCfg != null) {
            reconocedor.abrir(firmaEncuadre + "|" + cCfg.optString("desde"))
            aprendiendoC = cCfg.optBoolean("aprendiendo") || reconocedor.aprendiendo(cCfg.optLong("aprendizaje_min", 120L))
        } else aprendiendoC = true
        val vistas = linkedSetOf<String>()
        val nuevas = mutableListOf<String>()
        var candidata: Pair<String, Vision.Rasgos>? = null
        var fotos = 0
        var reconocibles = 0

        val vistazos = mutableListOf<Vistazo>()
        // En que sesion de camara se tomo cada vistazo: cada vez que la camara se
        // reabre a mitad de vuelta la exposicion se fija a otro nivel.
        val sesiones = mutableListOf<Int>()
        var sesion = 0
        var saltados = 0
        var abierta = false
        try {
            val fin = System.currentTimeMillis() + totalMs
            while (System.currentTimeMillis() < fin) {
                if (camara.ocupada()) {
                    saltados++; abierta = false; candidata = null
                    detectorApagada.reiniciar()
                    delay(pasoMs); continue
                }
                if (!abierta) {
                    abierta = camara.abrir(lente, zoom)
                    if (!abierta) { saltados++; delay(pasoMs); continue }
                    sesion++
                    // Al reabrir, la exposicion se fija de nuevo: los vistazos de
                    // antes ya no son "seguidos" de los de ahora.
                    detectorApagada.reiniciar()
                }
                val tomas = mutableListOf<ByteArray>()
                repeat(TOMAS) { camara.tomar()?.let { tomas.add(it) } }
                if (tomas.isEmpty()) { abierta = false; delay(pasoMs); continue }
                val v = Enderezador.preparar(tomas, geo, giro)
                if (v == null) { delay(pasoMs); continue }
                var espera = pasoMs

                // Pantalla completa apagada: no espera a la revision de siempre.
                if (avisoCfg != null && detectorApagada.observar(medirApagada(v, geo))) {
                    avisarApagada(v, geo, giro, avisoCfg)
                }

                if (cCfg != null) {
                    val gris = Enderezador.aDoubles(v.pantalla)
                    val huella = com.spaceeye.agent.creativos.Huella.calcular(gris, v.pantalla.cols(), v.pantalla.rows())
                    if (huella == null) {
                        candidata = null   // sin contraste: pantalla apagada o lente tapada
                    } else {
                        reconocibles++
                        val rasgos = Vision.rasgos(v.pantalla)
                        val (id, puntos) = reconocedor.reconocer(rasgos)
                        val previa = candidata
                        // Una campana vendida en SPACE OS: su prueba del dia sale al
                        // momento (aun aprendiendo) y NO es un creativo nuevo, asi que
                        // no gasta el tope de lo programatico.
                        // Todas las que coinciden: el mismo arte puede estar en dos
                        // campanas de esta pantalla y cada una lleva su prueba.
                        val halladas = if (campanas.tamaño > 0) buscadorCampanas.buscarTodas(rasgos, v.pantalla) else emptyList()
                        if (halladas.isNotEmpty()) {
                            candidata = null
                            var fotoPrueba: ByteArray? = null
                            for (camp in halladas) {
                                if (campanas.pendiente(camp) && v.jpeg.isNotEmpty()) {
                                    val foto = fotoPrueba ?: evidencia.reducir(camara.enderezar(v.jpeg, giro)).also { fotoPrueba = it }
                                    subirCampana(foto, camp)
                                }
                            }
                            if (id != null && puntos >= Reconocedor.UMBRAL) vistas.add(id)
                            // Que el catalogo la conozca: cuando la campana termine no
                            // debe volver como "nueva".
                            else reconocedor.agregar(huella, rasgos)
                        } else if (id != null && puntos >= Reconocedor.UMBRAL) {
                            vistas.add(id); reconocedor.aprenderVariante(id, rasgos, puntos); candidata = null
                            // Espera su envio agrupado: si esta mirada sale mas
                            // nitida, se manda esta. La foto solo se prepara si mejora.
                            if (lote.tiene(id) && v.jpeg.isNotEmpty()) {
                                val n = nitidez(v.pantalla)
                                if (lote.mejoraria(id, n)) lote.mejorar(id, evidencia.reducir(camara.enderezar(v.jpeg, giro)), n)
                            }
                        } else if (previa != null && Vision.coincidencias(previa.second, rasgos) >= Reconocedor.UMBRAL) {
                            // Segunda mirada: sigue ahi. Es un creativo nuevo de verdad.
                            reconocedor.agregar(previa.first, previa.second, rasgos)
                            nuevas.add(previa.first)
                            when (LoteCreativos.destino(aprendiendoC, envioMin, restantesC)) {
                                // Envio agrupado: se guarda y sale con el lote.
                                LoteCreativos.Destino.LOTE -> lote.agregar(previa.first,
                                    evidencia.reducir(camara.enderezar(v.jpeg, giro)), nitidez(v.pantalla))
                                LoteCreativos.Destino.SUBIR ->
                                    if (subirCreativo(evidencia.reducir(camara.enderezar(v.jpeg, giro)), previa.first)) { fotos++; restantesC-- }
                                LoteCreativos.Destino.NINGUNO -> Unit
                            }
                            candidata = null
                        } else {
                            candidata = huella to rasgos
                            espera = CONFIRMAR_MS
                        }
                    }
                }
                v.pantalla.release()
                // Solo el ultimo vistazo de cada tramo de camara conserva su foto
                // completa (la evidencia sale del ultimo del tramo que se juzga).
                // Cada JPEG pesa 3-5 MB y una vuelta en continuo junta mas de 50:
                // guardarlos todos podia agotar la memoria de la app.
                if (sesiones.lastOrNull() == sesion) vistazos[vistazos.size - 1] = vistazos.last().sinFoto()
                vistazos.add(v)
                sesiones.add(sesion)

                val queda = fin - System.currentTimeMillis()
                if (queda <= 0) break
                delay(minOf(espera, queda))
            }
        } finally {
            camara.cerrar()
        }

        if (cCfg != null) {
            if (reconocibles > 0) reconocedor.terminoVuelta()
            vistas.removeAll(nuevas.toSet())
            if (vistas.isNotEmpty() || nuevas.isNotEmpty()) {
                devolver(JSONObject().put("creativos", JSONObject().put("vistas", JSONArray(vistas.toList())).put("nuevas", JSONArray(nuevas))))
            }
            // Lo que queda del tope del dia, para las vueltas que reutilizan la
            // configuracion sin volver a pedirla.
            cCfg.put("restantes_hoy", restantesC)
            if (!continuo) {
                RemoteLog.info(ctx, "creative", "Recorrido de creativos: ${vistazos.size} vistazos, ${vistas.size} conocidos, " +
                    "${nuevas.size} nuevos, $fotos fotos; catalogo de ${reconocedor.tamaño()}" +
                    (if (aprendiendoC) " (aprendiendo: no se fotografia)" else "") +
                    (if (saltados > 0) ", $saltados saltados por camara ocupada" else ""))
            } else {
                // En continuo se agrupa: un aviso por hora, o en cuanto hay algo nuevo.
                acumVistazos += vistazos.size
                acumConocidos.addAll(vistas)
                val ahoraLog = System.currentTimeMillis()
                if (nuevas.isNotEmpty() || ahoraLog - ultimoLogCreativos >= LOG_CONTINUO_MS) {
                    RemoteLog.info(ctx, "creative", "Vigilancia continua: $acumVistazos vistazos desde el ultimo aviso, " +
                        "${acumConocidos.size} creativos conocidos en rotacion, ${nuevas.size} nuevos ahora ($fotos fotos); " +
                        "catalogo de ${reconocedor.tamaño()}" + (if (aprendiendoC) " (aprendiendo: no se fotografia)" else ""))
                    acumVistazos = 0; acumConocidos.clear(); ultimoLogCreativos = ahoraLog
                }
            }
        }

        if (sCfg != null) salud(r, sCfg, geo, firmaEncuadre, giro, vistazos, sesiones)
        vistazos.forEach { it.marco.release() }
    }

    private fun salud(r: JSONObject, cfg: JSONObject, geo: Geometria, firmaEncuadre: String, giro: Int,
                      todos: List<Vistazo>, sesiones: List<Int>) {
        // Solo el tramo mas largo con la misma exposicion (ver tramoMasLargo).
        val tramo = SaludAnalisis.tramoMasLargo(sesiones)
        val vistazos = if (tramo.isEmpty()) emptyList() else todos.slice(tramo)
        val interrumpida = sesiones.distinct().size > 1
        // Lo aprendido vale para UN encuadre y UNA cuadricula.
        val desdeServidor = cfg.optString("desde")
        if (firmaSeguimiento != firmaEncuadre + "|" + desdeServidor) {
            seguimiento.reiniciar()
            firmaSeguimiento = firmaEncuadre + "|" + desdeServidor
            desdeSeguimiento = System.currentTimeMillis()
            vueltasSalud = 0
        }
        // "|fuera": las referencias viejas se tomaron con la pantalla incluida;
        // con este sufijo se vuelven a tomar solo con lo de alrededor.
        revision.abrir(firmaEncuadre + "|fuera")
        // Aprende la primera vuelta en que vea la pantalla funcionando, y ademas
        // los minutos configurados (0 = solo esa vuelta).
        val aprendizajeMs = cfg.optLong("aprendizaje_min", 120L) * 60_000L
        val aprendiendo = cfg.optBoolean("aprendiendo") || vueltasSalud == 0 ||
            System.currentTimeMillis() - desdeSeguimiento < aprendizajeMs

        val camaraEstado = revision.revisar(vistazos, geo)
        val excluir = geo.excluir + seguimiento.excluidas()
        val resultado = if (camaraEstado == Seguimiento.Camara.OK)
            SaludAnalisis.analizar(vistazos.map { it.salud }, geo.filas, geo.columnas, excluir) else null

        val abiertas = mutableMapOf<String, Long>()
        cfg.optJSONArray("abiertas")?.let { a -> for (i in 0 until a.length()) a.getJSONObject(i).let { o ->
            abiertas[Seguimiento.claveDelServidor(o.getString("tipo"), o.optInt("fila", -1).takeIf { it >= 0 }, o.optInt("columna", -1).takeIf { it >= 0 })] = o.getLong("id")
        } }
        seguimiento.sincronizar(abiertas)
        val silenciadas = mutableSetOf<String>()
        // El servidor nombra "zona_apagada" a secas a una agrupada; el equipo la
        // llama "zona_apagada:varias". Sin traducirla, descartar una alerta de
        // varios gabinetes no la silenciaba y volvia a abrirse con otra foto.
        cfg.optJSONArray("silenciadas")?.let { a -> for (i in 0 until a.length()) {
            val k = a.getString(i)
            silenciadas.add(k)
            if (k.startsWith("zona_") && !k.contains(':')) silenciadas.add(Seguimiento.claveGrupo(k))
        } }

        val eventos = seguimiento.registrar(System.currentTimeMillis(),
            Seguimiento.Observacion(resultado, camaraEstado, geo.filas, geo.columnas),
            aprendiendo, silenciadas, cfg.optInt("restantes_hoy", 6))

        if (resultado?.pantalla == SaludAnalisis.Pantalla.OK) vueltasSalud++

        val ultimo = vistazos.lastOrNull()
        for (e in eventos) {
            val zonas = if (e.fila != null && e.columna != null) listOf(e.fila to e.columna) else e.zonas
            val grupo = e.zonas.isNotEmpty() || e.clave.endsWith(":varias")
            val nombre = if (grupo) (if (e.tipo == "zona_apagada") "Varios gabinetes apagados" else "Varios gabinetes congelados o tapados")
                else NOMBRES[e.tipo] ?: e.tipo
            val gabinetes = e.zonas.map { (f, c) -> geo.numero(f, c) }.sorted()
            val donde = when {
                e.fila != null && e.columna != null ->
                    " · Gabinete ${geo.numero(e.fila, e.columna)} (fila ${e.fila + 1}, columna ${e.columna + 1})"
                gabinetes.isNotEmpty() -> " · Gabinetes ${gabinetes.joinToString(", ")} (${gabinetes.size} de ${geo.filas * geo.columnas})"
                else -> ""
            }
            val texto = (if (e.accion == "recuperar") "Recuperado: " else "") + nombre + donde
            val foto = ultimo?.let { evidencia.preparar(camara.enderezar(it.jpeg, giro), geo, zonas, texto) }
            val campos = mutableMapOf(
                "evento" to e.accion, "tipo" to e.tipo, "confianza" to e.confianza.toString(),
                "detectada_en" to java.time.Instant.now().toString(),
                "detalle" to JSONObject().put("texto", texto).put("vistazos", vistazos.size)
                    .put("cambios", resultado?.cambios ?: 0).put("camara", camaraEstado.name)
                    .apply { if (gabinetes.isNotEmpty()) {
                        put("gabinetes", JSONArray(gabinetes))
                        put("zonas", JSONArray(e.zonas.map { JSONArray(listOf(it.first, it.second)) }))
                        put("total", geo.filas * geo.columnas)
                    } }.toString(),
            )
            e.fila?.let { campos["fila"] = it.toString() }
            e.columna?.let { campos["columna"] = it.toString() }
            e.fallaId?.let { campos["falla_id"] = it.toString() }
            val nombreEvidencia = "${System.currentTimeMillis()}_${e.clave.replace(':', '_')}"
            foto?.let { evidencia.guardar(nombreEvidencia, it) }
            evidencia.anotar(JSONObject(campos as Map<*, *>))

            val id = api.reportarFalla(campos, foto)
            if (id == com.spaceeye.agent.network.FALLA_RECHAZADA) {
                // El servidor no la quiere (tope del dia...): se olvida aqui tambien,
                // o el equipo la creeria abierta para siempre.
                if (e.accion == "abrir") seguimiento.olvidar(e.clave)
            } else if (id != null) {
                if (e.accion == "abrir") seguimiento.confirmada(e.clave, id)
                RemoteLog.warn(ctx, "monitor", texto)
            } else {
                encolar(campos, e.clave, if (foto != null) nombreEvidencia else null)
            }
        }

        agregarAlResumen("salud", JSONObject()
            .put("ts", System.currentTimeMillis())
            .put("pantalla", resultado?.pantalla?.name ?: "INCONCLUSO")
            .put("camara", camaraEstado.name)
            .put("vistazos", todos.size)
            .put("vistazos_usados", vistazos.size)
            .put("interrumpida", interrumpida)
            .put("cambios", resultado?.cambios ?: 0)
            .put("aprendiendo", aprendiendo)
            // Si Android le niega la camara en segundo plano, la vuelta no ve nada
            // y hay que decirlo: si no, el dashboard solo muestra "no se pudo juzgar".
            .put("camara_permitida", com.spaceeye.agent.service.MonitorService.camaraDeclarada())
            // Lo que midio cada gabinete, relativo a uno sano (fila por fila). Son
            // unos 200 bytes; sirven para ajustar los umbrales con lo que ve la
            // camara real y no con fotos de prueba.
            .apply {
                resultado?.actividad?.let { a -> put("actividad", JSONArray(a.map { f -> JSONArray(f.map { Math.round(it * 100) / 100.0 }) })) }
                resultado?.brillo?.let { b -> put("brillo", JSONArray(b.map { f -> JSONArray(f.map { Math.round(it * 100) / 100.0 }) })) }
            }
            .put("zonas", JSONArray(resultado?.zonas?.map { JSONArray(listOf(it.tipo, it.fila, it.columna, it.confianza)) } ?: emptyList<JSONArray>()))
            .put("excluidas", JSONArray(seguimiento.excluidas().map { JSONArray(listOf(it.first, it.second)) })))

        guardarEstado()
        Log.i(TAG, "salud: pantalla=${resultado?.pantalla} camara=$camaraEstado zonas=${resultado?.zonas?.size} eventos=${eventos.size}")
    }

    private fun guardarEstado() {
        try {
            estadoArchivo.writeText(JSONObject().put("firma", firmaSeguimiento).put("desde", desdeSeguimiento)
                .put("vueltas", vueltasSalud).put("estado", seguimiento.aJson()).toString())
        } catch (_: Exception) {}
    }

    // --- Reintentos: una alerta que no salio por falta de red no se pierde ------

    private fun encolar(campos: Map<String, String>, clave: String, evidenciaNombre: String?) {
        try {
            val arr = if (pendientesArchivo.exists()) JSONArray(pendientesArchivo.readText()) else JSONArray()
            arr.put(JSONObject().put("campos", JSONObject(campos as Map<*, *>)).put("clave", clave).put("evidencia", evidenciaNombre ?: ""))
            // Tope: si el telefono lleva dias sin red, basta con lo mas reciente.
            val recortado = JSONArray((0 until arr.length()).map { arr.get(it) }.takeLast(20))
            pendientesArchivo.writeText(recortado.toString())
        } catch (_: Exception) {}
    }

    private fun enviarPendientes() {
        if (!pendientesArchivo.exists()) return
        val arr = try { JSONArray(pendientesArchivo.readText()) } catch (_: Exception) { JSONArray() }
        val quedan = JSONArray()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            val c = o.getJSONObject("campos")
            val campos = c.keys().asSequence().map { it as String }.associateWith { c.getString(it) }
            val nombre = o.optString("evidencia")
            val foto = if (nombre.isNotEmpty()) File(dir, "evidencia/$nombre.jpg").takeIf { it.exists() }?.readBytes() else null
            val id = api.reportarFalla(campos, foto)
            if (id == null) quedan.put(o)
            else if (id == com.spaceeye.agent.network.FALLA_RECHAZADA) {
                if (campos["evento"] == "abrir") seguimiento.olvidar(o.getString("clave"))
            }
            else if (campos["evento"] == "abrir") seguimiento.confirmada(o.getString("clave"), id)
        }
        if (quedan.length() == 0) pendientesArchivo.delete() else pendientesArchivo.writeText(quedan.toString())
        guardarEstado()
    }

    /** Manda las fotos de creativos nuevos que esperaban, una por creativo. */
    private fun enviarLote(cCfg: JSONObject?) {
        val e = lote.enviar(cCfg?.optInt("restantes_hoy", 0) ?: 0) { h, jpeg -> subirCreativo(jpeg, h) }
        cCfg?.put("restantes_hoy", e.restantes)
        RemoteLog.info(ctx, "creative", "Envio agrupado: ${e.enviadas} foto(s) de creativos nuevos" +
            (if (e.quedan > 0) "; ${e.quedan} esperan al tope de manana" else ""))
    }

    private fun medirApagada(v: Vistazo, geo: Geometria): DetectorApagada.Medida {
        val p = ByteArray(v.pantalla.total().toInt()).also { v.pantalla.get(0, 0, it) }
        val m = ByteArray(v.marco.total().toInt()).also { v.marco.get(0, 0, it) }
        return detectorApagada.medir(p, m, v.marco.cols(), v.marco.rows(), geo.esquinas)
    }

    /** Pantalla completa apagada: la falla sale ya, con su foto. */
    private fun avisarApagada(v: Vistazo, geo: Geometria, giro: Int, cfg: JSONObject) {
        val k = DetectorApagada.CLAVE
        if (!DetectorApagada.puedeAvisar(vueltasSalud, seguimiento.estaAbierta(k), DetectorApagada.silenciada(cfg),
                cfg.optInt("restantes_hoy", 6))) return
        val texto = NOMBRES.getValue(k)
        val foto = if (v.jpeg.isNotEmpty()) evidencia.preparar(camara.enderezar(v.jpeg, giro), geo, emptyList(), texto) else null
        val campos = mutableMapOf(
            "evento" to "abrir", "tipo" to k, "confianza" to "1.0",
            "detectada_en" to java.time.Instant.now().toString(),
            "detalle" to JSONObject().put("texto", texto).put("vistazos", detectorApagada.vistazos)
                .put("rapido", true).put("camara", "OK").toString(),
        )
        val nombreEvidencia = "${System.currentTimeMillis()}_$k"
        foto?.let { evidencia.guardar(nombreEvidencia, it) }
        evidencia.anotar(JSONObject(campos as Map<*, *>))
        val id = api.reportarFalla(campos, foto)
        if (id == com.spaceeye.agent.network.FALLA_RECHAZADA) return
        DetectorApagada.anotar(seguimiento, cfg, id)
        if (id != null) RemoteLog.warn(ctx, "monitor", "$texto (aviso rapido)")
        // Sin red: queda abierta aqui (no se repite) y el aviso sale despues.
        else encolar(campos, k, if (foto != null) nombreEvidencia else null)
        guardarEstado()
        Log.w(TAG, "pantalla apagada: aviso rapido (${detectorApagada.vistazos} vistazos)")
    }

    /** Varianza del laplaciano: mas alta, mas nitida (para quedarse con la mejor foto). */
    private fun nitidez(gris: org.opencv.core.Mat): Double {
        val lap = org.opencv.core.Mat()
        val media = org.opencv.core.MatOfDouble()
        val desv = org.opencv.core.MatOfDouble()
        return try {
            org.opencv.imgproc.Imgproc.Laplacian(gris, lap, org.opencv.core.CvType.CV_64F)
            org.opencv.core.Core.meanStdDev(lap, media, desv)
            desv.get(0, 0)[0].let { it * it }
        } finally { lap.release(); media.release(); desv.release() }
    }

    /** La prueba del dia de una campana: se marca solo si llego. */
    private fun subirCampana(jpeg: ByteArray, id: Int) {
        val ok = api.uploadPhoto(photoBytes = jpeg, campaignId = id, source = "campana", watermarkBaked = false)
        if (ok) {
            campanas.marcar(id)
            RemoteLog.info(ctx, "campaign", "Campana $id vista en la pantalla; foto de prueba subida (${jpeg.size / 1024} KB)")
        } else RemoteLog.warn(ctx, "campaign", "Campana $id vista en la pantalla, pero la foto no se pudo subir")
    }

    private fun subirCreativo(jpeg: ByteArray, huella: String): Boolean {
        val ok = api.uploadPhoto(photoBytes = jpeg, source = "creative_change", watermarkBaked = false, phash = huella)
        if (ok) RemoteLog.info(ctx, "creative", "Creativo nuevo detectado en la pantalla; foto subida (${jpeg.size / 1024} KB)")
        else RemoteLog.warn(ctx, "creative", "Creativo nuevo detectado, pero la foto no se pudo subir")
        return ok
    }
}
