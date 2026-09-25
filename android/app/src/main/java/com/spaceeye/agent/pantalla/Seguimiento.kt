// Seguimiento.kt — Decide CUANDO avisar de una falla, y cuando darla por resuelta.
package com.spaceeye.agent.pantalla

import org.json.JSONArray
import org.json.JSONObject

/**
 * SaludAnalisis dice lo que vio en UNA vuelta. Esto decide si eso merece una
 * alerta, con las protecciones contra falsas alarmas:
 *
 *   1. CONFIRMACION: la misma falla en `confirmaciones` vueltas seguidas, cada una
 *      separada al menos `separacionMs` de la anterior. Un camion estacionado
 *      delante o un anuncio raro no aguantan eso.
 *   2. UMBRAL: la confianza media de esas vueltas tiene que pasar `umbral`.
 *   3. UNA SOLA ALERTA por falla: mientras este abierta, no se repite.
 *   4. RECUPERACION: tras `recuperacion` vueltas sanas seguidas se cierra y se
 *      avisa, para que quede la hora en que se arreglo.
 *   5. INCONCLUSO NO CUENTA: una vuelta que no se pudo juzgar (niebla, pocas
 *      tomas, camara ocupada) ni confirma ni desmiente nada.
 *   6. SILENCIO: lo que alguien descarto en el dashboard ("no es falla") no
 *      vuelve a sonar mientras el servidor lo mantenga silenciado.
 *   7. APRENDIZAJE: al principio no se avisa nada (la primera vuelta, y los
 *      minutos configurados; 2 h por omision); se aprende que zonas NO
 *      cambian nunca (tapadas por una barda o un arbol, como en TLALPAN) para no
 *      juzgarlas despues. Esas zonas se informan al dashboard: un gabinete que ya
 *      estaba muerto al instalar tambien "nunca cambia", y no debe pasar callado.
 *
 * Codigo puro y con el estado serializable: sobrevive a un reinicio del
 * telefono, que en campo pasa.
 */
class Seguimiento(
    private val confirmaciones: Int = 2,
    // 25 y no 30 min: con vueltas cada 30 min el reloj las separa 29 y pico, y
    // no deben contar como la misma. Con los intervalos cortos de pruebas (5 o
    // 15 min) el Monitor la baja al 80% del intervalo.
    var separacionMs: Long = 25 * 60_000L,
    private val umbral: Double = 0.6,
    private val recuperacion: Int = 2,
) {
    /** El resultado de una vuelta, ya con lo de la camara. */
    class Observacion(
        val salud: SaludAnalisis.Resultado?,
        val camara: Camara,
        val filas: Int,
        val columnas: Int,
    )

    enum class Camara { OK, MOVIDA, SIN_IMAGEN, INCONCLUSO }

    data class Evento(
        val accion: String,          // "abrir" | "recuperar"
        val clave: String,
        val tipo: String,
        val fila: Int?,
        val columna: Int?,
        val confianza: Double,
        val fallaId: Long? = null,
        /** Los gabinetes de una falla agrupada ("varios gabinetes apagados"). */
        val zonas: List<Pair<Int, Int>> = emptyList(),
    )

    private class Candidato(val tipo: String, val fila: Int?, val columna: Int?, var cuenta: Int, val confianzas: MutableList<Double>)
    private class Abierta(var id: Long?, var sanas: Int)
    private class Celda(var vueltas: Int = 0, var quietas: Int = 0)

    private val candidatos = mutableMapOf<String, Candidato>()
    private val abiertas = mutableMapOf<String, Abierta>()
    private val celdas = mutableMapOf<String, Celda>()
    private var ultimaVuelta = NUNCA

    companion object {
        fun clave(tipo: String, fila: Int?, columna: Int?) =
            if (fila == null || columna == null) tipo else "$tipo:$fila:$columna"

        /** Clave de una falla agrupada: varios gabinetes con la misma falla. */
        fun claveGrupo(tipo: String) = "$tipo:varias"

        /**
         * Una zona que en una vuelta normal casi no se movio o casi no se encendio.
         * 0.2 y no 0.3: contra el percentil 75 una zona SANA de las fotos reales
         * baja hasta 0.26; una tapada por una barda queda cerca de 0.05.
         */
        private const val QUIETA_ACTIVIDAD = 0.2
        private const val QUIETA_BRILLO = 0.5
        /** Fraccion de vueltas de aprendizaje en que tiene que estar quieta. */
        private const val FRACCION_EXCLUIR = 0.7
        // 2 y no mas: con 2 h de aprendizaje y vueltas cada hora no caben mas.
        private const val VUELTAS_MINIMAS = 2
        private const val NUNCA = Long.MIN_VALUE
    }

    /**
     * Reconcilia con las fallas que el servidor tiene abiertas. El servidor manda:
     * si alguien cerro o descarto una a mano, aqui se olvida.
     */
    fun sincronizar(abiertasServidor: Map<String, Long>) {
        abiertas.keys.retainAll { it in abiertasServidor || abiertas[it]?.id == null }
        for ((k, id) in abiertasServidor) {
            val a = abiertas[k]
            if (a == null) abiertas[k] = Abierta(id, 0) else a.id = id
        }
    }

    /** El servidor confirmo una alerta nueva: se anota su numero. */
    fun confirmada(clave: String, id: Long) { abiertas[clave]?.id = id }

    /** Zonas aprendidas como "nunca cambian". Solo cuentan tras VUELTAS_MINIMAS. */
    fun excluidas(): Set<Pair<Int, Int>> = celdas.filter { (_, c) ->
        c.vueltas >= VUELTAS_MINIMAS && c.quietas.toDouble() / c.vueltas >= FRACCION_EXCLUIR
    }.keys.map { k -> k.split(":").let { it[0].toInt() to it[1].toInt() } }.toSet()

    /** Olvida lo aprendido (cambio el encuadre o la cuadricula). */
    fun reiniciar() {
        candidatos.clear(); celdas.clear(); ultimaVuelta = NUNCA
    }

    /**
     * Registra una vuelta y devuelve lo que hay que avisar.
     *
     * @param aprendiendo en las primeras 24 h no se abre nada, solo se aprende.
     * @param silenciadas claves que alguien descarto en el dashboard.
     * @param puedeAbrir cuantas alertas nuevas deja el tope diario.
     */
    fun registrar(ahora: Long, o: Observacion, aprendiendo: Boolean, silenciadas: Set<String> = emptySet(), puedeAbrir: Int = Int.MAX_VALUE): List<Evento> {
        // Dos vueltas muy juntas no son dos confirmaciones independientes.
        if (ultimaVuelta != NUNCA && ahora - ultimaVuelta < separacionMs) return emptyList()

        val anomalias = mutableMapOf<String, Triple<String, Pair<Int?, Int?>, Double>>()
        val grupos = mutableMapOf<String, List<Pair<Int, Int>>>()
        // Que se pudo juzgar en esta vuelta (para saber que esta sano).
        val juzgable: (String) -> Boolean
        val s = o.salud
        when {
            o.camara == Seguimiento.Camara.INCONCLUSO -> juzgable = { false }
            o.camara != Seguimiento.Camara.OK -> {
                val tipo = if (o.camara == Seguimiento.Camara.MOVIDA) "camara_movida" else "sin_imagen"
                anomalias[tipo] = Triple(tipo, null to null, 1.0)
                // Con la camara mal no se puede juzgar la pantalla.
                juzgable = { it == "camara_movida" || it == "sin_imagen" }
            }
            s == null || s.pantalla == SaludAnalisis.Pantalla.INCONCLUSO ->
                juzgable = { it == "camara_movida" || it == "sin_imagen" }
            s.pantalla == SaludAnalisis.Pantalla.APAGADA || s.pantalla == SaludAnalisis.Pantalla.CONGELADA -> {
                val tipo = if (s.pantalla == SaludAnalisis.Pantalla.APAGADA) "pantalla_apagada" else "pantalla_congelada"
                anomalias[tipo] = Triple(tipo, null to null, 1.0)
                juzgable = { !it.startsWith("zona_") }
            }
            else -> {
                for (z in s.zonas) {
                    if (z.grupo.isNotEmpty()) {
                        val k = claveGrupo(z.tipo)
                        anomalias[k] = Triple(z.tipo, null to null, z.confianza)
                        grupos[k] = z.grupo
                    } else anomalias[clave(z.tipo, z.fila, z.columna)] = Triple(z.tipo, z.fila to z.columna, z.confianza)
                }
                val fuera = excluidas()
                juzgable = { k ->
                    if (!k.startsWith("zona_")) true
                    else k.split(":").let { p -> p[1] == "varias" || (p[1].toInt() to p[2].toInt()) !in fuera }
                }
                if (aprendiendo) aprender(s, o.filas, o.columnas)
            }
        }
        ultimaVuelta = ahora

        val eventos = mutableListOf<Evento>()
        var cupo = puedeAbrir

        for ((k, a) in anomalias) {
            abiertas[k]?.let { it.sanas = 0; return@let }
            if (k in abiertas) continue
            val c = candidatos.getOrPut(k) { Candidato(a.first, a.second.first, a.second.second, 0, mutableListOf()) }
            c.cuenta++
            c.confianzas.add(a.third)
            if (aprendiendo || k in silenciadas) continue
            val confianza = c.confianzas.takeLast(confirmaciones).average()
            if (c.cuenta >= confirmaciones && confianza >= umbral && cupo > 0) {
                eventos.add(Evento("abrir", k, c.tipo, c.fila, c.columna, Math.round(confianza * 100) / 100.0,
                    zonas = grupos[k] ?: emptyList()))
                abiertas[k] = Abierta(null, 0)
                candidatos.remove(k)
                cupo--
            }
        }
        // Un candidato que esta vuelta se vio sano vuelve a cero. Si no se pudo
        // juzgar, se queda como estaba.
        candidatos.keys.removeAll { it !in anomalias && juzgable(it) }

        val it = abiertas.entries.iterator()
        while (it.hasNext()) {
            val (k, a) = it.next()
            if (k in anomalias || !juzgable(k)) continue
            a.sanas++
            if (a.sanas >= recuperacion && a.id != null) {
                val p = k.split(":")
                eventos.add(Evento("recuperar", k, p[0], p.getOrNull(1)?.toIntOrNull(), p.getOrNull(2)?.toIntOrNull(), 1.0, a.id))
                it.remove()
            }
        }
        return eventos
    }

    private fun aprender(s: SaludAnalisis.Resultado, filas: Int, columnas: Int) {
        val act = s.actividad ?: return
        val bri = s.brillo ?: return
        for (f in 0 until filas) for (c in 0 until columnas) {
            val celda = celdas.getOrPut("$f:$c") { Celda() }
            celda.vueltas++
            if (act[f][c] < QUIETA_ACTIVIDAD || bri[f][c] < QUIETA_BRILLO) celda.quietas++
        }
    }

    // --- Persistencia -----------------------------------------------------------

    fun aJson(): JSONObject {
        val cand = JSONArray()
        for ((k, c) in candidatos) cand.put(JSONObject().put("k", k).put("t", c.tipo).put("f", c.fila ?: -1)
            .put("c", c.columna ?: -1).put("n", c.cuenta).put("conf", JSONArray(c.confianzas)))
        val ab = JSONArray()
        for ((k, a) in abiertas) ab.put(JSONObject().put("k", k).put("id", a.id ?: -1).put("sanas", a.sanas))
        val ce = JSONArray()
        for ((k, c) in celdas) ce.put(JSONObject().put("k", k).put("v", c.vueltas).put("q", c.quietas))
        return JSONObject().put("candidatos", cand).put("abiertas", ab).put("celdas", ce).put("ultima", ultimaVuelta)
    }

    fun deJson(j: JSONObject) {
        candidatos.clear(); abiertas.clear(); celdas.clear()
        ultimaVuelta = j.optLong("ultima", NUNCA)
        j.optJSONArray("candidatos")?.let { a -> for (i in 0 until a.length()) a.getJSONObject(i).let { o ->
            val conf = o.getJSONArray("conf")
            candidatos[o.getString("k")] = Candidato(o.getString("t"), o.getInt("f").takeIf { it >= 0 },
                o.getInt("c").takeIf { it >= 0 }, o.getInt("n"), MutableList(conf.length()) { conf.getDouble(it) })
        } }
        j.optJSONArray("abiertas")?.let { a -> for (i in 0 until a.length()) a.getJSONObject(i).let { o ->
            abiertas[o.getString("k")] = Abierta(o.getLong("id").takeIf { it >= 0 }, o.getInt("sanas"))
        } }
        j.optJSONArray("celdas")?.let { a -> for (i in 0 until a.length()) a.getJSONObject(i).let { o ->
            celdas[o.getString("k")] = Celda(o.getInt("v"), o.getInt("q"))
        } }
    }
}
