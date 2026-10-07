// LoteCreativos.kt — Las fotos de creativos nuevos que esperan su envio agrupado.
package com.spaceeye.agent.pantalla

import org.json.JSONObject
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Cuando el servidor pide mandar las fotos nuevas "juntas cada N horas"
 * (creativos.envio_min > 0), la vigilancia sigue mirando todo el tiempo (para no
 * perder un creativo que sale una sola vez) pero en vez de subir la foto al
 * momento la guarda aqui, y al cumplirse el plazo manda UNA por creativo: la mas
 * nitida de las que se vieron en ese tiempo. Igual que en la Raspberry
 * (pi-agent/vision/lote.py).
 *
 * Agrupar NO ahorra datos (cada foto pesa lo mismo se mande cuando se mande):
 * sirve para recibirlas juntas. Lo que cuida el consumo es el tope diario, que se
 * respeta al enviar.
 *
 * Vive en disco (<dir>/lote/), escrito de forma atomica: un reinicio del telefono
 * a mitad del plazo no pierde ninguna foto. Codigo puro (sin Android) para
 * probarlo en la PC.
 */
class LoteCreativos(directorio: File, private val ahora: () -> Long) {

    /** Que hacer con la foto de un creativo nuevo recien confirmado. */
    enum class Destino { NINGUNO, LOTE, SUBIR }

    data class Envio(val enviadas: Int, val restantes: Int, val quedan: Int)

    private class Item(val archivo: String, val nitidez: Double, val primera: Long)

    companion object {
        /**
         * En aprendizaje no se fotografia ni se guarda nada (igual que antes). Con
         * envio agrupado va al lote, sin importar el tope (que manda al enviar).
         * Al momento, mientras quede tope: `restantes > 0` y no `fotos < restantes`,
         * que con cada foto sumando a una y restando a la otra dejaba usar solo la
         * mitad del tope del dia (3 de 5).
         */
        fun destino(aprendiendo: Boolean, envioMin: Long, restantes: Int): Destino = when {
            aprendiendo -> Destino.NINGUNO
            envioMin > 0 -> Destino.LOTE
            restantes > 0 -> Destino.SUBIR
            else -> Destino.NINGUNO
        }
    }

    private val dir = File(directorio, "lote").apply { mkdirs() }
    private val indice = File(dir, "lote.json")
    private val items = linkedMapOf<String, Item>()
    var ultimoEnvio = 0L
        private set

    init {
        try {
            val j = JSONObject(indice.readText())
            val its = j.optJSONObject("items")
            its?.keys()?.forEach { clave ->
                val k = clave as String
                val o = its.getJSONObject(k)
                val archivo = o.optString("archivo")
                if (archivo.isNotEmpty() && File(dir, archivo).exists()) {
                    items[k] = Item(archivo, o.optDouble("nitidez", 0.0), o.optLong("primera"))
                }
            }
            ultimoEnvio = j.optLong("ultimo_envio", 0L)
        } catch (_: Exception) {
            // Nuevo, o el indice no se pudo leer: se empieza vacio.
        }
    }

    val tamaño: Int get() = items.size

    fun tiene(huella: String) = huella in items

    /** Si una foto con esta nitidez reemplazaria a la que espera (para no preparar la foto en balde). */
    fun mejoraria(huella: String, nitidez: Double): Boolean = items[huella]?.let { nitidez > it.nitidez } == true

    /** Un creativo nuevo: se guarda (o se mejora si ya estaba). */
    fun agregar(huella: String, jpeg: ByteArray, nitidez: Double): Boolean {
        // El plazo del primer envio cuenta desde el primer creativo nuevo.
        if (items.isEmpty() && ultimoEnvio == 0L) ultimoEnvio = ahora()
        val previo = items[huella]
        if (previo != null && previo.nitidez >= nitidez) return false
        items[huella] = Item(escribirFoto(huella, jpeg), nitidez, previo?.primera ?: ahora())
        guardar()
        return true
    }

    /** Otra mirada a un creativo que espera envio: si se ve mas nitido, esa foto. */
    fun mejorar(huella: String, jpeg: ByteArray, nitidez: Double): Boolean =
        if (huella !in items) false else agregar(huella, jpeg, nitidez)

    fun tocaEnviar(envioMin: Long): Boolean = items.isNotEmpty() && ahora() - ultimoEnvio >= envioMin * 60_000L

    /** Al cumplirse el plazo, o en cuanto se vuelve a "al momento" con fotos esperando. */
    fun debeEnviar(envioMin: Long): Boolean = items.isNotEmpty() && (envioMin <= 0 || tocaEnviar(envioMin))

    /** (huella, jpeg) en el orden en que aparecieron. */
    fun pendientes(): List<Pair<String, ByteArray>> = items.entries.sortedBy { it.value.primera }.mapNotNull { (h, v) ->
        try { h to File(dir, v.archivo).readBytes() } catch (_: Exception) { null }
    }

    fun quitar(huella: String) {
        val v = items.remove(huella) ?: return
        File(dir, v.archivo).delete()
        guardar()
    }

    fun marcarEnvio() {
        ultimoEnvio = ahora()
        guardar()
    }

    /**
     * Manda lo que espera, una por creativo, mientras quede tope del dia. Lo que no
     * cabe (o no se pudo subir) se queda para el siguiente envio.
     */
    fun enviar(restantes: Int, subir: (huella: String, jpeg: ByteArray) -> Boolean): Envio {
        var quedaTope = restantes
        var enviadas = 0
        for ((h, jpeg) in pendientes()) {
            if (quedaTope <= 0) break
            if (subir(h, jpeg)) {
                quitar(h)
                quedaTope--
                enviadas++
            }
        }
        marcarEnvio()
        return Envio(enviadas, quedaTope, items.size)
    }

    private fun escribirFoto(huella: String, jpeg: ByteArray): String {
        val nombre = "${huella.take(32)}.jpg"
        escribirAtomico(File(dir, nombre), jpeg)
        return nombre
    }

    private fun guardar() {
        val its = JSONObject()
        for ((k, v) in items) its.put(k, JSONObject().put("archivo", v.archivo).put("nitidez", v.nitidez).put("primera", v.primera))
        escribirAtomico(indice, JSONObject().put("items", its).put("ultimo_envio", ultimoEnvio).toString().toByteArray())
    }

    // Primero a un temporal y luego se renombra: un apagon a media escritura no
    // deja el indice ni la foto a medias.
    private fun escribirAtomico(destino: File, datos: ByteArray) {
        val tmp = File(destino.path + ".tmp")
        tmp.writeBytes(datos)
        Files.move(tmp.toPath(), destino.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
    }
}
