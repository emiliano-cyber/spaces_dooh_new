// Vinculacion.kt — Leer el codigo QR / enlace de SPACE OS y decidir a que servidor hablar
package com.spaceeye.agent.vinculacion

import java.net.URI
import java.net.URLDecoder

/**
 * Una sola APK para todas las empresas: el telefono NUEVO no trae el servidor
 * compilado, lo recibe al vincularse con un codigo generado en SPACE OS
 * ("Agregar dispositivo"), sea escaneando el QR o tecleandolo.
 *
 * Todo aqui es Kotlin puro (sin Android) para poder probarlo en la PC.
 */
object Vinculacion {

    /**
     * Las letras y numeros que usa SPACE OS. Faltan a proposito los que se
     * confunden al leerlos en voz alta o en una pantalla (I/1/L, O/0, U/V).
     */
    const val ALFABETO = "ABCDEFGHJKMNPQRSTWXYZ23456789"
    const val LARGO_CODIGO = 8

    /** Lo que trae el QR: a que servidor darse de alta y con que codigo. */
    data class Datos(val servidor: String, val codigo: String)

    /**
     * Deja el codigo como lo espera el servidor ("ABCD2345"). Acepta lo que un
     * instalador teclearia: minusculas, guion o espacios ("abcd-2345"). null si
     * no es un codigo valido (largo distinto o letras fuera del alfabeto), para
     * avisar en el telefono en vez de gastar un intento contra el servidor.
     */
    fun normalizarCodigo(texto: String?): String? {
        if (texto == null) return null
        val limpio = texto.filterNot { it == '-' || it.isWhitespace() }.uppercase()
        if (limpio.length != LARGO_CODIGO) return null
        if (limpio.any { it !in ALFABETO }) return null
        return limpio
    }

    /** Como se le muestra a la gente: "ABCD-2345". */
    fun formatearCodigo(codigo: String): String =
        if (codigo.length == LARGO_CODIGO) "${codigo.substring(0, 4)}-${codigo.substring(4)}" else codigo

    /**
     * Deja la direccion del servidor lista para pegarle "/api/...". Si la
     * escribieron sin "https://" se agrega (en produccion siempre es https). Se
     * quita la diagonal final para no pedir "//api". null si no parece una
     * direccion web.
     */
    fun normalizarServidor(texto: String?): String? {
        var s = texto?.trim().orEmpty()
        if (s.isEmpty()) return null
        if (!s.contains("://")) s = "https://$s"
        s = s.trimEnd('/')
        val uri = try { URI(s) } catch (_: Exception) { return null }
        val esquema = uri.scheme?.lowercase()
        if (esquema != "https" && esquema != "http") return null
        if (uri.host.isNullOrBlank()) return null
        return s
    }

    /**
     * Lee el contenido del QR (o el enlace con que se abrio la app):
     * `spaceeye://vincular?servidor=<https://eyes.dominio codificado>&codigo=ABCD2345`.
     * null si no es un enlace de vinculacion de SPACE OS o le falta algo.
     */
    fun leerEnlace(texto: String?): Datos? {
        val uri = try { URI(texto?.trim() ?: return null) } catch (_: Exception) { return null }
        if (!uri.scheme.equals("spaceeye", ignoreCase = true)) return null
        if (!uri.host.equals("vincular", ignoreCase = true)) return null
        val parametros = mutableMapOf<String, String>()
        for (par in uri.rawQuery?.split('&').orEmpty()) {
            val i = par.indexOf('=')
            if (i <= 0) continue
            val valor = try { URLDecoder.decode(par.substring(i + 1), "UTF-8") } catch (_: Exception) { return null }
            parametros[par.substring(0, i)] = valor
        }
        val servidor = normalizarServidor(parametros["servidor"]) ?: return null
        val codigo = normalizarCodigo(parametros["codigo"]) ?: return null
        return Datos(servidor, codigo)
    }

    /**
     * A que servidor habla el telefono:
     *  - el que guardo una vinculacion exitosa, si la hubo;
     *  - si no, el compilado en la APK, PERO solo si el telefono ya estaba dado
     *    de alta antes de esta version (la flota de siempre). Asi al
     *    actualizarse sigue igual, mismo servidor y misma llave, sin pantalla de
     *    vinculacion;
     *  - si no, null: telefono nuevo, hay que vincularlo.
     */
    fun decidirServidor(guardado: String?, yaFuncionabaAntes: Boolean, compilado: String): String? = when {
        !guardado.isNullOrBlank() -> guardado
        yaFuncionabaAntes -> compilado
        else -> null
    }
}
