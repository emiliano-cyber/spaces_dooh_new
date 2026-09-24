// Reconocedor.kt — Reconoce el creativo de la pantalla por sus puntos, con cualquier luz.
package com.spaceeye.agent.creativos

import android.content.Context
import android.util.Log
import com.spaceeye.agent.pantalla.Vision
import com.spaceeye.agent.pantalla.Vision.Rasgos
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * POR QUE PUNTOS Y NO UNA HUELLA
 * ------------------------------
 * La primera version reconocia el creativo con una huella de 256 bits (la de la
 * Raspberry, Huella.kt). Medido el 23-sep-2026 con fotos reales etiquetadas a
 * mano, NO sirve entre dias distintos: en TLALPAN dos fotos del MISMO creativo
 * quedaban a una mediana de 73 bits, igual que dos creativos distintos. El sol
 * de mediodia deslava la pantalla y de noche sale saturada; la huella compara
 * brillos y eso es justo lo que cambia. Simulando al equipo foto por foto, la
 * huella habria gastado 6 fotos en falso de 23 en TLALPAN y 10 de 20 en
 * AUTOPISTA.
 *
 * ORB busca esquinas y compara su textura local, y despues exige que los puntos
 * que coinciden guarden la misma geometria (homografia). La luz cambia el brillo
 * de la esquina, no donde esta. Con las mismas fotos: el mismo creativo da de 18
 * a 290 puntos coincidentes; dos creativos distintos, 6 como maximo. Con umbral
 * de 15 y un catalogo que guarda variantes de luz: 0 fotos en falso en TLALPAN,
 * 1 en AUTOPISTA (una foto deslavada por el sol, que despues queda aprendida).
 *
 * DOS CONDICIONES QUE NO SON OPCIONALES
 * -------------------------------------
 *   1. Mirar SOLO la pantalla, enderezada con sus 4 esquinas (Enderezador). Con
 *      la foto entera, los puntos del fondo -el letrero de al lado, un edificio-
 *      coinciden entre todos los creativos y cualquier anuncio nuevo pasa por
 *      conocido.
 *   2. El mismo encuadre siempre. El catalogo vale para UN lente, UN zoom y UNAS
 *      esquinas; si cambia cualquiera, se tira y se vuelve a aprender.
 */
class Reconocedor(ctx: Context) {

    companion object {
        private const val TAG = "Reconocedor"
        /** Puntos coincidentes para decir "es el mismo creativo". */
        const val UMBRAL = 15
        /**
         * Por debajo de esto, aunque se reconozca, la toma se guarda como otra
         * variante de luz del creativo: es la que la proxima vez hara falta.
         */
        private const val VARIANTE_HASTA = 40
        private const val VARIANTES_MAX = 6
        /** Tras (re)empezar el catalogo, cuanto solo aprende sin fotografiar. */
        private const val APRENDIZAJE_MS = 24L * 3600 * 1000
    }

    private class Creativo(val id: String, val variantes: MutableList<Rasgos>)

    private val dir = File(ctx.filesDir, "creativos").apply { mkdirs() }
    private val indice = File(dir, "catalogo.json")
    private val catalogo = mutableListOf<Creativo>()
    private var creado = 0L
    private var firma = ""

    /**
     * Abre el catalogo guardado si fue aprendido con este mismo encuadre; si no,
     * empieza uno vacio. `firmaNueva` resume todo lo que lo invalida: esquinas,
     * lente, zoom, giro y la fecha desde la que vigila el servidor (que cambia
     * cuando alguien pulsa "Volver a aprender").
     */
    fun abrir(firmaNueva: String) {
        if (firmaNueva == firma && creado != 0L) return
        catalogo.clear()
        creado = 0L
        firma = firmaNueva
        try {
            if (indice.exists()) {
                val j = JSONObject(indice.readText())
                if (j.optString("firma") == firmaNueva) {
                    creado = j.optLong("creado")
                    val arr = j.getJSONArray("creativos")
                    for (i in 0 until arr.length()) {
                        val c = arr.getJSONObject(i)
                        val vs = mutableListOf<Rasgos>()
                        val fs = c.getJSONArray("variantes")
                        for (k in 0 until fs.length()) Vision.leer(File(dir, fs.getString(k)))?.let { vs.add(it) }
                        if (vs.isNotEmpty()) catalogo.add(Creativo(c.getString("id"), vs))
                    }
                } else {
                    Log.i(TAG, "el encuadre cambio: se empieza un catalogo nuevo")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "catalogo ilegible, se empieza de cero: ${e.message}")
            catalogo.clear()
        }
        if (creado == 0L) {
            dir.listFiles()?.forEach { if (it.name.endsWith(".orb")) it.delete() }
            creado = System.currentTimeMillis()
            guardar()
        }
    }

    /** Las primeras 24 h de un catalogo solo se aprende. */
    fun aprendiendo(): Boolean = System.currentTimeMillis() - creado < APRENDIZAJE_MS

    fun tamaño(): Int = catalogo.size

    private fun archivo(id: String, k: Int) = "${id}_$k.orb"

    private fun guardar() {
        val arr = JSONArray()
        for (c in catalogo) {
            val fs = JSONArray()
            c.variantes.indices.forEach { k -> fs.put(archivo(c.id, k)) }
            arr.put(JSONObject().put("id", c.id).put("variantes", fs))
        }
        indice.writeText(JSONObject().put("firma", firma).put("creado", creado).put("creativos", arr).toString())
    }

    /** El creativo conocido que mejor coincide, y con cuantos puntos. */
    fun reconocer(r: Rasgos): Pair<String?, Int> {
        var mejor: String? = null
        var puntos = 0
        for (c in catalogo) for (v in c.variantes) {
            val p = Vision.coincidencias(r, v)
            if (p > puntos) { puntos = p; mejor = c.id }
        }
        return mejor to puntos
    }

    /** Guarda la toma como otra variante de luz de un creativo ya conocido. */
    fun aprenderVariante(id: String, r: Rasgos, puntos: Int) {
        if (puntos >= VARIANTE_HASTA) return
        val c = catalogo.find { it.id == id } ?: return
        if (c.variantes.size >= VARIANTES_MAX) return
        c.variantes.add(r)
        Vision.escribir(File(dir, archivo(id, c.variantes.size - 1)), r)
        guardar()
    }

    fun agregar(id: String, vararg rs: Rasgos) {
        if (catalogo.any { it.id == id }) return
        val c = Creativo(id, rs.toMutableList())
        catalogo.add(c)
        c.variantes.forEachIndexed { k, r -> Vision.escribir(File(dir, archivo(id, k)), r) }
        guardar()
    }
}
