package com.spaceeye.agent.vinculacion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VinculacionTest {

    private val compilado = "http://159.203.188.58:4000"

    // --- El QR / enlace ---

    @Test
    fun enlaceValidoConServidorCodificado() {
        val d = Vinculacion.leerEnlace("spaceeye://vincular?servidor=https%3A%2F%2Feyes.miempresa.com&codigo=ABCD2345")
        assertEquals(Vinculacion.Datos("https://eyes.miempresa.com", "ABCD2345"), d)
    }

    @Test
    fun enlaceConServidorSinCodificarYOrdenInvertido() {
        val d = Vinculacion.leerEnlace("spaceeye://vincular?codigo=WXYZ6789&servidor=https://eyes.otra.mx/")
        assertEquals(Vinculacion.Datos("https://eyes.otra.mx", "WXYZ6789"), d)
    }

    @Test
    fun enlaceConCodigoEnMinusculasYGuion() {
        val d = Vinculacion.leerEnlace("spaceeye://vincular?servidor=https%3A%2F%2Feyes.x.com&codigo=abcd-2345")
        assertEquals("ABCD2345", d?.codigo)
    }

    @Test
    fun enlaceConEsquemaEnMayusculasYEspacios() {
        val d = Vinculacion.leerEnlace("  SPACEEYE://vincular?servidor=https%3A%2F%2Feyes.x.com&codigo=ABCD2345\n")
        assertEquals("https://eyes.x.com", d?.servidor)
    }

    @Test
    fun enlaceSinServidorOSinCodigo() {
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?codigo=ABCD2345"))
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?servidor=https%3A%2F%2Feyes.x.com"))
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular"))
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?servidor=&codigo="))
    }

    @Test
    fun enlaceDeOtroEsquemaUOtraRuta() {
        assertNull(Vinculacion.leerEnlace("https://vincular?servidor=https%3A%2F%2Feyes.x.com&codigo=ABCD2345"))
        assertNull(Vinculacion.leerEnlace("otraapp://vincular?servidor=https%3A%2F%2Feyes.x.com&codigo=ABCD2345"))
        assertNull(Vinculacion.leerEnlace("spaceeye://borrar?servidor=https%3A%2F%2Feyes.x.com&codigo=ABCD2345"))
        assertNull(Vinculacion.leerEnlace("ABCD2345"))
        assertNull(Vinculacion.leerEnlace(""))
        assertNull(Vinculacion.leerEnlace(null))
    }

    @Test
    fun enlaceConServidorQueNoEsWeb() {
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?servidor=ftp%3A%2F%2Feyes.x.com&codigo=ABCD2345"))
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?servidor=javascript%3Aalert(1)&codigo=ABCD2345"))
    }

    @Test
    fun enlaceConCodigoInvalido() {
        // I, O, 0, 1 no estan en el alfabeto; largo distinto de 8.
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?servidor=https%3A%2F%2Feyes.x.com&codigo=ABCD1234"))
        assertNull(Vinculacion.leerEnlace("spaceeye://vincular?servidor=https%3A%2F%2Feyes.x.com&codigo=ABC2345"))
    }

    // --- El codigo tecleado ---

    @Test
    fun codigoSeNormaliza() {
        assertEquals("ABCD2345", Vinculacion.normalizarCodigo("ABCD2345"))
        assertEquals("ABCD2345", Vinculacion.normalizarCodigo("abcd-2345"))
        assertEquals("ABCD2345", Vinculacion.normalizarCodigo(" ab cd - 23 45 "))
    }

    @Test
    fun codigoConCaracteresFueraDelAlfabeto() {
        assertNull(Vinculacion.normalizarCodigo("ABCD-234O")) // letra O
        assertNull(Vinculacion.normalizarCodigo("ABCD-2340")) // cero
        assertNull(Vinculacion.normalizarCodigo("IBCD-2345")) // I
        assertNull(Vinculacion.normalizarCodigo("LBCD-2345")) // L
        assertNull(Vinculacion.normalizarCodigo("ABCD_2345"))
        assertNull(Vinculacion.normalizarCodigo("ÁBCD2345"))
    }

    @Test
    fun codigoDeLargoIncorrecto() {
        assertNull(Vinculacion.normalizarCodigo("ABCD234"))
        assertNull(Vinculacion.normalizarCodigo("ABCD-23456"))
        assertNull(Vinculacion.normalizarCodigo(""))
        assertNull(Vinculacion.normalizarCodigo(null))
    }

    @Test
    fun codigoSeMuestraConGuion() {
        assertEquals("ABCD-2345", Vinculacion.formatearCodigo("ABCD2345"))
    }

    // --- La direccion tecleada ---

    @Test
    fun servidorTecleadoSinEsquemaVaPorHttps() {
        assertEquals("https://eyes.miempresa.com", Vinculacion.normalizarServidor(" eyes.miempresa.com/ "))
        assertEquals("http://192.168.1.80:4000", Vinculacion.normalizarServidor("http://192.168.1.80:4000"))
        assertNull(Vinculacion.normalizarServidor(""))
        assertNull(Vinculacion.normalizarServidor("eyes con espacios.com"))
    }

    // --- A que servidor hablar ---

    @Test
    fun telefonoNuevoNecesitaVincularse() {
        assertNull(Vinculacion.decidirServidor(null, yaFuncionabaAntes = false, compilado = compilado))
        assertNull(Vinculacion.decidirServidor("", yaFuncionabaAntes = false, compilado = compilado))
    }

    @Test
    fun telefonoDeLaFlotaSigueConElServidorCompilado() {
        assertEquals(compilado, Vinculacion.decidirServidor(null, yaFuncionabaAntes = true, compilado = compilado))
    }

    @Test
    fun telefonoVinculadoUsaElServidorGuardado() {
        assertEquals("https://eyes.x.com", Vinculacion.decidirServidor("https://eyes.x.com", false, compilado))
        // Aunque tambien venga de la flota vieja: manda la vinculacion.
        assertEquals("https://eyes.x.com", Vinculacion.decidirServidor("https://eyes.x.com", true, compilado))
    }
}
